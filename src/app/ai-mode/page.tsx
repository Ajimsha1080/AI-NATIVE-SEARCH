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
  }, []);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-indigo-950 text-white rounded-3xl p-6 lg:p-8 shadow-xl border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-white text-[11px] font-mono backdrop-blur-xs">
            AI-Native Shopping Layer
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
