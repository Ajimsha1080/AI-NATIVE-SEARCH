# ShopMate AaaS — Enterprise Multi-Tenant E-Commerce AI Platform

[![Next.js 15](https://img.shields.io/badge/Next.js-15.1.7-black?style=flat&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.12-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19.0.0-blue?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-asyncpg-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![SQLAlchemy 2.0](https://img.shields.io/badge/SQLAlchemy-2.0_async-red?style=flat)](https://www.sqlalchemy.org/)
[![Pytest](https://img.shields.io/badge/Pytest-15%2F15_Passing-brightgreen?style=flat&logo=pytest)](python-backend/tests/)
[![Gitleaks](https://img.shields.io/badge/Security-Gitleaks_Passed-brightgreen?style=flat)](.gitleaks.toml)
[![DPDP Act 2023](https://img.shields.io/badge/Compliance-DPDP_Act_2023-blue?style=flat)](UPGRADE.md)

A production-grade, hardened, multi-tenant enterprise **E-Commerce Agent-as-a-Service (AaaS)** platform. Features a pure Next.js 15 / React 19 UI frontend with interactive visual shopping widgets and a 100% Python 3.12 FastAPI backend powered by SQLAlchemy 2.0 (PostgreSQL/SQLite dual-driver), 12-Stage Hybrid RAG pipeline, multi-LLM orchestration with automatic fallbacks (Sarvam AI 105B, OpenAI, Anthropic, Ollama), Redis rate limiting & token revocation, and statutory DPDP Act compliance.

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
                     │     Python 3.12 FastAPI Core      │
                     │  (Stateless Service on :8000)     │
                     └───────┬───────────────────┬───────┘
                             │                   │
            ┌────────────────┴──────┐     ┌──────┴────────────────┐
            ▼                       ▼     ▼                       ▼
 ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
 │ 12-Stage Hybrid RAG │ │  PostgreSQL 16 Async│ │ Redis & Background  │
 │ • Dense Vector Emb  │ │ • SQLAlchemy 2.0    │ │ • Token Revocation  │
 │ • Sparse BM25 / RRF │ │ • Compound Indexes  │ │ • Sliding Limits    │
 │ • Grounding Checker │ │ • Row-Level Security│ │ • Catalog Sync Task │
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
| **Compliance & Auditing** | `AuditLogModel` (Immutable Audit Ledger) | Administrative mutations, payment verifications, DPDP data exports and erasures. |

---

## ✨ Core Platform Capabilities

### 1. 12-Stage Advanced Hybrid RAG Engine
- **Intent Understanding & Entity Extraction**: Detects intent (`RETURN_OR_POLICY_INQUIRY`, `SHIPPING_LOGISTICS`, `SIZING_FIT`) and parameters.
- **Query Rewriting & Semantic Expansion**: Expands queries with domain-specific fashion synonyms.
- **Dense + Sparse Hybrid Search**: Combines semantic embeddings with token matching.
- **Reciprocal Rank Fusion (RRF)**: Merges retrieval candidates using RRF ($k=60$).
- **Grounding Verification**: Requires factual statements to be supported by retrieved chunks, preventing hallucinations.

### 2. Multi-LLM Orchestration & Resilience
- **Automatic Provider Fallback Chain**: `Sarvam AI 105B` ➔ `OpenAI` ➔ `Anthropic` ➔ `Ollama` ➔ `Deterministic Fallback`.
- **Exponential Backoff & Retries**: Automatic backoff with jitter on transient network timeouts or rate limits.
- **Per-Tenant Token Budgets**: Tracks prompt and completion tokens per workspace with quota thresholds.

### 3. Enterprise Security & Hardening
- **Fail-Fast Configuration**: Enforced by `pydantic-settings`; aborts startup if keys are weak or default.
- **JWT Lifecycle & Instant Revocation**: 15-minute access tokens, 7-day refresh tokens, and real-time revocation denylist.
- **Sliding-Window Rate Limiting**: In-memory and Redis-backed rate limiting on auth, search, and chat endpoints.
- **Razorpay Hardening**: Cryptographic HMAC-SHA256 signature verification, server-side catalog price recalculation, and `Idempotency-Key` tracking.

### 4. Enterprise Database & Multi-Tenancy
- **PostgreSQL Asyncpg & SQLite**: Production PostgreSQL with connection pooling (`pool_size=20`, `max_overflow=10`) and SQLite for local development.
- **Alembic Migrations**: Fully tracked schema migrations with version control.
- **Tenant Isolation**: Mandatory `workspace_id` compound indexes on SKU, category, and order number; PostgreSQL Row-Level Security (RLS) policies.

### 5. Observability & Reliability
- **Structured JSON Logging**: Every request tagged with unique `X-Request-ID` correlation identifiers.
- **Health & Readiness Probes**: Liveness (`GET /health`) and deep readiness probe (`GET /ready` verifying relational DB, vector engine, and LLM runtime).
- **Automated Database Backups**: Automated snapshots with rotation pruning (`scripts/db_backup.py`).

### 6. Statutory Compliance (DPDP Act 2023 & GDPR)
- **Immutable Audit Logging**: Every administrative action, payment verification, and data mutation is recorded in `AuditLogModel` (`GET /api/v1/compliance/audit-logs`).
- **Data Portability (`POST /api/v1/compliance/export`)**: Machine-readable JSON export of customer orders, items, and conversations.
- **Right to Erasure (`POST /api/v1/compliance/erase`)**: Redacts customer PII while preserving financial accounting transaction ledgers.

---

## 🚀 Quick Start & Local Setup

### Prerequisites
- **Python 3.12+**
- **Node.js 20+** & **npm 10+**

### 1. Backend Setup (Python FastAPI)

```bash
# Navigate to backend directory
cd python-backend

# Install dependencies
pip install -r requirements.txt

# Start FastAPI development server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The backend is now live:
- API Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
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
# 1. Run Python Pytest Suite (15/15 passing: Auth, Catalog, Compliance, RAG Evals)
cd python-backend
pytest -v

# 2. Frontend Strict TypeScript Check
npx tsc --noEmit

# 3. Frontend ESLint Linting
npm run lint

# 4. Next.js Production Build
npm run build
```

---

## 🌐 Production Deployment

### Multi-Worker Gunicorn Deployment (Python Backend)
```bash
cd python-backend
gunicorn -c gunicorn_conf.py app.main:app
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
