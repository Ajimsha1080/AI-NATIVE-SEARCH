# ShopMate AaaS - Production Upgrade & Operations Guide

This guide documents the production upgrade for **ShopMate AaaS** (Agent-as-a-Service & AI-Native Commerce Engine). The codebase has been transitioned to a production architecture: **all mock, demo, seeded, and hardcoded fake data have been removed**.

---

## 1. Environment Variables Reference

Configure these environment variables in your environment or production secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault, Kubernetes Secrets).

### Core Database & Caching
| Variable | Description | Production Example / Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string with `asyncpg` driver | `postgresql+asyncpg://shopmate_user:secret@postgres.internal:5432/shopmate_prod` |
| `REDIS_URL` | Redis instance for sliding-window rate limiting, token revocation denylist, and tenant usage metrics | `redis://:redis_password@redis.internal:6379/0` |

### Security & Authentication
| Variable | Description | Production Example / Default |
| :--- | :--- | :--- |
| `JWT_SECRET` | 256-bit secret key used to sign tenant & user JWT tokens | *(Generate with `openssl rand -hex 32`)* |
| `SERVICE_JWT_SECRET` | Secret key for internal microservice / worker IPC authentication | *(Generate with `openssl rand -hex 32`)* |
| `ADMIN_EMAIL` | Email used by the one-time admin bootstrap CLI | `admin@yourdomain.com` |
| `ADMIN_PASSWORD` | Initial password used by the one-time admin bootstrap CLI | Strong password (min 12 chars, letters, numbers, symbols) |

### Transactional Email (Verification & Password Reset)
| Variable | Description | Production Example / Default |
| :--- | :--- | :--- |
| `EMAIL_PROVIDER` | Active transactional email provider | `smtp` or `resend` |
| `SMTP_HOST` | Hostname of SMTP relay (e.g., SendGrid, Mailgun, Amazon SES) | `smtp.mailgun.org` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP authentication username | `postmaster@yourdomain.com` |
| `SMTP_PASSWORD` | SMTP authentication password | *(Secret)* |
| `SMTP_FROM` | Sender address shown on transactional emails | `noreply@yourdomain.com` |
| `RESEND_API_KEY` | API Key for Resend service (when `EMAIL_PROVIDER=resend`) | `re_123456789...` |
| `FRONTEND_URL` | Base URL of frontend application for verification & reset links | `https://app.yourdomain.com` |

### Payments (Razorpay)
| Variable | Description | Production Example / Default |
| :--- | :--- | :--- |
| `RAZORPAY_KEY_ID` | Live or test key ID provided by Razorpay dashboard | `rzp_live_...` |
| `RAZORPAY_KEY_SECRET` | Live or test key secret for HMAC-SHA256 signature verification | *(Secret)* |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook secret for authenticating incoming payment events | *(Secret)* |

### AI, Embeddings & LLM
| Variable | Description | Production Example / Default |
| :--- | :--- | :--- |
| `AI_PROVIDER` | Primary LLM inference provider | `sarvam`, `openai`, or `anthropic` |
| `SARVAM_API_KEY` | API key for Sarvam AI (Indic language models) | *(Secret)* |
| `OPENAI_API_KEY` | API key for OpenAI (GPT-4o, text-embedding-3-small) | *(Secret)* |
| `ANTHROPIC_API_KEY` | API key for Anthropic Claude | *(Secret)* |
| `EMBEDDING_PROVIDER` | Vector embedding model provider | `openai` or `sarvam` |
| `EMBEDDING_MODEL` | Specific embedding model identifier | `text-embedding-3-small` |

---

## 2. Database Migrations (Alembic)

All persistence operations use PostgreSQL with SQLAlchemy 2.0 and pgvector. Apply migrations in sequential order using Alembic:

```bash
cd python-backend
# Set your DATABASE_URL
export DATABASE_URL="postgresql+asyncpg://shopmate_user:secret@localhost:5432/shopmate_prod"

# Run migrations up to head
alembic upgrade head
```

