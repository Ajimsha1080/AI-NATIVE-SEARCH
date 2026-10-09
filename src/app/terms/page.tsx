import React from 'react';
import Link from 'next/link';
import { FileText, ArrowLeft, CheckCircle } from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 py-12 px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-3xl border border-zinc-200 shadow-xs space-y-8">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition">
          <ArrowLeft className="w-4 h-4" /> Back to ShopMate
        </Link>

        <div>
          <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
            Terms of Service
          </span>
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight mt-3">Terms of Service</h1>
          <p className="text-xs text-zinc-400 mt-1">Effective Date: October 9, 2026 &bull; Version 2.0</p>
        </div>

        <div className="space-y-6 text-xs text-zinc-600 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-zinc-900">1. SaaS Agreement &amp; Subscription Terms</h2>
            <p>
              By accessing ShopMate AaaS, merchants agree to these Terms. All subscriptions renew automatically at the end of each billing cycle unless cancelled prior to period conclusion via the Merchant Billing Dashboard.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-zinc-900">2. Usage Quotas &amp; Overages</h2>
            <p>
              Workspaces are subject to monthly inquiry and LLM token limits according to the chosen subscription plan. When limits are exceeded, requests may return HTTP 402/429 until the workspace upgrades or the billing period resets.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-zinc-900">3. Service Level &amp; Reliability</h2>
            <p>
              ShopMate strives for 99.9% uptime across search and chat APIs. Automated rate limiters protect the infrastructure from abuse and Denial of Service incidents.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-zinc-900">4. Intellectual Property</h2>
            <p>
              Merchants retain 100% ownership of their product catalogs, brand assets, and custom policy documents ingested into the system.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
