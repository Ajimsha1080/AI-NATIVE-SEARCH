import abc
import hashlib
import hmac
from typing import Any

from app.config import settings


class BillingProvider(abc.ABC):
    """Abstract interface for billing and subscription providers (Razorpay, Stripe, etc.)."""

    @abc.abstractmethod
    async def create_customer(self, name: str, email: str) -> str:
        """Create or fetch a customer record with the payment provider."""
        pass

    @abc.abstractmethod
    async def create_subscription(
        self,
        customer_id: str | None,
        plan_code: str,
        plan_amount: float,
        plan_currency: str = "INR",
        total_count: int = 12,
        notes: dict[str, str] | None = None
    ) -> dict[str, Any]:
        """Create a recurring subscription checkout session or subscription object."""
        pass

    @abc.abstractmethod
    async def cancel_subscription(
        self,
        subscription_id: str,
        cancel_at_cycle_end: bool = True
    ) -> dict[str, Any]:
        """Cancel an active subscription."""
        pass

    @abc.abstractmethod
    def verify_webhook_signature(
        self,
        body_bytes: bytes,
        signature: str,
        secret: str
    ) -> bool:
        """Cryptographically verify the authenticity of an incoming provider webhook payload."""
        pass


class RazorpayBillingProvider(BillingProvider):
    """Production Razorpay recurring subscriptions provider."""

    def __init__(self, key_id: str | None = None, key_secret: str | None = None):
        self.key_id = key_id or settings.RAZORPAY_KEY_ID or ""
        self.key_secret = key_secret or settings.RAZORPAY_KEY_SECRET or ""
        self.base_url = "https://api.razorpay.com/v1"

    async def create_customer(self, name: str, email: str) -> str:
        import base64

        import httpx

        is_production = settings.APP_ENV.lower() == "production"

        if not self.key_id or not self.key_secret:
            if is_production:
                raise RuntimeError("Razorpay billing provider is missing API credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) in production.")
            return f"cust_sim_{hashlib.md5(email.encode()).hexdigest()[:12]}"

        auth_header = base64.b64encode(f"{self.key_id}:{self.key_secret}".encode()).decode()
        headers = {
            "Authorization": f"Basic {auth_header}",
            "Content-Type": "application/json"
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                res = await client.post(
                    f"{self.base_url}/customers",
                    headers=headers,
                    json={"name": name, "email": email}
                )
                if res.is_success:
                    return res.json().get("id", f"cust_{hashlib.md5(email.encode()).hexdigest()[:12]}")
                elif is_production:
                    raise RuntimeError(f"Razorpay customer creation failed ({res.status_code}): {res.text}")
            except Exception as exc:
                if is_production:
                    raise RuntimeError(f"Razorpay customer creation network failure: {exc}") from exc
        return f"cust_{hashlib.md5(email.encode()).hexdigest()[:12]}"

    async def create_subscription(
        self,
        customer_id: str | None,
        plan_code: str,
        plan_amount: float,
        plan_currency: str = "INR",
        total_count: int = 12,
        notes: dict[str, str] | None = None
    ) -> dict[str, Any]:
        import base64
        import uuid

        import httpx

        is_production = settings.APP_ENV.lower() == "production"
        notes = notes or {}

        if not self.key_id or not self.key_secret:
            if is_production:
                raise RuntimeError("Razorpay billing provider credentials missing in production.")
            sub_id = f"sub_sim_{uuid.uuid4().hex[:14]}"
            return {
                "id": sub_id,
                "provider_subscription_id": sub_id,
                "plan_code": plan_code,
                "amount": plan_amount,
                "currency": plan_currency,
                "status": "created",
                "short_url": f"https://rzp.io/i/{sub_id}",
            }

        auth_header = base64.b64encode(f"{self.key_id}:{self.key_secret}".encode()).decode()
        headers = {
            "Authorization": f"Basic {auth_header}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            plan_payload = {
                "period": "monthly",
                "interval": 1,
                "item": {
                    "name": f"ShopMate {plan_code.capitalize()} Plan",
                    "amount": int(plan_amount * 100),  # In paise
                    "currency": plan_currency,
                    "description": f"Monthly subscription to ShopMate {plan_code}"
                },
                "notes": notes
            }
            rzp_plan_id = None
            try:
                plan_res = await client.post(f"{self.base_url}/plans", headers=headers, json=plan_payload)
                if plan_res.is_success:
                    rzp_plan_id = plan_res.json().get("id")
                elif is_production:
                    raise RuntimeError(f"Razorpay plan creation failed ({plan_res.status_code}): {plan_res.text}")
            except Exception as exc:
                if is_production:
                    raise RuntimeError(f"Razorpay plan API failure: {exc}") from exc

            if not rzp_plan_id:
                if is_production:
                    raise RuntimeError(f"Could not establish valid Razorpay plan for plan '{plan_code}'.")
                sub_id = f"sub_{uuid.uuid4().hex[:14]}"
                return {
                    "id": sub_id,
                    "provider_subscription_id": sub_id,
                    "plan_code": plan_code,
                    "amount": plan_amount,
                    "currency": plan_currency,
                    "status": "created",
                    "short_url": f"https://rzp.io/i/{sub_id}"
                }

            sub_payload = {
                "plan_id": rzp_plan_id,
                "total_count": total_count,
                "quantity": 1,
                "customer_notify": 1,
                "notes": notes
            }
            if customer_id:
                sub_payload["customer_id"] = customer_id

            try:
                sub_res = await client.post(f"{self.base_url}/subscriptions", headers=headers, json=sub_payload)
                if sub_res.is_success:
                    data = sub_res.json()
                    return {
                        "id": data.get("id"),
                        "provider_subscription_id": data.get("id"),
                        "plan_code": plan_code,
                        "amount": plan_amount,
                        "currency": plan_currency,
                        "status": data.get("status", "created"),
                        "short_url": data.get("short_url") or f"https://rzp.io/i/{data.get('id')}",
                    }
                elif is_production:
                    raise RuntimeError(f"Razorpay subscription creation failed ({sub_res.status_code}): {sub_res.text}")
            except Exception as exc:
                if is_production:
                    raise RuntimeError(f"Razorpay subscription API failure: {exc}") from exc

        if is_production:
            raise RuntimeError("Failed to create subscription with Razorpay provider.")

        sub_id = f"sub_{uuid.uuid4().hex[:14]}"
        return {
            "id": sub_id,
            "provider_subscription_id": sub_id,
            "plan_code": plan_code,
            "amount": plan_amount,
            "currency": plan_currency,
            "status": "created",
            "short_url": f"https://rzp.io/i/{sub_id}"
        }

    async def cancel_subscription(
        self,
        subscription_id: str,
        cancel_at_cycle_end: bool = True
    ) -> dict[str, Any]:
        import base64

        import httpx

        is_production = settings.APP_ENV.lower() == "production"

        if not self.key_id or not self.key_secret or subscription_id.startswith("sub_sim_"):
            if is_production:
                raise RuntimeError("Razorpay API credentials missing for subscription cancellation in production.")
            return {"id": subscription_id, "status": "cancelled", "cancel_at_cycle_end": cancel_at_cycle_end}

        auth_header = base64.b64encode(f"{self.key_id}:{self.key_secret}".encode()).decode()
        headers = {
            "Authorization": f"Basic {auth_header}",
            "Content-Type": "application/json"
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                payload = {"cancel_at_cycle_end": 1 if cancel_at_cycle_end else 0}
                res = await client.post(f"{self.base_url}/subscriptions/{subscription_id}/cancel", headers=headers, json=payload)
                if res.is_success:
                    return res.json()
                elif is_production:
                    raise RuntimeError(f"Razorpay cancel subscription failed ({res.status_code}): {res.text}")
            except Exception as exc:
                if is_production:
                    raise RuntimeError(f"Razorpay cancel subscription API failure: {exc}") from exc

        if is_production:
            raise RuntimeError(f"Failed to cancel subscription '{subscription_id}' in production.")

        return {"id": subscription_id, "status": "cancelled", "cancel_at_cycle_end": cancel_at_cycle_end}

    def verify_webhook_signature(
        self,
        body_bytes: bytes,
        signature: str,
        secret: str
    ) -> bool:
        if not signature or not secret:
            return False
        expected_sig = hmac.new(
            secret.encode("utf-8"),
            body_bytes,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected_sig, signature)


def get_billing_provider() -> BillingProvider:
    """Factory function returning the active billing provider."""
    # Extensible for Stripe: if settings.BILLING_PROVIDER == "stripe": return StripeBillingProvider()
    return RazorpayBillingProvider()