### Migration History:
1. `ced8fcdd6f45_initial_schema.py`: Initial relational schema (Workspaces, Users, Memberships, Products, Orders, Conversations, Deployments, Knowledge).
2. `a1b2c3d4e5f6_add_auth_tokens_and_security_fields.py`: High-entropy single-use authentication tokens table (`auth_tokens`), account lockout tracking, email verification state.
3. `b2c3d4e5f6a1_add_idempotency_keys_and_sync_jobs.py`: Persistent payment idempotency keys (`idempotency_keys`) and background connector synchronization jobs (`sync_jobs`).
4. `c3d4e5f6a1b2_add_postgres_row_level_security.py`: Enforces PostgreSQL Row-Level Security (RLS) on all multi-tenant tables (`products`, `orders`, `knowledge`, `sync_jobs`, `idempotency_keys`, `audit_logs`).

---

## 3. How to Create the First Admin

The demo tenant seed script has been removed. Use the secure, one-time bootstrap script that provisions the root administrator and their workspace from environment variables:

```bash
cd python-backend

# 1. Export credentials
export ADMIN_EMAIL="admin@yourcompany.com"
export ADMIN_PASSWORD="ReplaceWithAStrongProductionPassword123!"
export ADMIN_WORKSPACE="YourCompany"

# 2. Run the bootstrap CLI
python -m app.db.bootstrap_admin
```

What the bootstrap CLI does:
1. Validates password complexity.
2. Creates an enterprise workspace with a unique ID (`ws_<slug>_<uuid>`).
3. Hashes the password using **bcrypt** with 12 salt rounds.
4. Generates a verified user record and assigns them the **OWNER** and **SUPERADMIN** role in `workspace_members`.
5. Is completely idempotent: will safely exit if an administrator with that email already exists.

---

## 4. Multi-Tenant Isolation & Row-Level Security (RLS)

ShopMate AaaS enforces tenant isolation at both the application layer and the PostgreSQL database engine layer:

1. **Application Context:**
   - Every authenticated request verifies the JWT Bearer token and extracts the tenant's `workspace_id`.
   - Every database query filters by `workspace_id == tenant_id`.
2. **PostgreSQL Row-Level Security (RLS):**
   - Migration `c3d4e5f6a1b2` enables `ROW LEVEL SECURITY` on all tenant-specific tables.
   - Sets tenant session context on connection checkout via parameterized execution:
     `SELECT set_config('app.workspace_id', :ws, true)` and `SELECT set_config('app.current_workspace_id', :ws, true)`.
   - If `set_config` fails on a PostgreSQL connection, an explicit `RuntimeError` is raised (no silent swallows).
   - Cross-tenant queries are blocked at the PostgreSQL engine level, even if an application filter is omitted.
   - Comprehensive test suite in `tests/test_tenant_isolation.py` validates that Tenant A cannot access Tenant B's catalog or orders.

### Non-Superuser Database Role Configuration
> [!IMPORTANT]
> PostgreSQL superusers bypass Row-Level Security by default. For production RLS enforcement, the backend connection user must be created as a **non-superuser** with permissions granted only to the application schema:

```sql
-- 1. Create dedicated application role
CREATE ROLE shopmate_app WITH LOGIN PASSWORD 'your_strong_app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

-- 2. Grant table permissions
GRANT CONNECT ON DATABASE shopmate_prod TO shopmate_app;
GRANT USAGE ON SCHEMA public TO shopmate_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO shopmate_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO shopmate_app;

-- 3. Ensure future tables maintain permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO shopmate_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO shopmate_app;

-- 4. Enable FORCE ROW LEVEL SECURITY (applies to table owners too)
ALTER TABLE commerce_products FORCE ROW LEVEL SECURITY;
ALTER TABLE commerce_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks FORCE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
```

---

## 5. Distributed Redis Infrastructure

Rate limiting, token revocation, and tenant usage metering are managed by `app/redis_service.py`:

- **Sliding-Window Rate Limiter:**
  - Implemented using Redis Sorted Sets (`ZADD`, `ZREMRANGEBYSCORE`, `ZCARD`).
  - Limits are enforced per IP address and per tenant workspace. Returns HTTP 429 with accurate `Retry-After` headers.
- **Token Denylist & Revocation:**
  - When a user logs out (`POST /api/auth/logout`), the token's SHA-256 hash is placed in Redis with a TTL matching token expiration.
  - Revoked tokens are immediately rejected across all distributed instances.
- **Tenant Usage Metering:**
  - Tenant API requests and AI consumption are tracked in daily counters (`usage:<workspace_id>:<metric>:<date>`).
