"""add_billing_and_subscriptions

Revision ID: d4e5f6a1b2c3
Revises: c3d4e5f6a1b2
Create Date: 2026-10-09 02:45:00.000000

"""
from collections.abc import Sequence
import datetime
import json
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a1b2c3'
down_revision: str | Sequence[str] | None = 'c3d4e5f6a1b2'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_PLANS = [
    {
        "code": "free",
        "name": "Free Tier",
        "price": 0.0,
        "currency": "INR",
        "interval": "monthly",
        "description": "Essential AI Search & Chat for hobby stores and trial evaluations.",
        "limits_json": json.dumps({
            "search_requests_per_month": 1000,
            "tokens_per_month": 100000,
            "products": 50,
            "knowledge_docs": 2,
            "crawl_runs": 2,
            "seats": 1,
            "llm_cost_cap_usd": 5.0
        }),
        "is_active": True,
    },
    {
        "code": "starter",
        "name": "Starter",
        "price": 1999.0,
        "currency": "INR",
        "interval": "monthly",
        "description": "Ideal for growing independent e-commerce stores.",
        "limits_json": json.dumps({
            "search_requests_per_month": 10000,
            "tokens_per_month": 1000000,
            "products": 500,
            "knowledge_docs": 10,
            "crawl_runs": 10,
            "seats": 3,
            "llm_cost_cap_usd": 25.0
        }),
        "is_active": True,
    },
    {
        "code": "pro",
        "name": "Pro Growth",
        "price": 7999.0,
        "currency": "INR",
        "interval": "monthly",
        "description": "Full-power AI discovery, large catalogs and team collaboration.",
        "limits_json": json.dumps({
            "search_requests_per_month": 50000,
            "tokens_per_month": 5000000,
            "products": 2500,
            "knowledge_docs": 50,
            "crawl_runs": 50,
            "seats": 10,
            "llm_cost_cap_usd": 100.0
        }),
        "is_active": True,
    },
    {
        "code": "enterprise",
        "name": "Enterprise Scale",
        "price": 24999.0,
        "currency": "INR",
        "interval": "monthly",
        "description": "Custom scale, unlimited crawl pipelines and highest token throughput.",
        "limits_json": json.dumps({
            "search_requests_per_month": 500000,
            "tokens_per_month": 50000000,
            "products": 25000,
            "knowledge_docs": 500,
            "crawl_runs": 500,
            "seats": 50,
            "llm_cost_cap_usd": 500.0
        }),
        "is_active": True,
    }
]

def upgrade() -> None:
    # 1. billing_plans table
    plans_table = op.create_table(
        'billing_plans',
        sa.Column('code', sa.String(length=64), primary_key=True),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('price', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(length=8), server_default='INR', nullable=False),
        sa.Column('interval', sa.String(length=32), server_default='monthly', nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('limits_json', sa.JSON(), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # 2. billing_subscriptions table
    op.create_table(
        'billing_subscriptions',
        sa.Column('id', sa.String(length=64), primary_key=True),
        sa.Column('workspace_id', sa.String(length=64), sa.ForeignKey('workspaces.id'), nullable=False),
        sa.Column('plan_code', sa.String(length=64), sa.ForeignKey('billing_plans.code'), nullable=False),
        sa.Column('status', sa.String(length=32), server_default='TRIALING', nullable=False),
        sa.Column('current_period_start', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('current_period_end', sa.DateTime(), nullable=True),
        sa.Column('trial_end', sa.DateTime(), nullable=True),
        sa.Column('cancel_at_period_end', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('grace_period_end', sa.DateTime(), nullable=True),
        sa.Column('provider', sa.String(length=32), server_default='razorpay', nullable=False),
        sa.Column('provider_customer_id', sa.String(length=128), nullable=True),
        sa.Column('provider_subscription_id', sa.String(length=128), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_sub_workspace', 'billing_subscriptions', ['workspace_id'])
    op.create_index('idx_sub_tenant_status', 'billing_subscriptions', ['workspace_id', 'status'])
    op.create_index('idx_sub_provider_id', 'billing_subscriptions', ['provider_subscription_id'])

    # 3. billing_invoices table
    op.create_table(
        'billing_invoices',
        sa.Column('id', sa.String(length=64), primary_key=True),
        sa.Column('workspace_id', sa.String(length=64), sa.ForeignKey('workspaces.id'), nullable=False),
        sa.Column('subscription_id', sa.String(length=64), sa.ForeignKey('billing_subscriptions.id'), nullable=True),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(length=8), server_default='INR', nullable=False),
        sa.Column('status', sa.String(length=32), server_default='PAID', nullable=False),
        sa.Column('invoice_pdf_url', sa.String(length=512), nullable=True),
        sa.Column('provider_invoice_id', sa.String(length=128), nullable=True),
        sa.Column('provider_payment_id', sa.String(length=128), nullable=True),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        sa.Column('billing_period_start', sa.DateTime(), nullable=True),
        sa.Column('billing_period_end', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_invoice_workspace', 'billing_invoices', ['workspace_id'])
    op.create_index('idx_invoice_tenant_date', 'billing_invoices', ['workspace_id', 'created_at'])
    op.create_index('idx_invoice_provider_id', 'billing_invoices', ['provider_invoice_id'])

    # 4. billing_webhook_events table
    op.create_table(
        'billing_webhook_events',
        sa.Column('id', sa.String(length=64), primary_key=True),
        sa.Column('provider', sa.String(length=32), nullable=False),
        sa.Column('event_id', sa.String(length=128), nullable=False),
        sa.Column('event_type', sa.String(length=128), nullable=False),
        sa.Column('payload_json', sa.JSON(), nullable=False),
        sa.Column('processed_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_billing_wh_event_id', 'billing_webhook_events', ['event_id'], unique=True)
    op.create_index('idx_billing_wh_type', 'billing_webhook_events', ['event_type'])

    # Seed default plans
    op.bulk_insert(
        plans_table,
        [
            {
                "code": p["code"],
                "name": p["name"],
                "price": p["price"],
                "currency": p["currency"],
                "interval": p["interval"],
                "description": p["description"],
                "limits_json": json.loads(p["limits_json"]),
                "is_active": p["is_active"],
            }
            for p in DEFAULT_PLANS
        ]
    )

    # Enable RLS on PostgreSQL for multi-tenant billing tables
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        for table in ['billing_subscriptions', 'billing_invoices']:
            try:
                op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
                op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")
                op.execute(
                    f"""
                    CREATE POLICY {table}_tenant_isolation_policy ON {table}
                    USING (workspace_id = COALESCE(
                        NULLIF(current_setting('app.workspace_id', true), ''),
                        NULLIF(current_setting('app.current_workspace_id', true), '')
                    ))
                    WITH CHECK (workspace_id = COALESCE(
                        NULLIF(current_setting('app.workspace_id', true), ''),
                        NULLIF(current_setting('app.current_workspace_id', true), '')
                    ));
                    """
                )
            except Exception:
                pass


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        for table in ['billing_invoices', 'billing_subscriptions']:
            try:
                op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation_policy ON {table};")
            except Exception:
                pass
    op.drop_table('billing_webhook_events')
    op.drop_table('billing_invoices')
    op.drop_table('billing_subscriptions')
    op.drop_table('billing_plans')
