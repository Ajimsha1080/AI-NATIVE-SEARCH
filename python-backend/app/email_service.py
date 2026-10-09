import email.message
import logging
import smtplib

import httpx

from .config import settings

logger = logging.getLogger("shopmate_email_service")


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str | None = None
) -> bool:
    """
    Sends an email using configured SMTP provider or Resend API.
    Returns True if sent, False if provider failed or not configured.
    """
    # 1. Try Resend API if configured
    if settings.RESEND_API_KEY:
        try:
            url = "https://api.resend.com/emails"
            payload = {
                "from": settings.SMTP_FROM_EMAIL,
                "to": [to_email],
                "subject": subject,
                "html": html_content,
                "text": text_content or html_content
            }
            headers = {
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json"
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload, headers=headers)
                if not res.is_success:
                    logger.error("Resend dispatch returned non-200 (%s): %s", res.status_code, res.text)
                return res.is_success
        except Exception as e:
            logger.exception("Resend dispatch failed to %s: %s", to_email, e)
            return False

    # 2. Try SMTP if configured
    if settings.SMTP_HOST:
        try:
            msg = email.message.EmailMessage()
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_FROM_EMAIL
            msg["To"] = to_email
            msg.set_content(text_content or html_content)
            msg.add_alternative(html_content, subtype="html")

            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
            server.quit()
            return True
        except Exception as e:
            logger.exception("SMTP dispatch failed to %s: %s", to_email, e)
            return False

    # Provider not configured
    logger.info("Email provider not configured. Target: %s, Subject: %s", to_email, subject)
    return False


async def send_verification_email(to_email: str, token: str, user_name: str = "User") -> bool:
    verify_url = f"{settings.FRONTEND_URL}/auth/verify-email?token={token}"
    subject = "Verify your ShopMate AaaS Account"
    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
        <h2>Welcome to ShopMate AaaS, {user_name}!</h2>
        <p>Please click the button below to verify your email address and activate your merchant account:</p>
        <p style="margin: 30px 0;">
            <a href="{verify_url}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Verify Email Address
            </a>
        </p>
        <p>Or copy this link into your browser: <br><a href="{verify_url}">{verify_url}</a></p>
        <p style="color: #666; font-size: 12px; margin-top: 40px;">This single-use link expires in 24 hours.</p>
    </div>
    """
    return await send_email(to_email, subject, html)


async def send_password_reset_email(to_email: str, token: str, user_name: str = "User") -> bool:
    reset_url = f"{settings.FRONTEND_URL}/auth/reset-password?token={token}"
    subject = "Reset your ShopMate AaaS Password"
    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
        <h2>Password Reset Request</h2>
        <p>Hello {user_name},</p>
        <p>We received a request to reset your password. Click the button below to choose a new password:</p>
        <p style="margin: 30px 0;">
            <a href="{reset_url}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Reset Password
            </a>
        </p>
        <p>Or copy this link into your browser: <br><a href="{reset_url}">{reset_url}</a></p>
        <p style="color: #666; font-size: 12px; margin-top: 40px;">This single-use link expires in 1 hour. If you did not request this, please ignore this email.</p>
    </div>
    """
    return await send_email(to_email, subject, html)


async def send_trial_ending_email(to_email: str, workspace_name: str, days_left: int = 3) -> bool:
    billing_url = f"{settings.FRONTEND_URL}/ai-mode/billing"
    subject = f"Your ShopMate AaaS free trial is ending in {days_left} days"
    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
        <h2>Free Trial Expiring Soon</h2>
        <p>Your trial for workspace <strong>{workspace_name}</strong> will conclude in {days_left} days.</p>
        <p>To avoid any disruption to your AI search, live product sync, or customer chat widgets, please choose a subscription plan:</p>
        <p style="margin: 30px 0;">
            <a href="{billing_url}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                View Plans & Upgrade
            </a>
        </p>
        <p>Have questions? Reply to this email and our team will assist you.</p>
    </div>
    """
    return await send_email(to_email, subject, html)


async def send_payment_failed_email(to_email: str, workspace_name: str, amount: float, currency: str = "INR", grace_days: int = 3) -> bool:
    billing_url = f"{settings.FRONTEND_URL}/ai-mode/billing"
    subject = f"Action Required: Subscription payment failed for {workspace_name}"
    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
        <h2>Payment Failed</h2>
        <p>We were unable to process the recurring payment of <strong>{currency} {amount:,.2f}</strong> for <strong>{workspace_name}</strong>.</p>
        <p>A grace period of {grace_days} days has been granted. Please update your payment method to ensure continued service without suspension.</p>
        <p style="margin: 30px 0;">
            <a href="{billing_url}" style="background-color: #e11d48; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Update Payment Details
            </a>
        </p>
    </div>
    """
    return await send_email(to_email, subject, html)


async def send_plan_changed_email(to_email: str, workspace_name: str, old_plan: str, new_plan: str) -> bool:
    billing_url = f"{settings.FRONTEND_URL}/ai-mode/billing"
    subject = f"Your ShopMate subscription has been updated to {new_plan}"
    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
        <h2>Subscription Plan Updated</h2>
        <p>Your workspace <strong>{workspace_name}</strong> has been updated from <strong>{old_plan}</strong> to <strong>{new_plan}</strong>.</p>
        <p>Your new feature limits and quotas are active immediately.</p>
        <p style="margin: 30px 0;">
            <a href="{billing_url}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Manage Subscription
            </a>
        </p>
    </div>
    """
    return await send_email(to_email, subject, html)


async def send_cost_cap_alert_email(to_email: str, workspace_name: str, percent: int, current_cost: float, cap_limit: float) -> bool:
    billing_url = f"{settings.FRONTEND_URL}/ai-mode/billing"
    subject = f"Warning: {workspace_name} has reached {percent}% of its monthly LLM cost cap"
    is_100 = percent >= 100
    color = "#e11d48" if is_100 else "#d97706"
    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
        <h2 style="color: {color};">LLM Cost Cap Alert ({percent}%)</h2>
        <p>Your workspace <strong>{workspace_name}</strong> has consumed <strong>${current_cost:,.2f}</strong> of its <strong>${cap_limit:,.2f}</strong> monthly AI budget.</p>
        <p>{"AI inference has been temporarily paused to prevent unexpected charges." if is_100 else "To ensure uninterrupted customer queries, consider upgrading your subscription tier."}</p>
        <p style="margin: 30px 0;">
            <a href="{billing_url}" style="background-color: {color}; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                View Usage & Upgrade
            </a>
        </p>
    </div>
    """
    return await send_email(to_email, subject, html)


async def send_team_invite_email(to_email: str, workspace_name: str, inviter_name: str, role: str, token: str) -> bool:
    invite_url = f"{settings.FRONTEND_URL}/auth/accept-invite?token={token}"
    subject = f"You've been invited to join {workspace_name} on ShopMate AaaS"
    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
        <h2>Join {workspace_name} on ShopMate</h2>
        <p>Hello,</p>
        <p><strong>{inviter_name}</strong> has invited you to collaborate on the <strong>{workspace_name}</strong> workspace as an <strong>{role}</strong>.</p>
        <p style="margin: 30px 0;">
            <a href="{invite_url}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Accept Invitation
            </a>
        </p>
        <p>Or copy this link into your browser: <br><a href="{invite_url}">{invite_url}</a></p>
        <p style="color: #666; font-size: 12px; margin-top: 40px;">This single-use invitation expires in 7 days.</p>
    </div>
    """
    return await send_email(to_email, subject, html)



