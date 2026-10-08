import hashlib
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy import desc, select, update

from .auth import AuthContext, require_admin_role, validate_workspace_access
from .db.database import async_session_factory
from .db.models import AuditLogModel, ConversationModel, OrderModel

router = APIRouter(prefix="/api/v1/compliance", tags=["Compliance & DPDP"])


# ============================================================================
# AUDIT LOG HELPER
# ============================================================================

async def record_audit_event(
    workspace_id: str,
    action: str,
    actor_id: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    ip_address: str | None = None,
    details: dict[str, Any] | None = None,
) -> AuditLogModel | None:
    """Records an immutable audit log entry for administrative or data-mutation actions."""
    if not workspace_id:
        return None

    try:
        async with async_session_factory() as session:
            entry = AuditLogModel(
                id=f"aud_{uuid.uuid4().hex[:16]}",
                workspace_id=workspace_id,
                action=action,
                actor_id=actor_id,
                resource_type=resource_type,
                resource_id=resource_id,
                ip_address=ip_address,
                details_json=details or {},
                timestamp=datetime.now(UTC).replace(tzinfo=None)
            )
            session.add(entry)
            await session.commit()
            await session.refresh(entry)
            return entry
    except Exception as e:
        # Fallback logging to prevent hard failures on auditing hiccups
        print(f"[AUDIT LOG WARNING] Failed to record audit event: {e}")
        return None


# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class DPDPExportRequest(BaseModel):
    customer_email: EmailStr
    customer_id: str | None = None
    workspace_id: str | None = None

class DPDPErasureRequest(BaseModel):
    customer_email: EmailStr
    customer_id: str | None = None
    workspace_id: str | None = None
    reason: str | None = "Customer DPDP Act Right to Erasure"


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/audit-logs")
async def get_audit_logs(
    request: Request,
    workspace_id: str | None = Query(None),
    action: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    auth: AuthContext = Depends(require_admin_role)
):
    """Retrieves immutable audit logs for a tenant workspace."""
    target_workspace = validate_workspace_access(auth, workspace_id)

    async with async_session_factory() as session:
        query = (
            select(AuditLogModel)
            .where(AuditLogModel.workspace_id == target_workspace)
            .order_by(desc(AuditLogModel.timestamp))
        )
        if action:
            query = query.where(AuditLogModel.action == action)

        query = query.offset(offset).limit(limit)
        result = await session.execute(query)
        logs = result.scalars().all()

        return {
            "workspace_id": target_workspace,
            "total_returned": len(logs),
            "limit": limit,
            "offset": offset,
            "audit_logs": [
                {
                    "id": entry.id,
                    "action": entry.action,
                    "actor_id": entry.actor_id,
                    "resource_type": entry.resource_type,
                    "resource_id": entry.resource_id,
                    "ip_address": entry.ip_address,
                    "details": entry.details_json,
                    "timestamp": entry.timestamp.isoformat() if entry.timestamp else None
                }
                for entry in logs
            ]
        }


