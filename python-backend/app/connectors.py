"""Production Commerce Connectors

Provides real API integrations for Shopify, WooCommerce, and Web Crawler.
All sync tasks persist job status in SyncJobModel and insert/update ProductModel.
"""

import datetime
import logging
import re
import uuid
from typing import Any

import httpx
from sqlalchemy import select

from .db.database import async_session_factory
from .db.models import IntegrationModel, ProductModel, SyncJobModel

logger = logging.getLogger("shopmate_connectors")


class ShopifyConnector:
    """Real Shopify Admin REST API connector."""

    def __init__(self, shop_domain: str, access_token: str):
        self.shop_domain = shop_domain.replace("https://", "").replace("http://", "").rstrip("/")
        self.access_token = access_token

    async def fetch_products(self) -> list[dict[str, Any]]:
        url = f"https://{self.shop_domain}/admin/api/2024-01/products.json"
        headers = {
            "X-Shopify-Access-Token": self.access_token,
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                raise ValueError(f"Shopify API error ({resp.status_code}): {resp.text}")
            data = resp.json()
            return data.get("products", [])


class WooCommerceConnector:
    """Real WooCommerce v3 REST API connector."""

    def __init__(self, store_url: str, consumer_key: str, consumer_secret: str):
        self.store_url = store_url.rstrip("/")
        self.consumer_key = consumer_key
        self.consumer_secret = consumer_secret

    async def fetch_products(self) -> list[dict[str, Any]]:
        url = f"{self.store_url}/wp-json/wc/v3/products"
        auth = (self.consumer_key, self.consumer_secret)
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, auth=auth)
            if resp.status_code != 200:
                raise ValueError(f"WooCommerce API error ({resp.status_code}): {resp.text}")
            return resp.json()


class WebCrawlerConnector:
    """Extracts structured schema.org / OpenGraph product metadata from live store URLs."""

    def __init__(self, target_url: str):
        self.target_url = target_url

    async def crawl_product(self) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(self.target_url, headers={"User-Agent": "ShopMate-Crawler/2.0"})
            if resp.status_code != 200:
                raise ValueError(f"Failed to crawl URL ({resp.status_code})")
            html = resp.text

        title_match = re.search(r'<meta\s+property=["\']og:title["\']\s+content=["\'](.*?)["\']', html, re.I)
        desc_match = re.search(r'<meta\s+property=["\']og:description["\']\s+content=["\'](.*?)["\']', html, re.I)
        img_match = re.search(r'<meta\s+property=["\']og:image["\']\s+content=["\'](.*?)["\']', html, re.I)
        price_match = re.search(r'<meta\s+property=["\']product:price:amount["\']\s+content=["\'](.*?)["\']', html, re.I)

        title = title_match.group(1) if title_match else None
        if not title:
            h1_match = re.search(r'<h1[^>]*>(.*?)</h1>', html, re.I | re.S)
            title = re.sub(r'<[^>]+>', '', h1_match.group(1)).strip() if h1_match else "Crawled Product"

        desc = desc_match.group(1) if desc_match else ""
        img = img_match.group(1) if img_match else None
        price = float(price_match.group(1)) if price_match else None

        return {
            "title": title,
            "description": desc,
            "price": price,
            "image_url": img,
            "source_url": self.target_url,
        }


