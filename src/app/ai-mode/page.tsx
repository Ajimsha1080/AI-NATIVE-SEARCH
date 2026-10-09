'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Globe, 
  Code2, 
  ArrowRight, 
  Cpu, 
  ShoppingBag
} from 'lucide-react';

export default function AIModeOverviewPage() {
  const [sourcesCount, setSourcesCount] = useState(0);
  const [deploymentsCount, setDeploymentsCount] = useState(0);
  const [usageSummary, setUsageSummary] = useState<any>(null);

  useEffect(() => {
    fetch('/api/ai-mode/knowledge')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.sources) setSourcesCount(data.sources.length);
      })
      .catch(() => {});

    fetch('/api/ai-mode/deployments')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.deployments) setDeploymentsCount(data.deployments.length);
      })
      .catch(() => {});

    fetch('/api/v1/billing/usage', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setUsageSummary(data);
      })
      .catch(() => {});
  }, []);

  const meters = usageSummary?.meters;
  const anyExceeded = usageSummary?.has_quota_exceeded;
  const costWarning80 = meters?.cost_cap?.warning_80;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Quota Warning Banners */}
      {anyExceeded && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-2xl flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <span className="font-bold text-rose-700 uppercase tracking-wider text-[10px] bg-rose-100 px-2 py-0.5 rounded-full">Quota Limit Exceeded</span>
            <span>Your workspace has reached its monthly plan limit. Upgrade your tier to resume full AI search throughput.</span>
          </div>
          <Link href="/ai-mode/billing" className="font-bold text-rose-700 hover:text-rose-900 underline whitespace-nowrap">
            Upgrade Plan &rarr;
          </Link>
        </div>
      )}

      {!anyExceeded && costWarning80 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-700 uppercase tracking-wider text-[10px] bg-amber-100 px-2 py-0.5 rounded-full">Usage Alert</span>
            <span>You have consumed over 80% of your monthly AI cost budget (${meters?.cost_cap?.used_usd} / ${meters?.cost_cap?.limit_usd}).</span>
          </div>
          <Link href="/ai-mode/billing" className="font-bold text-amber-700 hover:text-amber-900 underline whitespace-nowrap">
            Manage Budget &rarr;
          </Link>
        </div>
      )}

      {/* Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-indigo-950 text-white rounded-3xl p-6 lg:p-8 shadow-xl border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-white text-[11px] font-mono backdrop-blur-xs">
            AI-Native Shopping Layer • {usageSummary?.plan_name || 'Starter'} Plan
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Welcome to AI Mode</h2>
          <p className="text-xs text-zinc-300 leading-relaxed">
            AI Mode delivers an independent, conversational shopping experience with dynamic natural-language search, live website crawling, product comparisons, and embedded widgets for your storefront.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/ai-mode/preview"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 text-xs font-bold transition shadow-xs flex items-center justify-center gap-2"
          >
            <span>Launch Live Preview</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/ai-mode/deployment"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition border border-white/20 flex items-center justify-center gap-2"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Get Embed Code</span>
          </Link>
        </div>
      </div>

      {/* Merchant Onboarding Checklist */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider">Storefront Onboarding Checklist</h3>
            <p className="text-[11px] text-zinc-500">Complete these essential setup steps to deploy AI shopping on your store.</p>
          </div>
          <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
            Setup Progress
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          <Link
            href="/products"
            className="p-3.5 rounded-xl border border-zinc-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition group flex flex-col justify-between space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center">1</span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Step 1</span>
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-900 group-hover:text-indigo-600">Add Products</div>
              <div className="text-[11px] text-zinc-400">Import products or sync catalog</div>
            </div>
          </Link>

          <Link
            href="/ai-mode/knowledge"
            className="p-3.5 rounded-xl border border-zinc-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition group flex flex-col justify-between space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center">2</span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Step 2</span>
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-900 group-hover:text-indigo-600">Add Store Policies</div>
              <div className="text-[11px] text-zinc-400">Ingest FAQs, returns &amp; guides</div>
            </div>
          </Link>

          <Link
            href="/ai-mode/deployment"
            className="p-3.5 rounded-xl border border-zinc-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition group flex flex-col justify-between space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center">3</span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Step 3</span>
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-900 group-hover:text-indigo-600">Create Widget</div>
              <div className="text-[11px] text-zinc-400">Customize theme and brand colors</div>
            </div>
          </Link>

          <Link
            href="/ai-mode/deployment"
            className="p-3.5 rounded-xl border border-zinc-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition group flex flex-col justify-between space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center">4</span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Step 4</span>
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-900 group-hover:text-indigo-600">Copy Embed Code</div>
              <div className="text-[11px] text-zinc-400">Embed snippet on Shopify or custom site</div>
            </div>
          </Link>

          <Link
            href="/ai-mode/search"
            className="p-3.5 rounded-xl border border-zinc-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition group flex flex-col justify-between space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center">5</span>
              <span className="text-[10px] font-bold text-indigo-600 uppercase">Step 5</span>
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-900 group-hover:text-indigo-600">Test &amp; Verify</div>
              <div className="text-[11px] text-zinc-400">Verify queries and citations live</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Real-Time Monthly Quota Usage Meters */}
      {meters && (
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider">Monthly Resource Consumption</h3>
              <p className="text-[11px] text-zinc-500">Live meters reconciled against {usageSummary.plan_name} quotas for period {usageSummary.period_month}</p>
            </div>
            <Link href="/ai-mode/billing" className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
              View Billing Details &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* AI Searches & Chats */}
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/70 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-zinc-600">AI Searches &amp; Chats</span>
                <span className="font-bold text-zinc-900">{meters.searches.used.toLocaleString()} / {meters.searches.limit.toLocaleString()}</span>
              </div>
              <div className="w-full bg-zinc-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${
                    meters.searches.exceeded ? 'bg-rose-500' : meters.searches.percentage >= 80 ? 'bg-amber-500' : 'bg-indigo-600'
                  }`}
                  style={{ width: `${Math.min(100, meters.searches.percentage)}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-400 block">{meters.searches.percentage}% of allowance used</span>
            </div>

            {/* Catalog Products */}
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/70 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-zinc-600">Catalog Products</span>
                <span className="font-bold text-zinc-900">{meters.products.used.toLocaleString()} / {meters.products.limit.toLocaleString()}</span>
              </div>
              <div className="w-full bg-zinc-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${
                    meters.products.exceeded ? 'bg-rose-500' : meters.products.percentage >= 80 ? 'bg-amber-500' : 'bg-emerald-600'
                  }`}
                  style={{ width: `${Math.min(100, meters.products.percentage)}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-400 block">{meters.products.percentage}% of catalog capacity</span>
            </div>

            {/* AI Cost Budget */}
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/70 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-zinc-600">LLM Cost Cap</span>
                <span className="font-bold text-zinc-900">${meters.cost_cap.used_usd.toFixed(2)} / ${meters.cost_cap.limit_usd.toFixed(2)}</span>
              </div>
              <div className="w-full bg-zinc-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${
                    meters.cost_cap.exceeded ? 'bg-rose-500' : meters.cost_cap.warning_80 ? 'bg-amber-500' : 'bg-indigo-600'
                  }`}
                  style={{ width: `${Math.min(100, meters.cost_cap.percentage)}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-400 block">{meters.cost_cap.percentage}% of monthly AI budget</span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium">Knowledge Sources</span>
            <Globe className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-900">{sourcesCount}</div>
          <p className="text-[11px] text-zinc-400">Connected website crawls &amp; docs</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium">Live Deployments</span>
            <Code2 className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-900">{deploymentsCount}</div>
          <p className="text-[11px] text-zinc-400">Storefront widget endpoints</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium">Search Retrieval</span>
            <Cpu className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900">Hybrid</div>
          <p className="text-[11px] text-zinc-400">Dense Vector + BM25 Lexical</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium">Catalog Sync</span>
            <ShoppingBag className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900">Active</div>
          <p className="text-[11px] text-zinc-400">Real-time inventory mapping</p>
        </div>
      </div>
    </div>
  );
}
