import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Database, Key, CheckCircle, ArrowLeft } from 'lucide-react';

export default function DPDPCompliancePage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 py-12 px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-3xl border border-zinc-200 shadow-xs space-y-8">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition">
          <ArrowLeft className="w-4 h-4" /> Back to ShopMate
        </Link>

        <div>
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            DPDP Act 2023 Compliance
          </span>
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight mt-3">Data Protection &amp; DPDP Notice</h1>
          <p className="text-xs text-zinc-400 mt-1">Compliance with India Digital Personal Data Protection Act &bull; Version 2.0</p>
        </div>

        <div className="space-y-6 text-xs text-zinc-600 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-zinc-900">1. Data Fiduciary &amp; Processor Designation</h2>
            <p>
              In accordance with Section 8 of the DPDP Act 2023, the merchant acts as the Data Fiduciary for shopper personal data. ShopMate AaaS functions as the Data Processor, implementing rigorous technical and organizational safeguards.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-zinc-900">2. Customer Consent Logging</h2>
            <p>
              All customer consent records are timestamped and cryptographically associated with the merchant workspace. Customers may withdraw consent or invoke their right to information at any time.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-zinc-900">3. Portability &amp; Right to Erasure Endpoints</h2>
            <p>
              Merchants can programmatically export customer interaction records or permanently erase personal data through our verified endpoints:
            </p>
            <div className="bg-zinc-900 text-zinc-100 p-3 rounded-xl font-mono text-[11px] space-y-1">
              <div>POST /api/v1/compliance/dpdp/export</div>
              <div>POST /api/v1/compliance/dpdp/erase</div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-zinc-900">4. Grievance Redressal</h2>
            <p>
              For any privacy inquiries or grievances, contact our designated Data Protection Officer at <code>dpo@shopmate.ai</code>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