async def execute_sync_job(job_id: str, workspace_id: str, connector_type: str) -> None:
    """Background worker task that runs catalog synchronization and records job progress."""
    from .db.database import set_tenant_session_context
    async with async_session_factory() as session:
        await set_tenant_session_context(session, workspace_id)
        job = (await session.execute(select(SyncJobModel).where(SyncJobModel.id == job_id))).scalars().first()
        if not job:
            return

        job.status = "SYNCING"
        await session.commit()

        try:
            # 1. Lookup integration credentials
            stmt = select(IntegrationModel).where(
                IntegrationModel.workspace_id == workspace_id,
                IntegrationModel.provider == connector_type.lower()
            )
            integration = (await session.execute(stmt)).scalars().first()
            if not integration or not integration.config_json:
                raise ValueError(f"Connector '{connector_type}' is not configured for this workspace.")

            cfg = integration.config_json
            synced_count = 0
            job_errors: list[str] = []

            if connector_type.lower() == "shopify":
                connector = ShopifyConnector(
                    shop_domain=cfg.get("shop_domain", ""),
                    access_token=cfg.get("access_token", "")
                )
                raw_products = await connector.fetch_products()
                for rp in raw_products:
                    variants = [
                        {
                            "id": str(v.get("id")),
                            "sku": v.get("sku") or "",
                            "price": float(v.get("price", 0)),
                            "inventory_quantity": v.get("inventory_quantity", 0),
                            "title": v.get("title", "Default"),
                        }
                        for v in rp.get("variants", [])
                    ]
                    base_price = float(rp.get("variants", [{}])[0].get("price", 0.0))
                    inv_sum = sum(v.get("inventory_quantity", 0) for v in rp.get("variants", []))

                    prod = ProductModel(
                        id=f"prod_shopify_{rp.get('id')}",
                        workspace_id=workspace_id,
                        title=rp.get("title", "Shopify Product"),
                        description=rp.get("body_html", ""),
                        price=base_price,
                        category=rp.get("product_type") or "General",
                        sku=variants[0]["sku"] if variants else None,
                        image_url=rp.get("images", [{}])[0].get("src") if rp.get("images") else None,
                        images_json=[img.get("src") for img in rp.get("images", []) if img.get("src")],
                        tags_json=[t.strip() for t in rp.get("tags", "").split(",") if t.strip()],
                        variants_json=variants,
                        stock=inv_sum,
                        in_stock=inv_sum > 0,
                    )
                    session.add(prod)
                    synced_count += 1

            elif connector_type.lower() == "woocommerce":
                connector = WooCommerceConnector(
                    store_url=cfg.get("store_url", ""),
                    consumer_key=cfg.get("consumer_key", ""),
                    consumer_secret=cfg.get("consumer_secret", "")
                )
                raw_products = await connector.fetch_products()
                for rp in raw_products:
                    price = float(rp.get("price") or rp.get("regular_price") or 0.0)
                    prod = ProductModel(
                        id=f"prod_wc_{rp.get('id')}",
                        workspace_id=workspace_id,
                        title=rp.get("name", "WooCommerce Product"),
                        description=rp.get("description", ""),
                        price=price,
                        category=rp.get("categories", [{}])[0].get("name", "General") if rp.get("categories") else "General",
                        sku=rp.get("sku"),
                        image_url=rp.get("images", [{}])[0].get("src") if rp.get("images") else None,
                        images_json=[img.get("src") for img in rp.get("images", []) if img.get("src")],
                        stock=int(rp.get("stock_quantity") or 10),
                        in_stock=bool(rp.get("in_stock", True)),
                    )
                    session.add(prod)
                    synced_count += 1

            elif connector_type.lower() == "web_crawler":
                crawler = WebCrawlerConnector(target_url=cfg.get("url", ""))
                crawled = await crawler.crawl_product()
                if crawled.get("price") is None:
                    err_msg = f"Skipping crawled product '{crawled.get('title')}' from {crawled.get('source_url')}: price not found"
                    logger.warning(err_msg)
                    job_errors.append(err_msg)
                else:
                    prod = ProductModel(
                        id=f"prod_crawl_{uuid.uuid4().hex[:10]}",
                        workspace_id=workspace_id,
                        title=crawled["title"],
                        description=crawled["description"],
                        price=crawled["price"],
                        image_url=crawled["image_url"],
                        source_url=crawled["source_url"],
                        stock=50,
                        in_stock=True,
                    )
                    session.add(prod)
                    synced_count = 1
            else:
                raise ValueError(f"Unsupported connector type: {connector_type}")

            job.status = "COMPLETED" if not job_errors or synced_count > 0 else "FAILED"
            job.synced_items_count = synced_count
            if job_errors:
                job.error_message = "; ".join(job_errors)
            job.completed_at = datetime.datetime.now(datetime.UTC)
            await session.commit()

        except Exception as e:
            logger.error("Sync job %s failed: %s", job_id, e)
            job.status = "FAILED"
            job.error_message = str(e)
            job.completed_at = datetime.datetime.now(datetime.UTC)
            await session.commit()
