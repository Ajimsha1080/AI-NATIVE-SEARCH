import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Lock, Eye, Database, ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 py-12 px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-3xl border border-zinc-200 shadow-xs space-y-8">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition">
          <ArrowLeft className="w-4 h-4" /> Back to ShopMate
        </Link>

        <div>
          <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
            Legal &amp; Compliance
          </span>
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight mt-3">Privacy Policy</h1>
          <p className="text-xs text-zinc-400 mt-1">Effective Date: October 9, 2026 &bull; Version 2.0</p>
        </div>

        <div className="space-y-6 text-xs text-zinc-600 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-zinc-900">1. Information We Collect</h2>
            <p>
              ShopMate AaaS (&ldquo;we&rdquo;, &ldquo;our&rdquo;) processes commerce data, search queries, and conversational transcripts solely to provide AI recommendations and storefront semantic search for merchants.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Merchant Account Information:</strong> Name, business email, workspace name, billing identifiers.</li>
              <li><strong>Storefront Customer Interactions:</strong> Anonymized query vectors, chat messages, order tracking references.</li>
              <li><strong>Telemetry &amp; Audit Logs:</strong> Timestamped IP addresses, access sessions, and API key events.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-zinc-900">2. Row-Level Security &amp; Tenant Isolation</h2>
            <p>
              Every merchant workspace is cryptographically separated via strict PostgreSQL Row-Level Security (RLS). Tenant A cannot access, query, or infer data belonging to Tenant B under any circumstance.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-zinc-900">3. Artificial Intelligence &amp; Model Training</h2>
            <p>
              We do <strong>not</strong> train public base models on merchant catalog data or customer shopping queries. Your catalog embeddings and private knowledge documents remain isolated within your dedicated workspace tenant context.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-zinc-900">4. Your Data Rights</h2>
            <p>
              Merchants and consumers have rights to data portability, export, and right-to-be-forgotten erasure under the Digital Personal Data Protection (DPDP) Act and GDPR.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