- **Production Startup Hardening:**
  - When `APP_ENV=production`, if Redis is unreachable or fails to connect, application startup or Redis initialization fails with a fatal `RuntimeError("Redis is required in production environment but failed to connect")`.
  - In-memory fallback is restricted strictly to local development and testing (`APP_ENV=development`).

---

## 6. Real Third-Party Integrations

### Razorpay Payments
- **Live Order Creation:** Calls the Razorpay REST API (`/v1/orders`) to generate authentic Razorpay orders.
- **Cryptographic Signature Verification:** Verifies payment authenticity using HMAC-SHA256 (`X-Razorpay-Signature`) against `RAZORPAY_KEY_SECRET`.
- **Webhook Processing:** Rejects unsigned or forged webhooks with HTTP 400. Updates order status upon verified `order.paid` or `payment.captured` events.
- **Persistent Idempotency:** Tracks incoming payment keys in the `idempotency_keys` table to prevent double-charging.

### Catalog Connectors & Sync Workers
- **Shopify:** Authenticates via Shopify Admin REST API (`/admin/api/2024-01/products.json`) using `X-Shopify-Access-Token`.
- **WooCommerce:** Authenticates via WooCommerce REST API (`/wp-json/wc/v3/products`) with Consumer Key and Secret.
- **Web Crawler:** Uses structured schema scraper (`schema.org/Product` JSON-LD) with robots.txt compliance. When a product has no price listed, the product is **skipped** and an error logged in the sync job instead of falling back to arbitrary numbers.
- **Job Status Tracking:** Every sync job runs asynchronously and writes progress and status into `sync_jobs`.

### Order Tracking & Data Privacy
- **Storefront (Deployment Key) Lookups:**
  - Calls to `GET /api/v1/commerce/orders` using `X-Deployment-Key` require **both** `order_number` AND `customer_email`.
  - Mismatch or unknown order returns **404 Not Found**.
  - Customer PII (`customer_name`, `customer_email`, `shipping_address`) is completely redacted for public storefront requests. Only `status`, `fulfillment_status`, `items`, and `tracking_number` are returned.
  - Public order lookups are rate-limited to 10 requests per minute per IP.
- **Merchant Lookups:**
  - Authenticated merchant sessions (with valid JWT) can query all orders and view full order details including customer info.

---

## 7. Frontend Offline Readiness & Authentication Security

1. **Zero External Font Network Requests:**
   - Google Fonts network requests (`next/font/google`) have been completely replaced with local `next/font/local` using bundled fonts (`Geist-Regular.woff2`, `GeistMono-Regular.woff2`).
   - Frontend compiles and builds cleanly in air-gapped or offline CI environments.
2. **Elimination of `localStorage` Token Storage:**
   - `localStorage.setItem('aaas_token')` and `localStorage.getItem('aaas_token')` have been completely removed.
   - Authentication relies purely on secure, `httpOnly`, `SameSite=Lax` cookies with `credentials: 'include'` on all client requests, eliminating XSS token theft vectors.

---

## 8. Verification & Test Suite Summary

- **Pytest Suite:** 39 tests passing cleanly in an isolated test database (`pytest -v`).
  - Account signup, login, incorrect password, account lockout after 5 attempts.
  - Storefront order lookup privacy & redaction.
  - Cross-tenant AI search and catalog boundary isolation.
  - RAG store policy retrieval, prompt injection, and citations.
  - Razorpay webhook HMAC signature verification & rejection.
  - PostgreSQL RLS session context binding.
- **Frontend Quality:**
  - `npx tsc --noEmit`: 0 errors.
  - `npm run build`: 16/16 routes built and statically optimized.

### Verified vs. Not Verified Live
- **Verified via automated tests:**
  - RAG policy chunk retrieval, relevance ranking, and prompt inclusion.
  - Handling when LLM API keys are unconfigured (gracefully surfaces policy context and clear message).
  - Cross-tenant isolation at both application and session-context levels.
  - Storefront order tracking PII redaction and rate limiting.
  - Offline font loading and build pipeline.
- **Not Verified Live (Requires external production accounts):**
  - Live third-party LLM completions (requires active paid Sarvam AI, OpenAI, or Anthropic API keys).
  - Live Razorpay settlement webhook deliveries from the public internet (requires live Razorpay merchant webhook URL).
  - Live Shopify / WooCommerce store synchronization (requires live store API credentials).

