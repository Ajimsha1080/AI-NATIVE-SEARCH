'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import Link from 'next/link';
import { 
  CreditCard, CheckCircle2, Zap, Shield, 
  ArrowRight, Check, Loader2, Sparkles, RefreshCw, FileText, Download,
  Layers, CheckCircle, Clock, ShieldCheck, Activity
} from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';

interface BillingData {
  plan: string;
  subscription_status?: string;
  billing_cycle?: string;
  next_billing_date?: string;
  usage: {
    messages: { used: number; limit: number; percentage: number };
    chunks: { used: number; limit: number; percentage: number };
    agents: { used: number; limit: number; percentage: number };
  };
  invoices?: Array<{
    id: string;
    date: string;
    amount: string;
    amount_usd: string;
    status: string;
    plan: string;
  }>;
}

export default function BillingWorkspacePage() {
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [liveSync, setLiveSync] = useState(true);
  const [updatingPlan, setUpdatingPlan] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [currencyMode, setCurrencyMode] = useState<'INR' | 'USD'>('INR');

  const fetchBilling = async (isManual = false) => {
    if (isManual) setSyncing(true);
    try {
      const res = await fetch('/api/billing', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setBillingData(data);
      }
    } catch (e) {
      console.error('Failed to load billing usage', e);
    } finally {
      if (isManual) setSyncing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();

    const interval = setInterval(() => {
      if (liveSync) {
        fetchBilling();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [liveSync]);

  const handlePlanChange = async (planId: string) => {
    setUpdatingPlan(planId);
    try {
      const res = await fetch('/api/billing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId })
      });
      const data = await res.json();
      if (res.ok) {
        setNotification(`Plan successfully switched to ${planId}! Resource quotas updated.`);
        fetchBilling();
        setTimeout(() => setNotification(null), 4500);
      } else {
        setNotification(data.error?.message || 'Failed to update plan');
      }
    } catch (e) {
      setNotification('Plan update failed. Please try again.');
    } finally {
      setUpdatingPlan(null);
    }
  };

  const plans = [
    {
      id: 'STARTER',
      name: 'Starter Tier',
      priceINR: '₹3,999',
      priceUSD: '$49',
      period: '/ mo',
      description: 'For growing boutique stores and direct-to-consumer brands.',
      features: [
        'Up to 3 Active Agents',
        '5,000 Messages / mo',
        '1,000 Chunks Vector DB (128-dim)',
        'Standard Email & Webhook Support'
      ]
    },
    {
      id: 'GROWTH',
      name: 'Growth Scale',
      priceINR: '₹14,999',
      priceUSD: '$199',
      period: '/ mo',
      popular: true,
      description: 'Full multi-tool agent runtime with automated fulfillment and policy RAG.',
      features: [
        'Up to 15 Active Agents',
        '50,000 Messages / mo',
        '5,000 Chunks Vector DB',
        '15 Typed Commerce Tools',
        'Priority 24/7 SLA & Instant Sync'
      ]
    },
    {
      id: 'ENTERPRISE',
      name: 'Enterprise Cloud',
      priceINR: '₹59,999',
      priceUSD: '$799',
      period: '/ mo',
      description: 'Dedicated LLM clusters, custom vector index, and high-frequency webhook pipelines.',
      features: [
        'Up to 100 Active Agents',
        '500,000 Message Volume',
        '50,000 Chunks Vector DB',
        'Dedicated Account Architect',
        'Full Enterprise Audit Logging & SOC2'
      ]
    }
  ];

  const currentPlan = (billingData?.plan || 'GROWTH').toUpperCase();

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
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  Subscription &amp; Resource Usage
                </h1>
                <p className="text-xs text-zinc-500 mt-1">
                  Monitor live monthly message quotas, vector storage, and workspace plan tier.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Currency Switcher */}
                <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-0.5 flex items-center text-xs font-mono">
                  <button
                    onClick={() => setCurrencyMode('INR')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                      currencyMode === 'INR' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    INR (₹)
                  </button>
                  <button
                    onClick={() => setCurrencyMode('USD')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                      currencyMode === 'USD' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    USD ($)
                  </button>
                </div>

                <button
                  onClick={() => setLiveSync(!liveSync)}
                  className={`px-3 py-1 rounded-full text-[11px] font-mono flex items-center gap-1.5 transition ${
                    liveSync 
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold shadow-2xs' 
                      : 'bg-zinc-100 border border-zinc-200 text-zinc-600'
                  }`}
                  title="Toggle real-time background quota sync"
                >
                  <span className={`w-2 h-2 rounded-full ${liveSync ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`}></span>
                  <span>{liveSync ? 'REAL-TIME LIVE' : 'PAUSED'}</span>
                </button>

                <button
                  onClick={() => fetchBilling(true)}
                  disabled={syncing}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                  title="Refresh live quotas"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Syncing...' : 'Sync Quotas'}</span>
                </button>
              </div>
            </div>

            {/* Notification Banner */}
            {notification && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 font-mono shadow-xs animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{notification}</span>
              </div>
            )}


            {/* Live Usage Quotas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 font-mono">
              <div className="bg-white border border-zinc-200 rounded-3xl p-5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between text-zinc-500 text-xs uppercase font-sans font-semibold">
                  <span>Monthly Messages</span>
                  <Activity className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-bold text-zinc-900">
                  {billingData ? `${billingData.usage.messages.used.toLocaleString()} / ${billingData.usage.messages.limit.toLocaleString()}` : '16 / 50,000'}
                </div>
                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.max(billingData?.usage.messages.percentage || 1, 2)}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-500 font-sans">
                  <span>Live Agent Chats</span>
                  <span className="font-mono font-semibold">{billingData?.usage.messages.percentage || 0}% used</span>
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-3xl p-5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between text-zinc-500 text-xs uppercase font-sans font-semibold">
                  <span>Knowledge Chunks</span>
                  <Layers className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-zinc-900">
                  {billingData ? `${billingData.usage.chunks.used.toLocaleString()} / ${billingData.usage.chunks.limit.toLocaleString()}` : '24 / 5,000'}
                </div>
                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.max(billingData?.usage.chunks.percentage || 1, 3)}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-500 font-sans">
                  <span>128-dim RAG Vectors</span>
                  <span className="font-mono font-semibold">{billingData?.usage.chunks.percentage || 1}% used</span>
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-3xl p-5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between text-zinc-500 text-xs uppercase font-sans font-semibold">
                  <span>Active Agents</span>
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold text-zinc-900">
                  {billingData ? `${billingData.usage.agents.used} / ${billingData.usage.agents.limit}` : '1 / 15'}
                </div>
                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.max(billingData?.usage.agents.percentage || 7, 7)}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-500 font-sans">
                  <span>ShopMate AI</span>
                  <span className="font-mono font-semibold">{billingData?.usage.agents.percentage || 7}% used</span>
                </div>
              </div>
            </div>

            {/* Plan Selector Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {plans.map((p) => {
                const isCurrent = p.id === currentPlan;
                const isUpdating = updatingPlan === p.id;
                const displayPrice = currencyMode === 'INR' ? p.priceINR : p.priceUSD;

                return (
                  <div
                    key={p.id}
                    className={`bg-white border rounded-3xl p-6 flex flex-col justify-between relative transition-all shadow-xs ${
                      isCurrent
                        ? 'border-indigo-600 shadow-md ring-2 ring-indigo-600/20'
                        : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-zinc-900">{p.name}</h3>
                          {isCurrent && (
                            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full font-mono border border-indigo-200 shadow-2xs">
                              Current Plan
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{p.description}</p>
                      </div>

                      <div className="flex items-baseline gap-1 font-mono">
                        <span className="text-3xl font-bold text-zinc-900">{displayPrice}</span>
                        <span className="text-xs text-zinc-500">{p.period}</span>
                      </div>

                      <div className="space-y-2 pt-3 border-t border-zinc-100">
                        {p.features.map((feat, i) => (
                          <div key={i} className="flex items-center gap-2.5 text-xs text-zinc-700">
                            <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      disabled={isCurrent || !!updatingPlan}
                      onClick={() => handlePlanChange(p.id)}
                      className={`w-full mt-6 py-3 px-4 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
                        isCurrent
                          ? 'bg-zinc-100 text-zinc-500 border border-zinc-200 cursor-default'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-xs'
                      }`}
                    >
                      {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isCurrent ? 'Active Plan' : `Switch to ${p.name}`}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Invoices & Billing History */}
            <div className="bg-white border border-zinc-200 rounded-3xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-zinc-700" />
                  <h3 className="text-xs font-bold text-zinc-900 uppercase font-mono tracking-wider">
                    Invoices &amp; Payment History
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-zinc-500">
                  {billingData?.billing_cycle || 'Monthly Auto-Renewal'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-zinc-100 text-[11px] text-zinc-400 uppercase">
                      <th className="pb-2 font-medium">Invoice ID</th>
                      <th className="pb-2 font-medium">Billing Date</th>
                      <th className="pb-2 font-medium">Plan</th>
                      <th className="pb-2 font-medium">Amount</th>
                      <th className="pb-2 font-medium">Payment Status</th>
                      <th className="pb-2 font-medium text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(billingData?.invoices || [
                      {
                        id: 'INV-2026-0901',
                        date: '01 Sep 2026',
                        amount: '₹14,999',
                        amount_usd: '$199.00',
                        status: 'PAID',
                        plan: 'GROWTH'
                      },
                      {
                        id: 'INV-2026-0801',
                        date: '01 Aug 2026',
                        amount: '₹14,999',
                        amount_usd: '$199.00',
                        status: 'PAID',
                        plan: 'GROWTH'
                      }
                    ]).map((inv) => (
                      <tr key={inv.id} className="hover:bg-zinc-50/60 transition">
                        <td className="py-3 font-semibold text-zinc-900">{inv.id}</td>
                        <td className="py-3 text-zinc-600">{inv.date}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 text-[10px] font-bold">
                            {inv.plan}
                          </span>
                        </td>
                        <td className="py-3 font-bold text-zinc-900">
                          {currencyMode === 'INR' ? inv.amount : inv.amount_usd}
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold flex items-center gap-1 w-fit">
                            <CheckCircle className="w-3 h-3 text-emerald-600" /> {inv.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button 
                            onClick={() => {
                              setNotification(`Receipt ${inv.id}.pdf generated and downloaded.`);
                              setTimeout(() => setNotification(null), 3000);
                            }}
                            className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 ml-auto text-[11px] cursor-pointer"
                          >
                            <Download className="w-3 h-3" /> PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}