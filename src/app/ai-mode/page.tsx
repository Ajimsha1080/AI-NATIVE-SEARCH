'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Sparkles, BookOpen, Search, Eye, Globe, 
  Settings, CheckCircle2, Zap, ArrowRight, ShieldCheck, 
  Layers, RefreshCw, Cpu, Database, Activity
} from 'lucide-react';
import { AiModeConfig, AiModeKnowledgeSource, AiModeDeployment } from '@/ai-mode/types';

export default function AiModeOverviewPage() {
  const [config, setConfig] = useState<AiModeConfig | null>(null);
  const [sources, setSources] = useState<AiModeKnowledgeSource[]>([]);
  const [deployments, setDeployments] = useState<AiModeDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [cfgRes, srcRes, depRes] = await Promise.all([
          fetch('/api/ai-mode/config'),
          fetch('/api/ai-mode/knowledge'),
          fetch('/api/ai-mode/deployments')
        ]);

        if (cfgRes.ok) {
          const cfgData = await cfgRes.json();
          setConfig(cfgData.config);
        }
        if (srcRes.ok) {
          const srcData = await srcRes.json();
          setSources(srcData.sources || []);
        }
        if (depRes.ok) {
          const depData = await depRes.json();
          setDeployments(depData.deployments || []);
        }
      } catch (e) {
        console.error('Failed to load overview data:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleToggleAiMode = async () => {
    if (!config || toggling) return;
    setToggling(true);
    try {
      const res = await fetch('/api/ai-mode/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !config.enabled })
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
      }
    } catch (e) {
      console.error('Toggle error:', e);
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const isEnabled = config?.enabled ?? true;

  return (
    <div className="space-y-6">
      {/* Banner / Feature Flag Card */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-zinc-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold backdrop-blur-xs">
              <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-400'}`}></span>
              <span>{isEnabled ? 'AI Mode Engine: ONLINE' : 'AI Mode Engine: PAUSED'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              AI-Native Shopping Intelligence
            </h2>
            <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed">
              An isolated, additive intelligence layer that understands natural shopping requests, extracts real-time merchant product semantics, provides side-by-side comparisons, and deploys as a dedicated AI Mode widget.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <button
              onClick={handleToggleAiMode}
              disabled={toggling}
              className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md ${
                isEnabled
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200'
              }`}
            >
              {toggling && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{isEnabled ? 'AI Mode Enabled' : 'Enable AI Mode'}</span>
            </button>
            <Link
              href="/ai-mode/preview"
              className="px-5 py-2.5 rounded-2xl bg-white hover:bg-zinc-100 text-zinc-950 text-xs font-bold transition flex items-center gap-2 shadow-md"
            >
              <Eye className="w-4 h-4 text-indigo-600" />
              <span>Open Preview</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-semibold">Knowledge Sources</span>
            <BookOpen className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-zinc-900">{sources.length}</div>
          <p className="text-[11px] text-zinc-500 font-medium">Web crawlers & uploaded docs</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-semibold">Search Engine</span>
            <Search className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-zinc-900">Hybrid Dense + BM25</div>
          <p className="text-[11px] text-zinc-500 font-medium">Zero query hardcoding</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-semibold">AI Deployments</span>
            <Globe className="w-4 h-4 text-violet-600" />
          </div>
          <div className="text-2xl font-bold text-zinc-900">{deployments.length}</div>
          <p className="text-[11px] text-zinc-500 font-medium">Independent widget instances</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-semibold">System Isolation</span>
            <ShieldCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-zinc-900">Protected</div>
          <p className="text-[11px] text-zinc-500 font-medium">Safe adapters & zero regressions</p>
        </div>
      </div>

      {/* Feature Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Knowledge Card */}
        <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">Knowledge Management</h3>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Connect your website URL to extract Schema.org JSON-LD products, or upload PDFs, DOCX, FAQs, and brand guides.
              </p>
            </div>
          </div>
          <Link
            href="/ai-mode/knowledge"
            className="flex items-center justify-between pt-3 border-t border-zinc-100 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition"
          >
            <span>Manage Knowledge Sources</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* AI Search Card */}
        <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">AI Search Engine</h3>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Test arbitrary natural-language shopping queries, inspect query plans, and verify hybrid retrieval diagnostics.
              </p>
            </div>
          </div>
          <Link
            href="/ai-mode/search"
            className="flex items-center justify-between pt-3 border-t border-zinc-100 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition"
          >
            <span>Open Search Workbench</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Deployment Card */}
        <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">Widget & Deployment</h3>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Deploy the standalone AI Mode widget to your store via script tag or iframe, configure themes, and set domain restrictions.
              </p>
            </div>
          </div>
          <Link
            href="/ai-mode/deployment"
            className="flex items-center justify-between pt-3 border-t border-zinc-100 text-xs font-bold text-violet-600 hover:text-violet-700 transition"
          >
            <span>Configure Deployments</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
