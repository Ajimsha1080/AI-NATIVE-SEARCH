import os
import json
import asyncio
from pathlib import Path
from sqlalchemy import select, text
from app.db.database import init_db, async_session_factory, Base, engine
from app.db.models import (
    WorkspaceModel, UserModel, WorkspaceMemberModel,
    ProductModel, OrderModel, KnowledgeSourceModel,
    KnowledgeDocModel, KnowledgeChunkModel,
    AIModeConfigModel, DeploymentModel
)

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
AAAS_DB_PATH = DATA_DIR / "aaas.db.json"
AI_MODE_DATA_PATH = DATA_DIR / "ai_mode_data.json"

async def run_data_migration():
    print("=== Starting Enterprise Database Seeding & Migration ===")
    
    # 1. Initialize schema
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Schema verified.")

    async with async_session_factory() as session:
        # Load JSON stores
        aaas_data = {}
        ai_data = {}

        if AAAS_DB_PATH.exists():
            with open(AAAS_DB_PATH, "r", encoding="utf-8") as f:
                aaas_data = json.load(f)

        if AI_MODE_DATA_PATH.exists():
            with open(AI_MODE_DATA_PATH, "r", encoding="utf-8") as f:
                ai_data = json.load(f)

        # 1. Migrate Workspaces
        for ws in aaas_data.get("workspaces", []):
            res = await session.execute(select(WorkspaceModel).where(WorkspaceModel.id == ws["id"]))
            if not res.scalar_one_or_none():
                session.add(WorkspaceModel(
                    id=ws["id"],
                    name=ws.get("name", "Store"),
                    slug=ws.get("slug", ws["id"]),
                    tier=ws.get("plan", "ENTERPRISE")
                ))
        await session.commit()

        # 2. Migrate Users
        for u in aaas_data.get("users", []):
            res = await session.execute(select(UserModel).where(UserModel.id == u["id"]))
            if not res.scalar_one_or_none():
                session.add(UserModel(
                    id=u["id"],
                    email=u.get("email"),
                    name=u.get("name"),
                    role="OWNER" if u.get("is_super_admin") else "ADMIN"
                ))
        await session.commit()

        # 3. Migrate Workspace Members
        for m in aaas_data.get("workspace_members", []):
            res = await session.execute(select(WorkspaceMemberModel).where(WorkspaceMemberModel.id == m["id"]))
            if not res.scalar_one_or_none():
                session.add(WorkspaceMemberModel(
                    id=m["id"],
                    workspace_id=m["workspace_id"],
                    user_id=m["user_id"],
                    role=m.get("role", "OWNER")
                ))
        await session.commit()

        # 4. Migrate Commerce Products (all 247 catalog items)
        prods = aaas_data.get("commerce_products", [])
        migrated_prods = 0
        for p in prods:
            res = await session.execute(select(ProductModel).where(ProductModel.id == p["id"]))
            if not res.scalar_one_or_none():
                variants = p.get("variants", [])
                sku = variants[0].get("sku") if variants else f"SKU-{p['id']}"
                session.add(ProductModel(
                    id=p["id"],
                    workspace_id=p.get("workspace_id", "ws_acme_corp"),
                    title=p.get("title", ""),
                    description=p.get("description", ""),
                    price=float(p.get("price", 0.0)),
                    compare_at_price=float(p.get("compare_at_price")) if p.get("compare_at_price") else None,
                    stock=int(p.get("total_inventory", 50)),
                    category=p.get("category", "General"),
                    sku=sku,
                    image_url=p.get("images", [""])[0] if p.get("images") else None,
                    images_json=p.get("images", []),
                    tags_json=p.get("tags", []),
                    variants_json=variants,
                    attributes_json=p.get("attributes", {}),
                    source_url=p.get("source_url"),
                    in_stock=p.get("in_stock", True)
                ))
                migrated_prods += 1
        await session.commit()
        print(f"Migrated {migrated_prods} products to relational database.")

        # 5. Migrate Commerce Orders
        orders = aaas_data.get("commerce_orders", [])
        migrated_orders = 0
        for o in orders:
            res = await session.execute(select(OrderModel).where(OrderModel.id == o["id"]))
            if not res.scalar_one_or_none():
                session.add(OrderModel(
                    id=o["id"],
                    workspace_id=o.get("workspace_id", "ws_acme_corp"),
                    order_number=o.get("order_number", ""),
                    customer_id=o.get("customer_id"),
                    customer_name=o.get("customer_name", "Valued Customer"),
                    customer_email=o.get("customer_email", ""),
                    total_amount=float(o.get("total_amount", 0.0)),
                    currency=o.get("currency", "INR"),
                    status=o.get("status", "PAID"),
                    payment_status=o.get("payment_status", "PAID"),
                    fulfillment_status=o.get("fulfillment_status", "UNFULFILLED"),
                    shipping_address=o.get("shipping_address"),
                    tracking_number=o.get("tracking_number"),
                    carrier=o.get("carrier", "Bluedart Express"),
                    items_json=o.get("items", [])
                ))
                migrated_orders += 1
        await session.commit()
        print(f"Migrated {migrated_orders} orders to relational database.")

        # 6. Migrate AI Mode Configs
        for cfg in ai_data.get("configs", []):
            ws_id = cfg.get("workspace_id")
            if isinstance(ws_id, str):
                res = await session.execute(select(AIModeConfigModel).where(AIModeConfigModel.workspace_id == ws_id))
                if not res.scalar_one_or_none():
                    session.add(AIModeConfigModel(
                        id=cfg.get("id", f"aimode_cfg_{ws_id}"),
                        workspace_id=ws_id,
                        enabled=cfg.get("enabled", True),
                        model_provider=cfg.get("model_provider", "sarvam"),
                        model_name=cfg.get("model_name", "sarvam-105b-conversations"),
                        temperature=float(cfg.get("temperature", 0.3)),
                        retrieval_threshold=float(cfg.get("retrieval_threshold", 0.25)),
                        max_search_results=int(cfg.get("max_search_results", 6)),
                        enable_recommendations=cfg.get("enable_recommendations", True),
                        enable_comparisons=cfg.get("enable_comparisons", True),
                        enable_cart_actions=cfg.get("enable_cart_actions", True),
                        system_instructions=cfg.get("system_instructions", "")
                    ))
        await session.commit()

        # 7. Migrate Deployments
        for dep in ai_data.get("deployments", []):
            res = await session.execute(select(DeploymentModel).where(DeploymentModel.id == dep["id"]))
            if not res.scalar_one_or_none():
                session.add(DeploymentModel(
                    id=dep["id"],
                    workspace_id=dep.get("workspace_id", "ws_acme_corp"),
                    name=dep.get("name", "Storefront Widget"),
                    status=dep.get("status", "LIVE"),
                    allowed_domains=dep.get("allowed_domains", ["*"]),
                    theme_json=dep.get("theme", {}),
                    branding_json=dep.get("branding", {}),
                    embed_code=dep.get("embed_code", ""),
                    total_conversations=dep.get("total_conversations", 0),
                    total_product_clicks=dep.get("total_product_clicks", 0)
                ))
        await session.commit()

        print("=== Data Migration Completed Successfully! ===")

if __name__ == "__main__":
    asyncio.run(run_data_migration())
