'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, Search, MessageSquare, ShoppingCart, 
  ArrowUpRight, Percent, RefreshCw, Calendar
} from 'lucide-react';

export default function AnalyticsDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30d');

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/analytics/summary?range=${range}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Failed to load analytics', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [range]);

  const metrics = data?.metrics || { searches: 0, chats: 0, orders: 0, revenue: 0, conversion_rate_percent: 0 };
  const topQueries = data?.top_queries || [];
  const zeroResultQueries = data?.zero_result_queries || [];

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">AI Commerce Analytics</h1>
          <p className="text-xs text-zinc-500">Real-time search volume, AI chat discovery queries, and conversion attribution.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-xl p-1 shadow-2xs">
            {['7d', '30d', '90d'].map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  range === r ? 'bg-zinc-900 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            onClick={fetchAnalytics}
            className="p-2 bg-white border border-zinc-200 rounded-xl text-zinc-600 hover:bg-zinc-50 transition shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium">AI Search Queries</span>
            <Search className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900">{metrics.searches.toLocaleString()}</div>
          <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Powered by hybrid semantic ranking
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium">Chat Inquiries</span>
            <MessageSquare className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900">{metrics.chats.toLocaleString()}</div>
          <p className="text-[11px] text-zinc-400">Conversational product guidance</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium">Attributed Orders</span>
            <ShoppingCart className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900">{metrics.orders.toLocaleString()}</div>
          <p className="text-[11px] text-zinc-400">₹{metrics.revenue.toLocaleString('en-IN')} total volume</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium">Search Conversion</span>
            <Percent className="w-4 h-4 text-violet-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900">{metrics.conversion_rate_percent}%</div>
          <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" /> High purchase intent
          </p>
        </div>
      </div>

      {/* Top Queries & Zero Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Queries Table */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-900">Top Searched Queries</h3>
            <span className="text-[11px] text-zinc-400">Volume &amp; Orders</span>
          </div>

          <div className="divide-y divide-zinc-100 text-xs">
            {topQueries.map((item: any, idx: number) => (
              <div key={idx} className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-zinc-800">{item.query}</span>
                  <div className="text-[11px] text-zinc-400">{item.count} searches</div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-emerald-600">{item.conversions} orders</span>
                  <div className="text-[10px] text-zinc-400">
                    {item.count > 0 ? ((item.conversions / item.count) * 100).toFixed(1) : 0}% conv
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Zero Result Queries (Catalog Demand Gap) */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-900">Zero-Result Queries</h3>
            <span className="text-[11px] text-amber-600 font-medium">Catalog Demand Gaps</span>
          </div>

          <p className="text-xs text-zinc-500">
            Searches where customers found zero matching items. Add these products or sync keywords to capture lost revenue.
          </p>

          <div className="divide-y divide-zinc-100 text-xs">
            {zeroResultQueries.map((item: any, idx: number) => (
              <div key={idx} className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-zinc-800">{item.query}</span>
                  <div className="text-[11px] text-zinc-400">Last asked: {item.last_searched}</div>
                </div>
                <div className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[10px] border border-rose-200">
                  {item.count} missed searches
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
