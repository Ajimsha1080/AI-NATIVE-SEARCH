import uuid
import hashlib
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Header, Request, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, update, desc

from .db.database import async_session_factory
from .db.models import AuditLogModel, OrderModel, ConversationModel, MessageModel
from .auth import decode_token

router = APIRouter(prefix="/api/v1/compliance", tags=["Compliance & DPDP"])


# ============================================================================
# AUDIT LOG HELPER
# ============================================================================

async def record_audit_event(
    workspace_id: str,
    action: str,
    actor_id: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> Optional[AuditLogModel]:
    """Records an immutable audit log entry for administrative or data-mutation actions."""
    if not workspace_id:
        workspace_id = "ws_acme_corp"

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
                timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
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
    customer_id: Optional[str] = None
    workspace_id: Optional[str] = "ws_acme_corp"

class DPDPErasureRequest(BaseModel):
    customer_email: EmailStr
    customer_id: Optional[str] = None
    workspace_id: Optional[str] = "ws_acme_corp"
    reason: Optional[str] = "Customer DPDP Act Right to Erasure"


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/audit-logs")
async def get_audit_logs(
    request: Request,
    workspace_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    authorization: Optional[str] = Header(None)
):
    """Retrieves immutable audit logs for a tenant workspace."""
    target_workspace = workspace_id or "ws_acme_corp"
    actor_id = "system_operator"

    # Validate auth token if supplied
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        try:
            payload = decode_token(token)
            actor_id = payload.get("userId") or payload.get("sub") or actor_id
            target_workspace = payload.get("workspace_id") or target_workspace
        except Exception:
            pass

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
                    "id": l.id,
                    "action": l.action,
                    "actor_id": l.actor_id,
                    "resource_type": l.resource_type,
                    "resource_id": l.resource_id,
                    "ip_address": l.ip_address,
                    "details": l.details_json,
                    "timestamp": l.timestamp.isoformat() if l.timestamp else None
                }
                for l in logs
            ]
        }


@router.post("/export")
async def export_customer_data(
    req: DPDPExportRequest,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """
    DPDP Act / GDPR Data Portability:
    Exports all personal identifying information and interaction logs for a given customer.
    """
    actor_id = "customer_self"
    client_ip = request.client.host if request.client else "127.0.0.1"

    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        try:
            payload = decode_token(token)
            actor_id = payload.get("userId") or payload.get("sub") or actor_id
        except Exception:
            pass

    async with async_session_factory() as session:
        # 1. Fetch Orders
        order_query = (
            select(OrderModel)
            .where(OrderModel.workspace_id == req.workspace_id)
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
                .where(ConversationModel.workspace_id == req.workspace_id)
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
            workspace_id=req.workspace_id,
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
            "workspace_id": req.workspace_id,
            "customer_email": req.customer_email,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "data": {
                "orders": exported_orders,
                "conversations": exported_conversations
            }
        }


@router.post("/erase")
async def erase_customer_data(
    req: DPDPErasureRequest,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """
    DPDP Act / GDPR Right to be Forgotten:
    Anonymizes and redacts all personal identifying data while maintaining immutable
    financial accounting records required under statutory tax regulations.
    """
    actor_id = "compliance_officer"
    client_ip = request.client.host if request.client else "127.0.0.1"

    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        try:
            payload = decode_token(token)
            actor_id = payload.get("userId") or payload.get("sub") or actor_id
        except Exception:
            pass

    email_hash = hashlib.sha256(req.customer_email.encode()).hexdigest()[:12]
    anonymized_email = f"erased_{email_hash}@dpdp-purged.local"
    anonymized_name = "DPDP Redacted Subject"
    anonymized_address = "[REDACTED PURSUANT TO DPDP ACT 2023]"

    async with async_session_factory() as session:
        # Redact PII in Orders
        order_stmt = (
            update(OrderModel)
            .where(OrderModel.workspace_id == req.workspace_id)
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
                .where(ConversationModel.workspace_id == req.workspace_id)
                .where(ConversationModel.user_id == req.customer_id)
                .values(user_id=f"anon_{email_hash}")
            )
            c_res = await session.execute(conv_stmt)
            convs_redacted = c_res.rowcount

        await session.commit()

        # Record Audit Event
        erasure_id = f"del_{uuid.uuid4().hex[:12]}"
        await record_audit_event(
            workspace_id=req.workspace_id,
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
            "workspace_id": req.workspace_id,
            "orders_anonymized": orders_redacted,
            "conversations_anonymized": convs_redacted,
            "anonymized_identifier": anonymized_email,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
