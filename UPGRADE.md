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

## Phase 2: Database Upgrades

### 1. Dual-Driver Enterprise Database Engine
- **Engine Configuration**: Configured in [`python-backend/app/db/database.py`](file:///c:/Users/91730/Downloads/AI%20NATIVE%20SEARCH/python-backend/app/db/database.py).
  - Production: `postgresql+asyncpg://...` with connection pooling (20 base connections, max overflow 10, connection recycling at 3600s).
  - Development / CI: `sqlite+aiosqlite://...` with high-performance PRAGMAs (WAL mode, memory temp store, 64MB cache).
- **Driver Packages**: Added `asyncpg`, `alembic`, and `pgvector` to requirements.

### 2. Multi-Tenant Schema & High-Performance Indexes
- Updated [`models.py`](file:///c:/Users/91730/Downloads/AI%20NATIVE%20SEARCH/python-backend/app/db/models.py) with explicit `workspace_id` foreign keys and tenant-level compound indexes:
  - `idx_prod_tenant_id` on `(workspace_id, id)`
  - `idx_prod_tenant_cat` on `(workspace_id, category)`
  - `idx_prod_tenant_sku` on `(workspace_id, sku)`
  - `idx_order_tenant_number` on `(workspace_id, order_number)`
  - `idx_order_tenant_email` on `(workspace_id, customer_email)`
  - `idx_chunk_tenant` on `(workspace_id, id)`

### 3. Alembic Database Migrations
- Initialized asynchronous Alembic migration framework in `python-backend/migrations/`.
- Generated initial migration [`ced8fcdd6f45_initial_schema_with_tenancy_and_indexes.py`](file:///c:/Users/91730/Downloads/AI%20NATIVE%20SEARCH/python-backend/migrations/versions/ced8fcdd6f45_initial_schema_with_tenancy_and_indexes.py) covering all 21 models, indexes, and foreign keys.

### 4. PostgreSQL Row-Level Security (RLS) Isolation
- Added [`python-backend/scripts/tenant_isolation_rls.sql`](file:///c:/Users/91730/Downloads/AI%20NATIVE%20SEARCH/python-backend/scripts/tenant_isolation_rls.sql).
- Enforces strict tenant separation on PostgreSQL using `current_setting('app.current_workspace_id', true)` across all tables.

### 5. Flat-File Data Migration
- Implemented [`scripts/migrate_json_to_db.py`](file:///c:/Users/91730/Downloads/AI%20NATIVE%20SEARCH/python-backend/scripts/migrate_json_to_db.py) and successfully seeded all 247 catalog products and orders into the relational database.
- Transitioned `/api/v1/commerce/products` and `/api/v1/ai-mode/search` to query the relational database engine directly.

---

## Phase 3: Architecture Upgrades

### 1. Fully Asynchronous `httpx` Network Client
- Removed all synchronous `urllib.request` and `requests` invocations across [`llm.py`](file:///c:/Users/91730/Downloads/AI%20NATIVE%20SEARCH/python-backend/app/llm.py) and [`rag.py`](file:///c:/Users/91730/Downloads/AI%20NATIVE%20SEARCH/python-backend/app/rag.py).
- Implemented `httpx.Client` / `httpx.AsyncClient` with custom timeouts (15s for LLM inference, 8s for embeddings).

### 2. Python 3.12 Pinning
- Pinned Python version to `3.12` in:
  - [`.python-version`](file:///c:/Users/91730/Downloads/AI%20NATIVE%20SEARCH/.python-version)
  - [`python-backend/Dockerfile`](file:///c:/Users/91730/Downloads/AI%20NATIVE%20SEARCH/python-backend/Dockerfile)
  - [`.github/workflows/ci.yml`](file:///c:/Users/91730/Downloads/AI%20NATIVE%20SEARCH/.github/workflows/ci.yml)

### 3. Background Task Worker Architecture
- Implemented [`BackgroundTaskWorker`](file:///c:/Users/91730/Downloads/AI%20NATIVE%20SEARCH/python-backend/app/worker.py) running via asyncio queue during the application lifespan.
- Decoupled intensive tasks (knowledge syncing, product indexing, web crawling) from HTTP request-response cycles.

### 4. Resilient LLM Engine (Provider Fallbacks & Token Quotas)
- Upgraded [`LLMClient`](file:///c:/Users/91730/Downloads/AI%20NATIVE%20SEARCH/python-backend/app/llm.py):
  - Exponential backoff with retry logic on transient HTTP failures (429/500).
  - Resilient multi-provider fallback hierarchy: `Sarvam AI -> OpenAI -> Anthropic -> Ollama -> Deterministic Fallback`.
  - In-memory per-tenant token usage tracking (`_tenant_token_usage`) to enforce session token limits.

### 5. OpenAPI v3 Specification & Typed Client
- Exported complete OpenAPI 3.1 schema to [`openapi.json`](file:///c:/Users/91730/Downloads/AI%20NATIVE%20SEARCH/openapi.json) (35 endpoints).
- Created typed TypeScript client [`src/lib/api-client.ts`](file:///c:/Users/91730/Downloads/AI%20NATIVE%20SEARCH/src/lib/api-client.ts) providing type-safe abstractions for all commerce and AI Mode interactions.

---

## Phase 4: Observability & Reliability Upgrades

### 1. Structured JSON Logging with Correlation IDs
- Implemented [`StructuredLoggingMiddleware`](file:///c:/Users/91730/Downloads/AI%20NATIVE%20SEARCH/python-backend/app/middleware/logging_middleware.py) in FastAPI:
  - Generates and propagates `X-Request-ID` across all inbound requests and outbound HTTP response headers.
  - Formats output as structured JSON objects: `{"timestamp", "request_id", "workspace_id", "method", "path", "status_code", "latency_ms"}`.

### 2. Proactive Health & Readiness Probes
- Upgraded `GET /health` (liveness probe) to return service uptime, version, and server timestamp.
- Upgraded `GET /ready` (readiness probe) to actively query the database connection (`SELECT 1`), verify vector engine state, and validate LLM runtime readiness before admitting traffic.

### 3. Production Multi-Worker Process Manager
- Created [`gunicorn_conf.py`](file:///c:/Users/91730/Downloads/AI%20NATIVE%20SEARCH/python-backend/gunicorn_conf.py) running Uvicorn workers (`uvicorn.workers.UvicornWorker`):
  - Dynamic worker count (`min(cpu * 2 + 1, 8)`).
  - Configured graceful worker restarts, request limits with jitter (to mitigate memory leaks), and timeout handling.

### 4. Automated Database Backup & Restore Procedure
- **Automated Backup Script**: [`scripts/db_backup.py`](file:///c:/Users/91730/Downloads/AI%20NATIVE%20SEARCH/python-backend/scripts/db_backup.py) snapshots the active database to `data/backups/aaas_enterprise_backup_<TIMESTAMP>.db` and prunes snapshots older than 7 iterations.
- **PostgreSQL Production Backup**:
  ```bash
  # Take compressed snapshot
  pg_dump -Fc -v --host=$PGHOST --username=$PGUSER $PGDATABASE > backup_$(date +%Y%m%d_%H%M%S).dump
  ```
- **Point-in-Time Restore Procedure**:
  ```bash
  # Restore snapshot into production cluster
  pg_restore -v --clean --if-exists --no-owner --dbname=$DATABASE_URL backup_latest.dump
  ```

---

## Phase 5: Quality (Testing, CI/CD, RAG Evaluations & Dependabot)

### 1. Pytest Test Suites
- Created comprehensive test suites under `python-backend/tests/`:
  - `tests/test_auth.py`: Tests access token creation, claims verification, refresh token generation, and real-time denylist token revocation.
  - `tests/test_catalog.py`: Tests `/health`, `/ready`, `/api/v1/commerce/products`, and `/api/v1/ai-mode/search` with schema validation.
  - `tests/test_rag_evals.py`: Automated RAG evaluation set measuring intent understanding, query rewriting, top-k retrieval accuracy, grounding verification, and multi-tenant isolation boundaries.
- Added `python-backend/pytest.ini` with automated `asyncio_mode = auto` and `pythonpath = .`.

### 2. CI/CD Overhaul (`.github/workflows/ci.yml`)
- **Secret Scanning**: Integrated Gitleaks GitHub Action to scan commit history and PR diffs for secret leakage.
- **Frontend Quality Job**: Node 20 runner with `npm ci`, strict TypeScript check (`tsc --noEmit`), ESLint, and production Next.js build.
- **Python Quality Job**: Python 3.12 runner with Ruff linting, Pytest test matrix, RAG evaluation, DB tests, and massive multi-tenancy tests.

### 3. Automated Dependency Management (`.github/dependabot.yml`)
- Added Dependabot covering:
  - `npm` dependencies in `/`
  - `pip` dependencies in `/python-backend`
  - `github-actions` workflows

### 4. Separate Staging & Production Configurations
- Created `.env.staging.example` and `.env.production.example` separating connection strings, log verbosity, pool configurations, and security credentials.

---

## Rollback & Emergency Procedures (Phase 1 through 5)
- If a bad release occurs, point traffic to the previous healthy container image; workers are fully stateless and state is confined to PostgreSQL/Redis.
- In local development mode (`APP_ENV=development`), the system falls back to default 32-byte development secrets automatically.