@router.post("/export")
async def export_customer_data(
    req: DPDPExportRequest,
    request: Request,
    auth: AuthContext = Depends(require_admin_role)
):
    """
    DPDP Act / GDPR Data Portability:
    Exports all personal identifying information and interaction logs for a given customer.
    """
    target_workspace = validate_workspace_access(auth, req.workspace_id)
    actor_id = auth.user_id
    client_ip = request.client.host if request.client else "127.0.0.1"

    async with async_session_factory() as session:
        # 1. Fetch Orders
        order_query = (
            select(OrderModel)
            .where(OrderModel.workspace_id == target_workspace)
            .where(OrderModel.customer_email == req.customer_email)
        )
        orders_result = await session.execute(order_query)
        orders = orders_result.scalars().all()

        exported_orders = [
            {
                "order_id": o.id,
                "order_number": o.order_number,
                "customer_name": o.customer_name,
                "customer_email": o.customer_email,
                "total_amount": o.total_amount,
                "currency": o.currency,
                "status": o.status,
                "payment_status": o.payment_status,
                "fulfillment_status": o.fulfillment_status,
                "shipping_address": o.shipping_address,
                "tracking_number": o.tracking_number,
                "items": o.items_json,
                "created_at": o.created_at.isoformat() if o.created_at else None
            }
            for o in orders
        ]

        # 2. Fetch User Conversations if customer_id provided
        exported_conversations = []
        if req.customer_id:
            conv_query = (
                select(ConversationModel)
                .where(ConversationModel.workspace_id == target_workspace)
                .where(ConversationModel.user_id == req.customer_id)
            )
            conv_res = await session.execute(conv_query)
            convs = conv_res.scalars().all()
            for c in convs:
                exported_conversations.append({
                    "conversation_id": c.id,
                    "title": c.title,
                    "status": c.status,
                    "created_at": c.created_at.isoformat() if c.created_at else None
                })

        # 3. Log Audit Event
        export_id = f"exp_{uuid.uuid4().hex[:12]}"
        await record_audit_event(
            workspace_id=target_workspace,
            action="CUSTOMER_DATA_EXPORT",
            actor_id=actor_id,
            resource_type="customer_data",
            resource_id=req.customer_email,
            ip_address=client_ip,
            details={
                "export_id": export_id,
                "orders_count": len(exported_orders),
                "conversations_count": len(exported_conversations),
                "compliance_framework": "DPDP_ACT_2023"
            }
        )

        return {
            "status": "COMPLETED",
            "dpdp_export_id": export_id,
            "compliance_standard": "Digital Personal Data Protection Act 2023",
            "workspace_id": target_workspace,
            "customer_email": req.customer_email,
            "exported_at": datetime.now(UTC).isoformat(),
            "data": {
                "orders": exported_orders,
                "conversations": exported_conversations
            }
        }


@router.post("/erase")
async def erase_customer_data(
    req: DPDPErasureRequest,
    request: Request,
    auth: AuthContext = Depends(require_admin_role)
):
    """
    DPDP Act / GDPR Right to be Forgotten:
    Anonymizes and redacts all personal identifying data while maintaining immutable
    financial accounting records required under statutory tax regulations.
    """
    target_workspace = validate_workspace_access(auth, req.workspace_id)
    actor_id = auth.user_id
    client_ip = request.client.host if request.client else "127.0.0.1"

    email_hash = hashlib.sha256(req.customer_email.encode()).hexdigest()[:12]
    anonymized_email = f"erased_{email_hash}@dpdp-purged.local"
    anonymized_name = "DPDP Redacted Subject"
    anonymized_address = "[REDACTED PURSUANT TO DPDP ACT 2023]"

    async with async_session_factory() as session:
        # Redact PII in Orders
        order_stmt = (
            update(OrderModel)
            .where(OrderModel.workspace_id == target_workspace)
            .where(OrderModel.customer_email == req.customer_email)
            .values(
                customer_name=anonymized_name,
                customer_email=anonymized_email,
                shipping_address=anonymized_address
            )
        )
        res = await session.execute(order_stmt)
        orders_redacted = res.rowcount

        # Anonymize Conversations
        convs_redacted = 0
        if req.customer_id:
            conv_stmt = (
                update(ConversationModel)
                .where(ConversationModel.workspace_id == target_workspace)
                .where(ConversationModel.user_id == req.customer_id)
                .values(user_id=f"anon_{email_hash}")
            )
            c_res = await session.execute(conv_stmt)
            convs_redacted = c_res.rowcount

        await session.commit()

        # Record Audit Event
        erasure_id = f"del_{uuid.uuid4().hex[:12]}"
        await record_audit_event(
            workspace_id=target_workspace,
            action="CUSTOMER_DATA_ERASURE",
            actor_id=actor_id,
            resource_type="customer_data",
            resource_id=req.customer_email,
            ip_address=client_ip,
            details={
                "erasure_id": erasure_id,
                "reason": req.reason,
                "orders_redacted": orders_redacted,
                "conversations_redacted": convs_redacted,
                "anonymized_handle": anonymized_email,
                "compliance_framework": "DPDP_ACT_2023"
            }
        )

        return {
            "status": "COMPLETED",
            "erasure_id": erasure_id,
            "compliance_standard": "Digital Personal Data Protection Act 2023",
            "workspace_id": target_workspace,
            "orders_anonymized": orders_redacted,
            "conversations_anonymized": convs_redacted,
            "anonymized_identifier": anonymized_email,
            "timestamp": datetime.now(UTC).isoformat()
        }
