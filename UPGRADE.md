# ShopMate AaaS Enterprise Upgrade Log

This document tracks all architectural, database, security, and operational improvements made to elevate ShopMate AaaS into an enterprise-grade multi-tenant e-commerce platform.

---

## Phase 1: Security Upgrades

### 1. Secret Sanitization & Exposure Mitigation
- **Compromised Key Incident**: A real Sarvam AI key (`sk_wgtub61j...`) was previously committed across multiple files.
- **Action Taken**:
  - Purged and sanitized key instances in `README.md`, `SECURITY.md`, `.env`, `.env.local`, and build artifacts.
  - Replaced all instances with clean placeholders (`sk_sarvam_placeholder_replace_in_env`).
  - Added `.gitleaks.toml` with enterprise scanning rules and allowlists for sample fixtures.
  - Updated `.github/workflows/security-scan.yml` to run automated secret scans on every push and pull request.
- **Operator Action Required**: Log in to the [Sarvam AI Console](https://dashboard.sarvam.ai) and rotate the compromised API key immediately.

### 2. Centralized Configuration with `pydantic-settings`
- Implemented [`python-backend/app/config.py`](file:///c:/Users/91730/Downloads/AI%20NATIVE%20SEARCH/python-backend/app/config.py) using `pydantic-settings`.
- Enforces strict startup validation:
  - Fails fast if `JWT_SECRET`, `SERVICE_JWT_SECRET`, or `ENCRYPTION_KEY` are under 32 characters in production.
  - Rejects known weak/default passwords (`test`, `secret`, `admin`, `password`, etc.).
  - Blocks development placeholders from running in `APP_ENV=production`.

### 3. Enterprise JWT Architecture (Access, Refresh, Revocation)
- **Short-Lived Access Tokens**: Configured with a 15-minute expiration time.
- **Refresh Tokens**: Configured with a 7-day expiration time.
- **Token Revocation (Denylist)**: Added in-memory token revocation list (Redis-ready) that checks JTIs and revoked tokens on every authenticated request.
- **Endpoints**:
  - `POST /api/v1/auth/login` – Returns `{ token, access_token, refresh_token, expires_in, user, workspace_id }`.
  - `POST /api/v1/auth/refresh` – Verifies refresh token and issues a new access token.
  - `POST /api/v1/auth/logout` – Revokes access and refresh tokens.

### 4. Tenant & IP Rate Limiting Middleware
- Implemented [`EnterpriseRateLimiterMiddleware`](file:///c:/Users/91730/Downloads/AI%20NATIVE%20SEARCH/python-backend/app/middleware/rate_limiter.py) in FastAPI:
  - Sliding-window algorithm keyed by `endpoint + workspace_id + client_ip`.
  - Limits:
    - `/api/v1/auth/*`: 20 requests/minute.
    - `/api/v1/ai-mode/search`: 60 requests/minute.
    - `/api/v1/ai-mode/chat`: 30 requests/minute.
  - Returns `429 Too Many Requests` with a standard `Retry-After` header when thresholds are reached.

### 5. Razorpay Cryptographic Verification & Idempotency
- **Cryptographic Signatures**: Genuine HMAC-SHA256 signature verification for `/api/v1/commerce/razorpay/verify` and `/api/v1/webhooks/razorpay`.
- **Server-Side Pricing**: Ignored client-supplied payment amounts; the server dynamically calculates total amounts strictly from canonical catalog pricing.
- **Idempotency Keys**: Added `Idempotency-Key` header and payload support to `/api/v1/commerce/razorpay/create-order` to prevent double charges and replay attacks.

---

## Rollback & Emergency Procedures (Phase 1)
- If token validation errors occur due to custom secrets, ensure that `JWT_SECRET` and `SERVICE_JWT_SECRET` in `.env` are at least 32 characters long.
- In local development mode (`APP_ENV=development`), the system falls back to default 32-byte development secrets automatically.
