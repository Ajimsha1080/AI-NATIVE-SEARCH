# ShopMate AaaS — Enterprise Multi-Tenant E-Commerce AI Platform

[![Next.js 15](https://img.shields.io/badge/Next.js-15.1.7-black?style=flat&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.12-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19.0.0-blue?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-asyncpg-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Pytest](https://img.shields.io/badge/Pytest-67%2F67_Passing-brightgreen?style=flat&logo=pytest)](python-backend/tests/)
[![Gitleaks](https://img.shields.io/badge/Security-Gitleaks_Passed-brightgreen?style=flat)](.gitleaks.toml)
[![DPDP Act 2023](https://img.shields.io/badge/Compliance-DPDP_Act_2023-blue?style=flat)](UPGRADE.md)

A production-grade, hardened, multi-tenant enterprise **E-Commerce Agent-as-a-Service (AaaS)** platform. Features a pure Next.js 15 / React 19 UI frontend with interactive visual shopping widgets, centralized auto-refreshing cookie client, Next.js route protection middleware, and a 100% Python 3.12+ FastAPI backend powered by SQLAlchemy 2.0 (PostgreSQL Row-Level Security / SQLite dual-driver), 12-Stage Hybrid RAG pipeline, multi-LLM orchestration with automatic fallbacks (Sarvam AI 105B, OpenAI, Anthropic, Ollama), Redis rate limiting, token revocation, full SaaS subscription billing, quota enforcement, team RBAC, MFA security, Prometheus observability, and statutory DPDP Act compliance.

---

## 🏗️ System Architecture

```
                                  CUSTOMER
                                     │
                                     ▼
                     ┌───────────────────────────────────┐
                     │     Next.js 15 React 19 UI        │
                     │  (Client-only Frontend on :3000)  │
                     └────────────────┬──────────────────┘
                                      │  Typed SDK Client / Nginx
                                      ▼
                     ┌───────────────────────────────────┐
                     │     Python 3.12+ FastAPI Core     │
                     │  (Stateless Service on :8000)     │
                     └───────┬───────────────────┬───────┘
                             │                   │
            ┌────────────────┴──────┐     ┌──────┴────────────────┐
            ▼                       ▼     ▼                       ▼
 ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
 │ 12-Stage Hybrid RAG │ │  PostgreSQL 16 Async│ │ Redis & Background  │
 │ • Dense Vector Emb  │ │ • SQLAlchemy 2.0    │ │ • Token Revocation  │
 │ • Sparse BM25 / RRF │ │ • Compound Indexes  │ │ • Sliding Limits    │
 │ • Grounding Checker │ │ • Row-Level Security│ │ • Usage Metering    │
 └─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

---

## 💎 Source-of-Truth Separation Rule

The platform strictly separates authoritative transactional data from generative LLM reasoning:

| Domain | Authoritative Provider | Role & Scope |
|---|---|---|
| **Product Discovery & Truth** | SQLAlchemy `ProductModel` (Postgres / SQLite) | Product ID, SKU, title, category, price, discount, variant stock, images, product URLs. |
| **Inventory & Availability** | Relational Database Models | Real-time stock counts, size-specific variant stock verification. |
| **Cart Operations** | `CartModel` + Client Cache | Real-time basket calculation, subtotal, quantity updates, order line-items. |
| **Order Tracking** | `OrderModel` (Indexed by tenant + number) | Real-time shipment status, carrier tracking numbers, delivery addresses. |
| **Store Policies & FAQs** | 12-Stage Hybrid RAG Pipeline | Return/exchange windows, doorstep pickup terms, shipping times, brand info. |
| **Compliance & Auditing** | `AuditLogModel` (Immutable Audit Ledger) | Administrative mutations, billing events, DPDP data exports and erasures. |
| **Plans & Subscriptions** | `SubscriptionModel` & Provider Webhooks | Active subscription status, billing cycles, quotas, and invoices. |

---

## ✨ Core Platform Capabilities

### 1. Multi-Tenant Plans, Billing & Subscriptions
- **Multi-Provider Architecture**: Plug-and-play provider abstraction (`BillingProvider`) with complete Razorpay Subscriptions integration (and extensible for Stripe).
- **Cryptographic Webhook Processing**: Idempotent webhook event dispatch (`subscription.activated`, `subscription.charged`, `subscription.halted`, `subscription.cancelled`) with HMAC-SHA256 signature verification.
- **Grace Periods & Downgrades**: Automatic grace period handling on failed transactions with downgrade transitions and alert notifications.
- **Frontend Portal**: Dedicated Billing page (`/ai-mode/billing`) for plan upgrades/cancellations and public Pricing page (`/pricing`).

### 2. Usage Quotas & Tenancy Metering
- **Real-Time Sliding-Window Metering**: Redis-backed counters tracked per workspace and billing cycle for searches, AI chats, LLM tokens, product counts, and team seats.
- **Quota Enforcer**: Non-blocking `require_quota(metric)` FastAPI dependency; responds with HTTP 402/429 and upgrade link while gracefully degrading storefront search/chat.
- **LLM Cost Caps**: Per-tenant monthly budget thresholding with early warning banners at 80% and hard enforcement at 100%.

### 3. Teams, Role-Based Access Control & Workspaces
- **Secure Email Invitations**: Single-use, expiring HMAC-signed invitation tokens with role assignments (`ADMIN`, `EDITOR`, `VIEWER`).
- **Workspace Switcher**: Multi-tenant membership support allowing single users to seamlessly navigate multiple merchant workspaces.
- **Sole-Owner Protection**: Enforced validation guaranteeing workspaces always preserve at least one active `OWNER`.

### 4. Advanced Security & Account Protection
- **RFC 6238 TOTP MFA**: Authenticator app integration with QR code provisioning and 10 single-use hashed recovery backup codes.
- **Session Management**: Live active sessions tracking with instant device-level revocation and "log out everywhere" capability.
- **Scoped API Keys**: High-performance API keys (`sm_live_...`) with SHA-256 storage, single-time reveal, and instant revocation.

### 5. 12-Stage Advanced Hybrid RAG Engine
- **Intent Understanding & Entity Extraction**: Detects intent (`RETURN_OR_POLICY_INQUIRY`, `SHIPPING_LOGISTICS`, `SIZING_FIT`) and parameters.
- **Query Rewriting & Semantic Expansion**: Expands queries with domain-specific fashion synonyms.
- **Dense + Sparse Hybrid Search**: Combines semantic embeddings with token matching.
- **Reciprocal Rank Fusion (RRF)**: Merges retrieval candidates using RRF ($k=60$).
- **Grounding Verification**: Requires factual statements to be supported by retrieved chunks, preventing hallucinations.

### 6. Merchant Management & Legal Compliance
- **Orders Portal**: Full orders management dashboard (`/ai-mode/orders`) with carrier tracking and fulfillment status updates.
- **Merchant Analytics**: Conversions, top search queries, zero-result demand gap metrics (`/ai-mode/analytics`).
- **Conversation Viewer**: Full customer AI chat history inspection with toggleable PII redaction (`/ai-mode/conversations`).
- **Statutory Compliance (DPDP Act 2023 & GDPR)**: Integrated Privacy Policy (`/privacy`), Terms of Service (`/terms`), and DPDP Portal (`/dpdp`) with verifiable timestamped signup consent.
- **Onboarding Wizard**: 5-step interactive deployment checklist right on the dashboard.

### 7. Observability & Operations
- **Prometheus Metrics**: Exposes HTTP request rates, p95/p99 latencies, LLM inference latency, token counts, cost meters, and queue depth at `GET /metrics`.
- **Preconfigured Alert Rules**: Production-ready alert definitions (`prometheus_alerts.yml`).
- **Sentry Integration**: Exception tracking and distributed traces across FastAPI and Next.js.
- **Backup & Disaster Recovery**: Tested automated PostgreSQL backup (`scripts/backup_postgres.sh`) and restore verification (`scripts/restore_postgres.sh`).
- **Load Testing**: Pre-configured k6 scenario script (`tests/load_test_search_chat.js`).

---

## 🚀 Quick Start & Local Setup

### Prerequisites
- **Python 3.12+**
- **Node.js 20+** & **npm 10+**
- **PostgreSQL 16** (or SQLite for local mock testing)
- **Redis 7+**

### 1. Backend Setup (Python FastAPI)

```bash
# Navigate to backend directory
cd python-backend

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start FastAPI development server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The backend is now live:
- API Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Metrics Endpoint: [http://127.0.0.1:8000/metrics](http://127.0.0.1:8000/metrics)
- Health Probe: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- Readiness Probe: [http://127.0.0.1:8000/ready](http://127.0.0.1:8000/ready)

### 2. Frontend Setup (Next.js 15 UI)

```bash
# In the root repository directory
npm install

# Start Next.js development server
npm run dev
```

The UI is now accessible at [http://localhost:3000](http://localhost:3000).

---

## 🧪 Automated Testing & Verification

```bash
# 1. Run Python Pytest Suite (67/67 passing: RLS, quotas, billing, smoke, E2E)
cd python-backend
pytest -v

# 2. Python Code Quality & Type Checks
ruff check .
mypy --config-file mypy.ini -p app.auth -p app.catalog -p app.billing

# 3. Security Audits
pip-audit -r requirements.txt
npm audit --omit=dev

# 4. Frontend Strict TypeScript Check
npx tsc --noEmit

# 5. Frontend ESLint Linting
npm run lint

# 6. Next.js Production Build
npm run build
```

---

## 🌐 Production Deployment

### Multi-Worker Deployment (Python Backend)
```bash
cd python-backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Docker Compose
```bash
docker compose up -d --build
```

---

## 📖 Upgrade Guide & Documentation
For a complete breakdown of enterprise modifications, environment variable references, database migration commands, and disaster recovery procedures, consult [`UPGRADE.md`](UPGRADE.md).

---

## 📄 License
MIT © 2026 ShopMate AaaS Platform Inc.
