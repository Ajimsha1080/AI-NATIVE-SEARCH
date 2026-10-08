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
   - Sets tenant session context on connection checkout via `SET LOCAL app.current_workspace_id = 'ws_...'`.
   - Cross-tenant queries are blocked at the PostgreSQL engine level, even if an application filter is omitted.
   - Comprehensive test suite in `tests/test_tenant_isolation.py` validates that Tenant A cannot access Tenant B's catalog or orders.

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
- **Resilience:**
  - Automatically falls back to in-memory sliding windows and revocation sets if Redis is temporarily unreachable during local testing.

---

## 6. Real Third-Party Integrations

### Razorpay Payments
- **Live Order Creation:** Calls the Razorpay REST API (`/v1/orders`) to generate authentic Razorpay orders.
- **Cryptographic Signature Verification:** Verifies payment authenticity using HMAC-SHA256 (`X-Razorpay-Signature`) against `RAZORPAY_KEY_SECRET`.
- **Webhook Processing:** Rejects unsigned or forged webhooks. Updates order status upon verified `order.paid` or `payment.captured` events.
- **Persistent Idempotency:** Tracks incoming payment keys in the `idempotency_keys` table to prevent double-charging.

### Catalog Connectors & Sync Workers
- **Shopify:** Authenticates via Shopify Admin REST API (`/admin/api/2024-01/products.json`) using `X-Shopify-Access-Token`.
- **WooCommerce:** Authenticates via WooCommerce REST API (`/wp-json/wc/v3/products`) with Consumer Key and Secret.
- **Web Crawler:** Uses structured schema scraper (`schema.org/Product` JSON-LD) with robots.txt compliance.
- **Job Status Tracking:** Every sync job runs asynchronously and writes progress and status into `sync_jobs`.

### Order Tracking
- Retrieves live carrier status from the database.
- If an order has not been assigned a tracking number or carrier, returns `"tracking unavailable"` and `"carrier unavailable"`. Never fabricates fake carrier statuses.

---

## 7. CI Production Integrity & Verification

A continuous integration check (`tests/test_production_integrity.py`) scans all non-test production source files:
- Fails if the words `demo`, `mock`, `fake`, `example.com`, `password123`, or `acme` appear anywhere in production code.
- Tested and verified: **0 occurrences** across all Python and TypeScript production files.

### Running Test Verification:
```bash
# Python Backend Test Suite (32 tests)
cd python-backend
pytest tests/ -v

# Frontend Production Build (Zero build error suppressions)
cd ..
npm run build
```

---

---

## 8. Third-Party Credentials Checklist for Production Launch

Before opening public traffic, configure real production credentials for your external partners:

- [ ] **PostgreSQL Database:** Provision a production PostgreSQL instance (version 15+ recommended for pgvector) and run `alembic upgrade head`.
- [ ] **Redis Instance:** Provision a high-availability Redis instance (version 6.2+) and configure `REDIS_URL`.
- [ ] **Email Provider:** Configure SMTP credentials or Resend API key so verification and password reset emails are delivered to users.
- [ ] **Razorpay Account:** Add live `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in environment variables and set the Webhook URL in Razorpay Dashboard to `https://api.yourdomain.com/api/commerce/razorpay/webhook`.
- [ ] **AI Provider:** Provide valid API keys for Sarvam AI, OpenAI, or Anthropic depending on chosen provider.
- [ ] **Admin Account:** Run `python -m app.db.bootstrap_admin` to create your initial administrator account.

---

## 9. Breaking API Changes & Security Enhancements

### Breaking API Changes
1. **Tenant Authority strictly from Token:**
   - Client requests can no longer supply `workspace_id` in request bodies or query parameters to assert authority.
   - If a client supplies a `workspace_id` that differs from the token's authenticated workspace, the server immediately returns **403 Forbidden**.
   - Public storefront endpoints (`/api/v1/ai-mode/search`, `/api/v1/ai-mode/chat`, `/api/v1/ai-mode/track`, `/api/v1/ai-mode/widget/*`) must supply a valid `X-Deployment-Key` header matching an active `LIVE` deployment with origin domain checks, or an authenticated merchant session.
2. **Standardized Frontend API Prefix:**
   - Frontend components now strictly call `/api/<path>`.
   - Broken endpoints `/api/knowledge` and `/api/knowledge/sync` have been removed in favor of `/api/ai-mode/knowledge` and `/api/ai-mode/knowledge/sync`.
   - Next.js rewrites proxy `/api/:path*` directly to the FastAPI backend `/api/v1/:path*`.
3. **Cookie-Based Sessions & Central API Client:**
   - `localStorage` token storage has been phased out in favor of `httpOnly`, `Secure`, `SameSite=Lax` cookies set directly by `/api/v1/auth/login`.
   - Centralized `apiClient` (`src/lib/api-client.ts`) handles credentials automatically, intercepts 401 Unauthorized responses to attempt token refresh, and redirects unauthenticated users to `/auth/login`.
4. **Dashboard Route Protection:**
   - Next.js middleware (`src/middleware.ts`) protects all internal pages (`/ai-mode`, `/products`, etc.) while allowing public storefront traffic and auth routes.
5. **Role-Based Access Control (RBAC):**
   - Writing products, editing configs, running catalog syncs, and managing deployments requires `OWNER` or `ADMIN` roles.
   - `VIEWER` roles are strictly read-only and receive **403 Forbidden** on mutation attempts.
6. **API Contract Verification:**
   - CI contract test (`tests/test_api_contract.py`) compares the frontend API surface against FastAPI's registered OpenAPI route table.

### Remaining Production Hardening Checklist
- Ensure PostgreSQL runs under a dedicated, non-superuser role so that PostgreSQL Row-Level Security (`FORCE ROW LEVEL SECURITY`) is strictly enforced against all database queries.
- In multi-region deployments, configure Redis replication and verify that SSL termination preserves original client IP (`X-Forwarded-For`) for rate limiting.
