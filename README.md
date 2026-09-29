# ShopMate AaaS — Enterprise Multi-Tenant E-Commerce AI Agent Platform

[![Next.js 15](https://img.shields.io/badge/Next.js-15.1.7-black?style=flat&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.12-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19.0.0-blue?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.x-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![Sarvam AI](https://img.shields.io/badge/Sarvam_AI-105B_Conversations-orange?style=flat)](https://www.sarvam.ai/)
[![Acceptance Tests](https://img.shields.io/badge/Acceptance_Tests-33%2F33_Passing-brightgreen?style=flat)](scripts/test-acceptance.ts)

A production-grade, hardened, multi-tenant enterprise **E-Commerce Agent-as-a-Service (AaaS)** platform. Features a unified Next.js 15 full-stack frontend with visual shopping chat widgets and an asynchronous Python 3.12 FastAPI intelligence engine powered by a 12-Stage Hybrid RAG pipeline and multi-LLM orchestration (Sarvam AI 105B, OpenAI, Anthropic, Ollama).

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│           Client Layer (Browser / Embed Widget / API)       │
└──────────────────────────────┬──────────────────────────────┘
                               │ (HTTPS / Public Key)
                ┌──────────────┴──────────────┐
                │    Next.js 15 Full-Stack    │
                │  - Visual Product Cards     │
                │  - Cart & Checkout Actions  │
                │  - Multi-Page Web Crawler   │
                └──────────────┬──────────────┘
                               │ (Service JWT / Signed Token)
                ┌──────────────┴──────────────┐
                │   FastAPI Python Engine     │
                │  - 12-Stage Hybrid RAG      │
                │  - Tool Calling Loop        │
                │  - Injection Defense Guard  │
                └──────────────┬──────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
   Sarvam AI 105B        Catalog Index         Vector Store
 (LLM Orchestration)   (Multi-Tenant In-Memory) (Hybrid BM25 + Embeddings)
```

---

## ✨ Core Platform Features

### 1. 12-Stage Advanced Hybrid RAG Engine
- **Query Understanding & Entity Extraction**: Detects user intent (Product Search, Policy Inquiries, Order Tracking, Cart Actions, Human Escalation) and extracts parameters (size, color, price limits).
- **Query Rewriting & Semantic Expansion**: Expands queries with domain-specific fashion synonyms (sarees, kurtas, apparel, color families).
- **Dense + Sparse Hybrid Search**: Combines high-dimensional semantic embeddings with BM25 keyword matching.
- **Reciprocal Rank Fusion (RRF)**: Merges retrieval candidate lists using RRF ($k=60$).
- **Cross-Encoder Scoring & Grounding Verification**: Verifies citations to guarantee factual confidence and prevent hallucinations.

### 2. Autonomous Multi-Page Store Crawler & Shopify Synchronizer
- **Automated Discovery**: Ingests store policies across root `/`, `/pages/shipping-policy`, `/pages/return-exchange-policy`, `/pages/contact-us`, `/pages/about-us`, and `/pages/faq`.
- **Paginated Catalog Crawler**: Automatically ingests up to 2,500 products per sync via `/products.json?limit=250&page=1..10`.
- **Live Inventory Ingestion**: Imports pricing, compare-at MRPs, multi-variant stock levels, and high-res product photos.

### 3. Visual Interactive Chat & Instant Cart Management
- **Interactive Product Cards**: High-res product cards with live stock badges, pricing, zoomable photo inspect modal, and instant 1-click **Add to Cart**.
- **Context-Aware Dialogue**: Concise 1–2 sentence styling recommendations highlighting fabrics, craftsmanship, and vibes without repetitive text price dumps.
- **Cart & Order Tracking**: Instant tracking lookup for active orders (`#10482`) and real-time shopping cart calculation with discount validation.

### 4. Enterprise Security, Privacy & Guardrails
- **Prompt Injection Boundaries**: All untrusted store catalog chunks are wrapped in `<<<UNTRUSTED_CATALOG_DATA>>>` delimiters to prevent prompt override attacks.
- **SSRF & Metadata Protection**: Strict `SafeFetch` utility blocking AWS/GCP cloud metadata IPs (`169.254.169.254`), RFC 1918 private subnets, IPv6 loopbacks, and hex/dword evasion.
- **Role-Based Access Control (RBAC)**: Tenant isolation across `OWNER`, `ADMIN`, `EDITOR`, and `VIEWER` roles.
- **Zero-Hallucination Safe Fallbacks**: Fails closed and avoids inventing policies when knowledge chunks are absent.

---

## 🚀 Quick Start & Local Setup

### Prerequisites
- Node.js 18+ / 20+
- Python 3.12+ (optional for local FastAPI service)

### 1. Environment Configuration
Create a `.env` file in the root directory:

```env
APP_ENV=development
NODE_ENV=development

# LLM Configuration (Sarvam AI / OpenAI / Anthropic / Ollama)
SARVAM_API_KEY=sk_wgtub61j_eyGlu73IXjWpozVC6e4JG5N5
LLM_PROVIDER=sarvam
LLM_MODEL=sarvam-105b-conversations

# Backend Service URLs
PYTHON_BACKEND_URL=http://127.0.0.1:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Security Secrets (32+ chars)
JWT_SECRET=your_super_secret_jwt_key_at_least_32_chars_long
ENCRYPTION_KEY=your_encryption_key_at_least_32_chars_long
```

### 2. Install Dependencies & Run
```bash
# Install Node packages
npm install

# Start Next.js development server
npm run dev
```

---

## 🧪 Comprehensive Verification & Test Suite

The repository includes a 33-step automated acceptance test suite verifying security, multi-tenancy, authentication, SSRF protection, order tracking, rate limiting, and plan quotas:

```bash
# Run acceptance test suite (33/33 criteria)
npm run test:acceptance

# Run TypeScript typecheck
npx tsc --noEmit

# Production build test
npm run build
```

---

## 🌐 Production Deployment (Docker Compose)

To deploy on AWS EC2 or any Linux VPS:

```bash
cd ~/AI-Native-Ecommerce
git fetch origin
git reset --hard origin/main
sudo docker compose up -d --build
```

---

## 📄 License
MIT © 2026 ShopMate AaaS Platform Inc.
