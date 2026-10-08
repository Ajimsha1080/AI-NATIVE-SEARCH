import email.message
import smtplib

import httpx

from .config import settings


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
                return res.is_success
        except Exception as e:
            print(f"[EMAIL SERVICE ERROR] Resend dispatch failed: {e}")
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
            print(f"[EMAIL SERVICE ERROR] SMTP dispatch failed: {e}")
            return False

    # Provider not configured
    print(f"[EMAIL SERVICE NOTICE] Email provider not configured. Target: {to_email}, Subject: {subject}")
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
