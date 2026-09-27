import csv
import io
import json
import urllib.request
import urllib.error
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class BaseStoreConnector(ABC):
    """Abstract interface for multi-tenant e-commerce store catalog and order synchronization."""

    def __init__(self, workspace_id: str, config: Dict[str, Any]):
        self.workspace_id = workspace_id
        self.config = config

    @abstractmethod
    def sync_products(self) -> List[Dict[str, Any]]:
        """Syncs all products from the external store to the local catalog format."""
        pass

    @abstractmethod
    def get_inventory(self, product_id: str) -> int:
        """Fetches real-time stock quantity for a given product ID."""
        pass

    @abstractmethod
    def get_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        """Fetches live order tracking and fulfillment status."""
        pass


class ShopifyConnector(BaseStoreConnector):
    """Shopify Admin REST API connector for product catalog and inventory synchronization."""

    def __init__(self, workspace_id: str, config: Dict[str, Any]):
        super().__init__(workspace_id, config)
        self.shop_domain = config.get("shop_domain", "")
        self.access_token = config.get("access_token", "")
        self.api_version = config.get("api_version", "2024-01")

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": self.access_token
        }

    def sync_products(self) -> List[Dict[str, Any]]:
        if not self.shop_domain or not self.access_token:
            # Explicitly return empty list when credentials are not configured
            return []

        url = f"https://{self.shop_domain}/admin/api/{self.api_version}/products.json?limit=50"
        req = urllib.request.Request(url, headers=self._get_headers())

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                products = []
                for p in data.get("products", []):
                    variants = p.get("variants", [{}])
                    first_var = variants[0] if variants else {}
                    products.append({
                        "id": f"sp_{p.get('id')}",
                        "workspace_id": self.workspace_id,
                        "title": p.get("title"),
                        "price": float(first_var.get("price", 0.0)),
                        "stock": int(first_var.get("inventory_quantity", 0)),
                        "category": p.get("product_type", "General"),
                        "description": p.get("body_html", "")
                    })
                return products
        except Exception:
            return []

    def get_inventory(self, product_id: str) -> int:
        products = self.sync_products()
        for p in products:
            if p["id"] == product_id:
                return p.get("stock", 0)
        return 0

    def get_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        if not self.shop_domain or not self.access_token:
            return None

        clean_id = order_id.replace("#", "")
        url = f"https://{self.shop_domain}/admin/api/{self.api_version}/orders/{clean_id}.json"
        req = urllib.request.Request(url, headers=self._get_headers())
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                order = data.get("order", {})
                return {
                    "order_number": order.get("name", order_id),
                    "workspace_id": self.workspace_id,
                    "status": order.get("fulfillment_status", "OPEN").upper(),
                    "total_amount": float(order.get("total_price", 0.0)),
                    "currency": order.get("currency", "USD")
                }
        except Exception:
            return None


class WooCommerceConnector(BaseStoreConnector):
    """WooCommerce REST API v3 connector for catalog and order synchronization."""

    def __init__(self, workspace_id: str, config: Dict[str, Any]):
        super().__init__(workspace_id, config)
        self.store_url = config.get("store_url", "").rstrip("/")
        self.consumer_key = config.get("consumer_key", "")
        self.consumer_secret = config.get("consumer_secret", "")

    def sync_products(self) -> List[Dict[str, Any]]:
        if not self.store_url or not self.consumer_key:
            return []
        
        import base64
        url = f"{self.store_url}/wp-json/wc/v3/products?per_page=50"
        auth = base64.b64encode(f"{self.consumer_key}:{self.consumer_secret}".encode()).decode()
        req = urllib.request.Request(url, headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/json"
        })
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                products = []
                for p in data:
                    products.append({
                        "id": f"wc_{p.get('id')}",
                        "workspace_id": self.workspace_id,
                        "title": p.get("name"),
                        "price": float(p.get("price") or 0.0),
                        "stock": int(p.get("stock_quantity") or 0),
                        "category": p.get("categories", [{}])[0].get("name", "General") if p.get("categories") else "General",
                        "description": p.get("description", "")
                    })
                return products
        except Exception:
            return []

    def get_inventory(self, product_id: str) -> int:
        products = self.sync_products()
        for p in products:
            if p["id"] == product_id:
                return p.get("stock", 0)
        return 0

    def get_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        if not self.store_url or not self.consumer_key:
            return None
            
        import base64
        clean_id = order_id.replace("#", "")
        url = f"{self.store_url}/wp-json/wc/v3/orders/{clean_id}"
        auth = base64.b64encode(f"{self.consumer_key}:{self.consumer_secret}".encode()).decode()
        req = urllib.request.Request(url, headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/json"
        })
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return {
                    "order_number": str(data.get("id", order_id)),
                    "workspace_id": self.workspace_id,
                    "status": data.get("status", "PROCESSING").upper(),
                    "total_amount": float(data.get("total", 0.0)),
                    "currency": data.get("currency", "USD")
                }
        except Exception:
            return None


class CsvCatalogConnector(BaseStoreConnector):
    """CSV / TSV Catalog Importer supporting standard and custom e-commerce header columns."""

    def __init__(self, workspace_id: str, config: Dict[str, Any]):
        super().__init__(workspace_id, config)
        self.csv_content = config.get("csv_content", "")

    def sync_products(self) -> List[Dict[str, Any]]:
        if not self.csv_content:
            return []

        products = []
        reader = csv.DictReader(io.StringIO(self.csv_content.strip()))
        for idx, row in enumerate(reader):
            # Normalizing column headers
            clean_row = {k.strip().lower(): v.strip() for k, v in row.items() if k}
            pid = clean_row.get("id") or clean_row.get("sku") or f"csv_{self.workspace_id}_{idx+1}"
            title = clean_row.get("title") or clean_row.get("name") or "Unnamed Product"
            price = float(clean_row.get("price", "0").replace("$", "").replace(",", "") or 0.0)
            stock = int(clean_row.get("stock") or clean_row.get("inventory") or clean_row.get("qty") or 0)
            category = clean_row.get("category") or clean_row.get("type") or "General"
            desc = clean_row.get("description") or clean_row.get("desc") or ""

            products.append({
                "id": pid,
                "workspace_id": self.workspace_id,
                "title": title,
                "price": price,
                "stock": stock,
                "category": category,
                "description": desc,
                "in_stock": stock > 0
            })
        return products

    def get_inventory(self, product_id: str) -> int:
        for p in self.sync_products():
            if p["id"] == product_id:
                return p.get("stock", 0)
        return 0

    def get_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        return None
