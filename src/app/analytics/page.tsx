'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import { 
  BarChart3, MessageSquare, Zap, 
  TrendingUp, ArrowUpRight, ShieldCheck, CheckCircle, RefreshCw,
  ShoppingBag, Sparkles, Activity, CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { getClientCachedData } from '@/lib/client-cache';

export default function AnalyticsWorkspacePage() {
  const cachedAnalytics = getClientCachedData('/api/analytics');
  const [data, setData] = useState<any>(() => cachedAnalytics || null);
  const [loading, setLoading] = useState(!cachedAnalytics);
  const [syncing, setSyncing] = useState(false);
  const [liveSync, setLiveSync] = useState(true);

  const fetchAnalytics = async (isManual = false) => {
    if (isManual) setSyncing(true);
    try {
      const res = await fetch('/api/analytics', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (isManual) setSyncing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();

    const interval = setInterval(() => {
      if (liveSync) {
        fetchAnalytics();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [liveSync]);

  const topTools = data?.top_tools || [];

  const dailyTrends = data?.daily_trends || [
    { day: 'Mon', ai: 0, human: 0, total: 0 },
    { day: 'Tue', ai: 0, human: 0, total: 0 },
    { day: 'Wed', ai: 0, human: 0, total: 0 },
    { day: 'Thu', ai: 0, human: 0, total: 0 },
    { day: 'Fri', ai: 0, human: 0, total: 0 },
    { day: 'Sat', ai: 0, human: 0, total: 0 },
    { day: 'Sun', ai: 0, human: 0, total: 0 }
  ];

  const maxDaily = Math.max(...dailyTrends.map((d: any) => d.total || 0), 5);

  return (
    <div className="flex h-screen bg-[#f4f5f7] text-zinc-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f4f5f7]">
        <Navbar />

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Header */}
            <div className="border-b border-zinc-200 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2.5">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Store AI &amp; Real-Time Revenue Analytics
                </h1>
                <p className="text-xs text-zinc-500 mt-1">
                  Real-time metrics on conversion assistance, revenue influenced, autonomous containment, and tool latency.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchAnalytics(true)}
                  disabled={syncing}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                  title="Force refresh store analytics"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Syncing...' : 'Sync Analytics'}</span>
                </button>
              </div>
            </div>


            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 font-mono">
              <div className="bg-white border border-zinc-200 rounded-3xl p-5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between text-zinc-500 text-xs uppercase font-sans font-semibold">
                  <span>Revenue Influenced</span>
                  <span className="text-emerald-600 font-bold text-base font-mono">₹</span>
                </div>
                <div className="text-2xl font-bold text-zinc-900">
                  ₹{Number(data?.revenueInfluenced ?? 0).toLocaleString('en-IN')}
                </div>
                <p className="text-[11px] text-emerald-600 flex items-center gap-1 font-semibold font-sans">
                  <ArrowUpRight className="w-3 h-3" /> Live Store Orders ({data?.ordersCount ?? 0})
                </p>
              </div>

              <div className="bg-white border border-zinc-200 rounded-3xl p-5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between text-zinc-500 text-xs uppercase font-sans font-semibold">
                  <span>AI Containment</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-emerald-600">
                  {data?.containmentRate || '0.0%'}
                </div>
                <p className="text-[11px] text-zinc-500 font-sans">
                  Resolved autonomously
                </p>
              </div>

              <div className="bg-white border border-zinc-200 rounded-3xl p-5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between text-zinc-500 text-xs uppercase font-sans font-semibold">
                  <span>Conversations</span>
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-bold text-zinc-900">
                  {data?.totalConversations ?? 0}
                </div>
                <p className="text-[11px] text-emerald-600 flex items-center gap-1 font-semibold font-sans">
                  <ArrowUpRight className="w-3 h-3" /> {data?.totalMessages ?? 0} messages handled
                </p>
              </div>

              <div className="bg-white border border-zinc-200 rounded-3xl p-5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between text-zinc-500 text-xs uppercase font-sans font-semibold">
                  <span>Avg RAG Latency</span>
                  <Zap className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold text-zinc-900">
                  {data?.avgLatencyMs ?? 0} <span className="text-xs font-normal text-zinc-500 font-sans">ms</span>
                </div>
                <p className="text-[11px] text-zinc-500 font-sans">
                  Real-time tool execution
                </p>
              </div>
            </div>

            {/* Daily Trends & Tool Invocations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* 7-Day Conversation Volume Chart */}
              <div className="bg-white border border-zinc-200 rounded-3xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-800 uppercase font-mono tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-600" /> 7-Day Session Volume (AI vs Human)
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-400">Real-Time Daily Aggregates</span>
                </div>

                <div className="h-44 flex items-end justify-between gap-3 pt-4 border-b border-zinc-100 pb-2">
                  {dailyTrends.map((d: any, idx: number) => {
                    const heightPct = Math.max(Math.round((d.total / maxDaily) * 100), 12);
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                        <div className="text-[10px] font-mono text-zinc-500 font-bold opacity-0 group-hover:opacity-100 transition">
                          {d.total}
                        </div>
                        <div className="w-full bg-zinc-100 rounded-t-xl overflow-hidden flex flex-col justify-end" style={{ height: `${heightPct}%` }}>
                          <div 
                            className="w-full bg-indigo-600 hover:bg-indigo-700 transition duration-300 rounded-t-xl" 
                            style={{ height: `${Math.round((d.ai / (d.total || 1)) * 100)}%` }} 
                            title={`${d.ai} AI Sessions`}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-zinc-500 font-semibold">{d.day}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-center gap-5 text-[11px] font-mono text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                    <span>AI Autonomous ({data?.containmentRate || '0.0%'})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span>Human Takeover ({data?.escalatedCount || 0})</span>
                  </div>
                </div>
              </div>

              {/* Tool Invocations */}
              <div className="bg-white border border-zinc-200 rounded-3xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-800 uppercase font-mono tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" /> Top Tool Invocations
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-400">Live Tool Execution Counts</span>
                </div>

                <div className="space-y-3">
                  {topTools.length === 0 ? (
                    <div className="py-10 text-center text-xs text-zinc-400 font-mono">
                      No tool invocations recorded yet.
                    </div>
                  ) : (
                    topTools.map((t: any, i: number) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-zinc-800 font-semibold truncate max-w-[260px]">{t.name}</span>
                          <span className="text-zinc-500 font-semibold">{t.calls} calls ({t.pct}%)</span>
                        </div>
                        <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-zinc-900 rounded-full transition-all duration-500" 
                            style={{ width: `${t.pct}%` }}
                          ></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Quality & Grounding Card */}
            <div className="bg-white border border-zinc-200 rounded-3xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-800 uppercase font-mono tracking-wider flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" /> Grounding &amp; Quality Metrics
                </h3>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-semibold">
                  Zero Hallucination Verified
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-2xl text-center font-mono">
                  <span className="text-3xl font-bold text-emerald-600">{data?.csat || '0.0 / 5'}</span>
                  <p className="text-xs text-zinc-600 font-sans mt-1 font-semibold">Customer CSAT Satisfaction</p>
                </div>
                <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-2xl text-center font-mono">
                  <span className="text-3xl font-bold text-zinc-900">{data?.groundingAccuracy || '0.0%'}</span>
                  <p className="text-xs text-zinc-600 font-sans mt-1 font-semibold">Grounding &amp; Fact Verification</p>
                </div>
              </div>

              <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl font-mono text-xs text-zinc-600 leading-relaxed flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Zero hallucinated products: all item prices, variant availability, and coupon thresholds are validated against the database before generating responses.</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}