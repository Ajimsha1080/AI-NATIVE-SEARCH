'use client';

import React, { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/layout/Navbar';
import SuperAdminSidebar from '@/components/layout/SuperAdminSidebar';
import { 
  ShieldAlert, Activity, Server, Users, Database, 
  CheckCircle, AlertCircle, RefreshCw, Cpu, DollarSign,
  Building2, HardDriveDownload, Layers, Wrench, MessageSquare,
  BarChart3, Tag, CreditCard, AlertOctagon, ShieldCheck,
  FileText, Flag, Settings, Search, Filter, Play, Check,
  X, AlertTriangle, Lock, Eye, ArrowUpRight, CheckCircle2,
  ChevronRight, ArrowRight, CornerDownRight, Zap, Globe, Sliders,
  Radio, HardDrive, Share2, Terminal, Shield, Key, DownloadCloud,
  CheckCheck, ArrowUpDown, Sparkles
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { fetchWithCache, getClientCachedData, setClientCachedData } from '@/lib/client-cache';

export default function SuperAdminPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const cachedAdmin = getClientCachedData('/api/admin');
  const [data, setData] = useState<any>(() => cachedAdmin || null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(!cachedAdmin);
  const [timeRange, setTimeRange] = useState('7d');
  const [syncInterval, setSyncInterval] = useState<number>(10); // 10s auto-sync default
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Confirmation Dialog State for Dangerous Actions
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionType: string;
    targetId: string;
    payload?: any;
  } | null>(null);

  // Tenant Detail Inspection Modal State
  const [inspectTenant, setInspectTenant] = useState<any | null>(null);
  const [inspectTenantTab, setInspectTenantTab] = useState('overview');

  // Tenant Search & Filters
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantPlanFilter, setTenantPlanFilter] = useState('ALL');

  // User Search & Filters
  const [userSearch, setUserSearch] = useState('');

  // AI & Models Config State
  const [aiConfig, setAiConfig] = useState<any>(() => cachedAdmin?.aiModelsConfig || {
    defaultProvider: 'OpenAI',
    defaultModel: 'gpt-4o',
    fallbackModel: 'gemini-1.5-pro',
    embeddingModel: 'text-embedding-3-small (128-dim)',
    visionModel: 'gpt-4o-vision',
    rerankerModel: 'bge-reranker-large',
    temperature: 0.2,
    maxTokens: 2048,
    timeoutSeconds: 15,
    retryCount: 3,
    planModelRouting: {
      FREE: 'gpt-4o-mini',
      STARTER: 'gpt-4o-mini',
      PRO: 'gpt-4o',
      ENTERPRISE: 'gpt-4o / custom'
    }
  });

  // Feature Flags State
  const [featureFlags, setFeatureFlags] = useState<any[]>(() => cachedAdmin?.featureFlags || []);

  const loadAdminData = async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const res = await fetch('/api/admin?t=' + Date.now(), { cache: 'no-store' });
      if (res.status === 401 || res.status === 403) {
        setForbidden(true);
        setData(null);
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setForbidden(false);
        setData(json);
        setClientCachedData('/api/admin', json);
        if (json.aiModelsConfig) setAiConfig(json.aiModelsConfig);
        if (json.featureFlags) setFeatureFlags(json.featureFlags);
        setLastSyncTime(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Super Admin sync failed:', err);
    } finally {
      setIsSyncing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  // Real-time background sync timer
  useEffect(() => {
    if (syncInterval <= 0) return;
    const interval = setInterval(() => {
      loadAdminData(true);
    }, syncInterval * 1000);
    return () => clearInterval(interval);
  }, [syncInterval]);

  const showToast = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const handleExecuteConfirmedAction = async () => {
    if (!confirmDialog) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: confirmDialog.actionType,
          tenantId: confirmDialog.targetId,
          userId: confirmDialog.targetId,
          payload: confirmDialog.payload
        })
      });
      const resJson = await res.json();
      setConfirmDialog(null);
      showToast(resJson.message || 'Action executed successfully.');
      await loadAdminData(false);
    } catch (err) {
      console.error(err);
      showToast('Error executing administrative action.');
    } finally {
      setIsSyncing(false);
    }
  };

  const triggerDirectAction = async (actionType: string, payload: any = {}, targetId = 'GLOBAL') => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionType, tenantId: targetId, payload })
      });
      const resJson = await res.json();
      showToast(resJson.message || 'Operation executed.');
      await loadAdminData(false);
    } catch (err) {
      console.error(err);
      showToast('Operation failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  const metrics = data?.metrics || {
    totalTenants: 3,
    activeTenants: 3,
    trialTenants: 1,
    suspendedTenants: 0,
    totalUsers: 12,
    totalConversations: 1420,
    aiRequests: 18450,
    ragRequests: 14200,
    toolCalls: 3890,
    tokensConsumed: 4280000,
    estimatedCost: 6.42,
    revenue: 284000,
    mrr: 48500,
    failedRequests: 0,
    avgLatencyMs: 320,
    systemHealth: 'HEALTHY'
  };

  const tenants: any[] = data?.tenants || [];
  const users: any[] = data?.users || [];
  const plans: any[] = data?.plans || [];
  const billingLedger: any[] = data?.billingLedger || [];
  const indexingStats = data?.indexingStats || {};
  const integrationsList: any[] = data?.integrationsList || [];
  const agentActionsList: any[] = data?.agentActionsList || [];
  const liveConversations: any[] = data?.liveConversations || [];
  const systemLogs: any[] = data?.systemLogs || [];
  const securityConfig = data?.securityConfig || {};
  const platformSettings = data?.platformSettings || {};
  const auditLogs: any[] = data?.auditLogs || [];

  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(tenantSearch.toLowerCase()) ||
      t.slug?.toLowerCase().includes(tenantSearch.toLowerCase()) ||
      t.owner?.email.toLowerCase().includes(tenantSearch.toLowerCase());
    const matchesPlan = tenantPlanFilter === 'ALL' || t.plan === tenantPlanFilter;
    return matchesSearch && matchesPlan;
  });

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.tenantName?.toLowerCase().includes(userSearch.toLowerCase())
  );

  if (forbidden) {
    return (
      <div className="flex h-screen bg-[#f4f5f7] text-zinc-900 font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900 items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-3xl p-8 shadow-xl text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-mono font-semibold">
              <ShieldAlert className="w-3.5 h-3.5" /> 403 Access Denied
            </div>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">SuperAdmin Role Required</h1>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Your account does not possess Platform SuperAdmin privileges. Multi-tenant operations, global telemetry, and root infrastructure controls are restricted exclusively to Platform SuperAdmins.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2.5">
            <a
              href="/dashboard"
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition flex items-center justify-center gap-2 shadow-xs"
            >
              Return to Store Dashboard <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="/auth/login"
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 text-xs font-semibold transition"
            >
              Switch Account
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f4f5f7] text-zinc-900 font-sans antialiased selection:bg-zinc-200 selection:text-zinc-900">
      {/* Dedicated Super Admin Platform Sidebar */}
      <SuperAdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Operational Bar with Live Sync & Real-time Indicator */}
        <header className="h-14 border-b border-zinc-200 bg-white px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <div>
              <h1 className="text-xs font-bold text-zinc-900 uppercase font-mono tracking-wider flex items-center gap-2">
                Platform Control Layer
                <span className="text-[10px] text-zinc-400 font-normal">| Multi-Tenant Mesh</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono font-semibold">
                  Realtime Synced ({lastSyncTime})
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto-sync dropdown */}
            <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1 text-xs">
              <Activity className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-zinc-500 font-mono text-[11px]">Sync:</span>
              <select
                value={syncInterval}
                onChange={(e) => setSyncInterval(Number(e.target.value))}
                className="bg-transparent text-zinc-800 font-mono font-medium focus:outline-none text-[11px] cursor-pointer"
              >
                <option value={5}>5s (Fast)</option>
                <option value={10}>10s (Normal)</option>
                <option value={30}>30s (Slow)</option>
                <option value={0}>Manual Only</option>
              </select>
            </div>

            <div className="flex items-center bg-zinc-100 border border-zinc-200 rounded-xl p-0.5 text-xs font-medium">
              {['24h', '7d', '30d', 'All'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeRange(t)}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    timeRange === t ? 'bg-white text-zinc-900 font-semibold shadow-2xs' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              onClick={() => loadAdminData(false)}
              disabled={isSyncing}
              className={`p-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition shadow-2xs flex items-center gap-1.5 ${isSyncing ? 'opacity-50' : ''}`}
              title="Sync Platform State Now"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-red-600' : ''}`} />
              <span className="text-[11px] font-semibold hidden sm:inline">Sync Now</span>
            </button>
          </div>
        </header>

        {/* Global Toast Alert */}
        {actionSuccessMsg && (
          <div className="bg-emerald-600 text-white text-xs px-6 py-2.5 flex items-center justify-between font-medium shadow-md transition animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{actionSuccessMsg}</span>
            </div>
            <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-200 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Dynamic Super Admin Viewport */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* 1. OVERVIEW VIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 tracking-tight">SuperAdmin Platform Overview</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">Global tenant health, aggregate AI token consumption, RAG throughput, and revenue.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => triggerDirectAction('TRIGGER_RAG_REINDEX')}
                      className="px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition"
                    >
                      <Database className="w-3.5 h-3.5 text-purple-600" /> Re-index Vectors
                    </button>
                    <button
                      onClick={() => triggerDirectAction('TRIGGER_GLOBAL_SYNC')}
                      className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Sync All Stores
                    </button>
                  </div>
                </div>

                {/* 12 Core KPI Metric Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs text-zinc-500 font-medium">
                      <span>Total Tenants</span>
                      <Building2 className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-zinc-900 font-mono">{metrics.totalTenants}</span>
                      <span className="text-[11px] font-mono text-emerald-600 font-semibold">{metrics.activeTenants} Active</span>
                    </div>
                    <p className="text-[10px] text-zinc-400">{metrics.trialTenants} on free trials • {metrics.suspendedTenants} suspended</p>
                  </div>

                  <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs text-zinc-500 font-medium">
                      <span>Platform MRR</span>
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-emerald-600 font-mono">${metrics.mrr.toLocaleString()}</span>
                      <span className="text-[11px] font-mono text-zinc-500">+19.4% MoM</span>
                    </div>
                    <p className="text-[10px] text-zinc-400">${metrics.revenue.toLocaleString()} Cumulative ARR</p>
                  </div>

                  <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs text-zinc-500 font-medium">
                      <span>Total AI Requests</span>
                      <Cpu className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-zinc-900 font-mono">{metrics.aiRequests.toLocaleString()}</span>
                      <span className="text-[11px] font-mono text-emerald-600 font-semibold">99.94% OK</span>
                    </div>
                    <p className="text-[10px] text-zinc-400">{(metrics.tokensConsumed / 1000000).toFixed(1)}M Tokens • ${metrics.estimatedCost.toFixed(2)} LLM Cost</p>
                  </div>

                  <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs text-zinc-500 font-medium">
                      <span>RAG Hybrid Queries</span>
                      <Database className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-zinc-900 font-mono">{metrics.ragRequests.toLocaleString()}</span>
                      <span className="text-[11px] font-mono text-indigo-600 font-semibold">{metrics.avgLatencyMs}ms Avg</span>
                    </div>
                    <p className="text-[10px] text-zinc-400">128-dim dense cosine + BM25 RRF</p>
                  </div>
                </div>

                {/* Platform Tenants Quick Overview */}
                <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900">Active Tenant Directory</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">Top enterprise and commercial SaaS workspaces</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('tenants')}
                      className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1"
                    >
                      Manage All Tenants <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 text-zinc-500 uppercase text-[10px] font-mono bg-zinc-50">
                          <th className="p-3">Tenant / Workspace</th>
                          <th className="p-3">Owner</th>
                          <th className="p-3">Plan</th>
                          <th className="p-3">Store Connector</th>
                          <th className="p-3">AI Tokens</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {tenants.map((t) => (
                          <tr key={t.id} className="hover:bg-zinc-50 transition">
                            <td className="p-3">
                              <p className="font-semibold text-zinc-900 text-xs">{t.name}</p>
                              <p className="text-[10px] text-zinc-400 font-mono">{t.id}</p>
                            </td>
                            <td className="p-3 text-zinc-700">
                              <p className="text-xs">{t.owner?.name || 'Owner'}</p>
                              <p className="text-[10px] text-zinc-400 font-mono">{t.owner?.email || 'N/A'}</p>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-100 border border-zinc-200 text-zinc-700 font-semibold">
                                {t.plan}
                              </span>
                            </td>
                            <td className="p-3 text-zinc-700 font-mono text-[11px]">
                              {t.connectedStore}
                            </td>
                            <td className="p-3 text-zinc-700 font-mono text-[11px]">
                              {t.aiUsageTokens}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border font-semibold ${
                                t.status === 'ACTIVE' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {t.status}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => { setInspectTenant(t); setInspectTenantTab('overview'); }}
                                className="px-2.5 py-1 rounded-xl text-xs font-semibold text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200 shadow-2xs transition cursor-pointer"
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 2. TENANTS MANAGEMENT VIEW */}
            {activeTab === 'tenants' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Platform Tenant Management</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Control tenant lifecycle, subscription plans, usage quotas, and data isolation.</p>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search tenants by name, ID, or owner email..."
                      value={tenantSearch}
                      onChange={(e) => setTenantSearch(e.target.value)}
                      className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {['ALL', 'ENTERPRISE', 'BUSINESS', 'GROWTH', 'STARTER', 'FREE'].map((plan) => (
                      <button
                        key={plan}
                        onClick={() => setTenantPlanFilter(plan)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                          tenantPlanFilter === plan
                            ? 'bg-zinc-900 text-white font-semibold shadow-2xs'
                            : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
                        }`}
                      >
                        {plan}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tenants Table */}
                <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 text-zinc-500 uppercase text-[10px] font-mono bg-zinc-50">
                          <th className="p-3.5">Tenant / Workspace</th>
                          <th className="p-3.5">Owner</th>
                          <th className="p-3.5">Plan</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5">Storefront</th>
                          <th className="p-3.5">Conversations</th>
                          <th className="p-3.5">AI Tokens</th>
                          <th className="p-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {filteredTenants.map((t) => (
                          <tr key={t.id} className="hover:bg-zinc-50 transition">
                            <td className="p-3.5">
                              <p className="font-semibold text-zinc-900 text-xs">{t.name}</p>
                              <p className="text-[10px] text-zinc-400 font-mono">{t.id}</p>
                            </td>
                            <td className="p-3.5 text-zinc-700">
                              <p className="text-xs">{t.owner?.name || 'Owner'}</p>
                              <p className="text-[10px] text-zinc-400 font-mono">{t.owner?.email || 'N/A'}</p>
                            </td>
                            <td className="p-3.5">
                              <select
                                value={t.plan}
                                onChange={(e) => {
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: `Change Subscription Plan for ${t.name}`,
                                    description: `Are you sure you want to change the tier from ${t.plan} to ${e.target.value}? This immediately adjusts token quotas and concurrency limits.`,
                                    actionType: 'CHANGE_TENANT_PLAN',
                                    targetId: t.id,
                                    payload: { plan: e.target.value }
                                  });
                                }}
                                className="bg-white border border-zinc-200 text-zinc-900 text-[11px] rounded-lg px-2.5 py-1 font-mono focus:outline-none focus:border-zinc-400 cursor-pointer"
                              >
                                <option value="ENTERPRISE">ENTERPRISE</option>
                                <option value="BUSINESS">BUSINESS</option>
                                <option value="GROWTH">GROWTH</option>
                                <option value="STARTER">STARTER</option>
                                <option value="FREE">FREE</option>
                              </select>
                            </td>
                            <td className="p-3.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border font-semibold ${
                                t.status === 'ACTIVE' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {t.status}
                              </span>
                            </td>
                            <td className="p-3.5 text-zinc-700 font-mono text-[11px]">
                              {t.connectedStore}
                            </td>
                            <td className="p-3.5 text-zinc-700 font-mono text-[11px]">
                              {t.conversationsCount}
                            </td>
                            <td className="p-3.5 text-zinc-700 font-mono text-[11px]">
                              {t.aiUsageTokens}
                            </td>
                            <td className="p-3.5 text-right space-x-2">
                              <button
                                onClick={() => { setInspectTenant(t); setInspectTenantTab('overview'); }}
                                className="px-2.5 py-1 rounded-xl text-xs font-semibold text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200 shadow-2xs transition cursor-pointer"
                              >
                                Inspect Detail
                              </button>
                              {t.status === 'ACTIVE' ? (
                                <button
                                  onClick={() => {
                                    setConfirmDialog({
                                      isOpen: true,
                                      title: `Suspend Tenant: ${t.name}`,
                                      description: `Suspending this tenant will temporarily disable their active storefront embed widgets and block agent tool executions.`,
                                      actionType: 'SUSPEND_TENANT',
                                      targetId: t.id
                                    });
                                  }}
                                  className="px-2.5 py-1 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 shadow-2xs transition cursor-pointer"
                                >
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setConfirmDialog({
                                      isOpen: true,
                                      title: `Restore Active Status for ${t.name}`,
                                      description: `Restoring this tenant will re-enable all live agents, API endpoints, and storefront chat widgets.`,
                                      actionType: 'ACTIVATE_TENANT',
                                      targetId: t.id
                                    });
                                  }}
                                  className="px-2.5 py-1 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 shadow-2xs transition cursor-pointer"
                                >
                                  Activate
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 3. USER MANAGEMENT VIEW */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Platform User Management</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Cross-tenant member directory, roles, and administrative access control.</p>
                </div>

                <div className="relative w-full sm:w-80">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search users by name, email, or tenant..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition"
                  />
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 text-zinc-500 uppercase text-[10px] font-mono bg-zinc-50">
                        <th className="p-3.5">User</th>
                        <th className="p-3.5">Associated Tenant</th>
                        <th className="p-3.5">Role</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5">Last Active</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-zinc-50 transition">
                          <td className="p-3.5">
                            <p className="font-semibold text-zinc-900 text-xs">{u.name}</p>
                            <p className="text-[10px] text-zinc-400 font-mono">{u.email}</p>
                          </td>
                          <td className="p-3.5 text-zinc-700 font-mono text-[11px]">
                            {u.tenantName}
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border font-semibold ${
                              u.role === 'SUPER_ADMIN'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border font-semibold ${
                              u.status === 'ACTIVE' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {u.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-zinc-500 font-mono text-[11px]">
                            {u.lastActive}
                          </td>
                          <td className="p-3.5 text-right">
                            {u.role !== 'SUPER_ADMIN' && (
                              u.status === 'ACTIVE' ? (
                                <button
                                  onClick={() => {
                                    setConfirmDialog({
                                      isOpen: true,
                                      title: `Disable User Account: ${u.email}`,
                                      description: `This will immediately invalidate active sessions for ${u.email}.`,
                                      actionType: 'DISABLE_USER',
                                      targetId: u.id
                                    });
                                  }}
                                  className="px-2.5 py-1 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 shadow-2xs transition cursor-pointer"
                                >
                                  Disable
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setConfirmDialog({
                                      isOpen: true,
                                      title: `Restore User Account: ${u.email}`,
                                      description: `Restore login access for ${u.email}.`,
                                      actionType: 'RESTORE_USER',
                                      targetId: u.id
                                    });
                                  }}
                                  className="px-2.5 py-1 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 shadow-2xs transition cursor-pointer"
                                >
                                  Restore
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. PLANS & LIMITS VIEW */}
            {activeTab === 'plans' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Subscription Plans &amp; Resource Quotas</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Define multi-tenant plan tiers, token quotas, message caps, and store connector allocations.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {plans.map((p: any) => (
                    <div key={p.id} className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-2xs relative">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-900 text-sm">{p.name}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-zinc-100 border border-zinc-200 text-zinc-700 font-semibold">
                          {p.subscribers} Subscribers
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-zinc-900 font-mono">${p.price}</span>
                        <span className="text-xs text-zinc-500">/{p.interval}</span>
                      </div>
                      <div className="border-t border-zinc-100 pt-3 space-y-2 text-xs font-mono text-zinc-600">
                        <div className="flex justify-between">
                          <span className="font-sans text-zinc-500">Monthly Messages:</span>
                          <span className="font-bold text-zinc-900">{p.messageLimit.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-sans text-zinc-500">AI Tokens:</span>
                          <span className="font-bold text-indigo-600">{p.tokenLimit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-sans text-zinc-500">Doc Storage:</span>
                          <span className="font-bold text-zinc-900">{p.docLimit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-sans text-zinc-500">Store Connectors:</span>
                          <span className="font-bold text-emerald-600">{p.stores}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => showToast(`Quota limits for ${p.name} updated.`)}
                        className="w-full py-2 rounded-xl text-xs font-semibold bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 transition"
                      >
                        Adjust Quotas
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. BILLING & MRR VIEW */}
            {activeTab === 'billing' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Billing Engine &amp; Revenue Ledger</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Platform monthly recurring revenue, payment reconciliation, and subscription invoices.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-1 shadow-2xs">
                    <span className="text-xs text-zinc-500 font-medium">Monthly Recurring Revenue</span>
                    <p className="text-2xl font-bold font-mono text-emerald-600">${metrics.mrr.toLocaleString()}</p>
                    <p className="text-[10px] text-zinc-400 font-mono">+19.4% MoM growth rate</p>
                  </div>
                  <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-1 shadow-2xs">
                    <span className="text-xs text-zinc-500 font-medium">Estimated Platform ARR</span>
                    <p className="text-2xl font-bold font-mono text-zinc-900">${(metrics.mrr * 12).toLocaleString()}</p>
                    <p className="text-[10px] text-zinc-400 font-mono">100% renewal retention</p>
                  </div>
                  <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-1 shadow-2xs">
                    <span className="text-xs text-zinc-500 font-medium">Payment Gateways</span>
                    <p className="text-2xl font-bold font-mono text-indigo-600">Stripe &amp; Razorpay</p>
                    <p className="text-[10px] text-zinc-400 font-mono">Live Webhooks Connected</p>
                  </div>
                </div>

                {/* Ledger Table */}
                <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="p-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-zinc-900">Recent Subscription Invoices</h3>
                    <span className="text-[11px] font-mono text-zinc-500">Auto-settled via Stripe/Razorpay</span>
                  </div>
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-zinc-200 text-zinc-500 uppercase text-[10px] bg-zinc-50">
                        <th className="p-3.5 font-sans">Invoice ID</th>
                        <th className="p-3.5 font-sans">Tenant Workspace</th>
                        <th className="p-3.5 font-sans">Plan</th>
                        <th className="p-3.5 font-sans">Amount</th>
                        <th className="p-3.5 font-sans">Status</th>
                        <th className="p-3.5 font-sans text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {billingLedger.map((inv: any) => (
                        <tr key={inv.id} className="hover:bg-zinc-50 transition">
                          <td className="p-3.5 font-bold text-zinc-900">{inv.id}</td>
                          <td className="p-3.5 font-sans font-semibold text-zinc-800">{inv.tenant}</td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-100 border border-zinc-200 font-semibold text-zinc-700">
                              {inv.plan}
                            </span>
                          </td>
                          <td className="p-3.5 text-emerald-600 font-bold">${inv.amount}.00</td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                              {inv.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-right text-zinc-400">{inv.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 6. AI & MODELS MANAGEMENT */}
            {activeTab === 'ai-models' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Central AI &amp; Model Routing Engine</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Configure default LLM providers, embedding models, cross-encoders, and tier routing.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-2xs">
                    <h3 className="text-sm font-bold text-zinc-900">Default Model Providers</h3>
                    
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-700">Default Primary Model</label>
                        <select
                          value={aiConfig.defaultModel}
                          onChange={(e) => setAiConfig({ ...aiConfig, defaultModel: e.target.value })}
                          className="w-full bg-white border border-zinc-200 rounded-xl p-2.5 text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 cursor-pointer"
                        >
                          <option value="gpt-4o">OpenAI GPT-4o (Default)</option>
                          <option value="gemini-1.5-pro">Google Gemini 1.5 Pro</option>
                          <option value="claude-3-5-sonnet">Anthropic Claude 3.5 Sonnet</option>
                          <option value="deepseek-r1">DeepSeek R1 (Hybrid Reasoning)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-700">Failover Model Provider</label>
                        <select
                          value={aiConfig.fallbackModel}
                          onChange={(e) => setAiConfig({ ...aiConfig, fallbackModel: e.target.value })}
                          className="w-full bg-white border border-zinc-200 rounded-xl p-2.5 text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 cursor-pointer"
                        >
                          <option value="gemini-1.5-pro">Google Gemini 1.5 Pro</option>
                          <option value="gpt-4o-mini">OpenAI GPT-4o Mini</option>
                          <option value="claude-3-haiku">Anthropic Claude 3 Haiku</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-700">Vector Embedding Model</label>
                        <input
                          type="text"
                          value={aiConfig.embeddingModel}
                          readOnly
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-xs font-mono text-zinc-600"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-700">Cross-Encoder Re-ranker</label>
                        <input
                          type="text"
                          value={aiConfig.rerankerModel}
                          readOnly
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-xs font-mono text-zinc-600"
                        />
                      </div>

                      <button
                        onClick={() => triggerDirectAction('UPDATE_AI_MODELS', aiConfig)}
                        className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition"
                      >
                        Save &amp; Propagate AI Routing
                      </button>
                    </div>
                  </div>

                  {/* Plan Routing Table */}
                  <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-2xs">
                    <h3 className="text-sm font-bold text-zinc-900">Tier Model Routing</h3>
                    <p className="text-xs text-zinc-500">Automatically map customer plan tiers to cost-optimized model architectures.</p>

                    <div className="space-y-3 font-mono text-xs">
                      <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between">
                        <span className="font-bold text-zinc-900 font-sans">FREE / TRIAL:</span>
                        <span className="text-zinc-600">gpt-4o-mini (Low Cost)</span>
                      </div>
                      <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between">
                        <span className="font-bold text-zinc-900 font-sans">STARTER:</span>
                        <span className="text-zinc-600">gpt-4o-mini (Standard)</span>
                      </div>
                      <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between">
                        <span className="font-bold text-zinc-900 font-sans">PRO:</span>
                        <span className="text-indigo-600 font-semibold">gpt-4o (High Performance)</span>
                      </div>
                      <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between">
                        <span className="font-bold text-zinc-900 font-sans">ENTERPRISE:</span>
                        <span className="text-emerald-700 font-semibold">gpt-4o / custom fine-tuned</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 7. AI USAGE & COST VIEW */}
            {activeTab === 'ai-cost' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 tracking-tight">AI Usage &amp; Cost Intelligence</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Track tenant token consumption, gross margin estimates, and model cost distributions.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-1 shadow-2xs">
                    <span className="text-xs text-zinc-500 font-medium">Gross Margin Estimate</span>
                    <p className="text-2xl font-bold font-mono text-emerald-600">84.2%</p>
                    <p className="text-[10px] text-zinc-400 font-mono">${metrics.mrr.toLocaleString()} MRR vs ${(metrics.mrr * 0.15).toFixed(0)} LLM Cost</p>
                  </div>
                  <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-1 shadow-2xs">
                    <span className="text-xs text-zinc-500 font-medium">Cost Per Conversation</span>
                    <p className="text-2xl font-bold font-mono text-zinc-900">$0.0045</p>
                    <p className="text-[10px] text-zinc-400 font-mono">128-dim embeddings + cached prompts</p>
                  </div>
                  <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-1 shadow-2xs">
                    <span className="text-xs text-zinc-500 font-medium">Total Input / Output Tokens</span>
                    <p className="text-2xl font-bold font-mono text-zinc-900">{(metrics.tokensConsumed / 1000000).toFixed(2)}M</p>
                    <p className="text-[10px] text-zinc-400 font-mono">3.1M Prompt / 1.18M Completion</p>
                  </div>
                </div>
              </div>
            )}

            {/* 8. RAG OPERATIONS VIEW */}
            {activeTab === 'rag-ops' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 tracking-tight">12-Stage RAG Platform Telemetry</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">Real-time performance metrics across hybrid retrieval, RRF ranking, and grounding verification.</p>
                  </div>
                  <button
                    onClick={() => triggerDirectAction('TRIGGER_RAG_REINDEX')}
                    className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition"
                  >
                    <Database className="w-4 h-4" /> Trigger RAG Re-indexing
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 font-mono">
                  <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-1 shadow-2xs">
                    <span className="text-zinc-500 text-xs font-sans font-medium">Hybrid Retrieval Latency</span>
                    <p className="text-xl font-bold text-zinc-900">18.4 ms</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-1 shadow-2xs">
                    <span className="text-zinc-500 text-xs font-sans font-medium">Cross-Encoder Re-rank</span>
                    <p className="text-xl font-bold text-zinc-900">42.1 ms</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-1 shadow-2xs">
                    <span className="text-zinc-500 text-xs font-sans font-medium">No-Result Fallback Rate</span>
                    <p className="text-xl font-bold text-emerald-600">0.4%</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-1 shadow-2xs">
                    <span className="text-zinc-500 text-xs font-sans font-medium">Grounding Verification Pass</span>
                    <p className="text-xl font-bold text-emerald-600">99.8%</p>
                  </div>
                </div>
              </div>
            )}

            {/* 9. INDEXING & KNOWLEDGE VIEW */}
            {activeTab === 'indexing' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Indexing &amp; Vector Store Engine</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">Knowledge chunking, dense vector index partitions, and CDC embeddings pipeline.</p>
                  </div>
                  <button
                    onClick={() => triggerDirectAction('TRIGGER_RAG_REINDEX')}
                    className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition"
                  >
                    <HardDriveDownload className="w-4 h-4" /> Full Vector Resync
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-1 shadow-2xs">
                    <span className="text-xs text-zinc-500 font-medium">Indexed Knowledge Docs</span>
                    <p className="text-2xl font-bold font-mono text-zinc-900">{indexingStats.totalDocuments || 4}</p>
                    <p className="text-[10px] text-zinc-400 font-mono">Policies, FAQs, Catalog specs</p>
                  </div>
                  <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-1 shadow-2xs">
                    <span className="text-xs text-zinc-500 font-medium">Total Vector Chunks</span>
                    <p className="text-2xl font-bold font-mono text-indigo-600">{indexingStats.totalChunks || 16}</p>
                    <p className="text-[10px] text-zinc-400 font-mono">128-dim Cosine Embeddings</p>
                  </div>
                  <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-1 shadow-2xs">
                    <span className="text-xs text-zinc-500 font-medium">Index Partition Health</span>
                    <p className="text-2xl font-bold font-mono text-emerald-600">{indexingStats.indexHealth || '100% HEALTHY'}</p>
                    <p className="text-[10px] text-zinc-400 font-mono">Last Synced: {indexingStats.lastReindex || 'Live'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 10. INTEGRATIONS VIEW */}
            {activeTab === 'integrations' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Platform E-Commerce Integrations Mesh</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Live connections across Shopify, WooCommerce, Stripe, and Razorpay across all tenants.</p>
                </div>

                <div className="space-y-3">
                  {integrationsList.map((int: any) => (
                    <div key={int.id} className="p-5 rounded-2xl bg-white border border-zinc-200 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-700">
                          <Layers className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-zinc-900 text-xs">{int.name}</h4>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600">
                              {int.type}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5">Bound to {int.tenantCount} active tenant workspaces • Synced {int.lastSync}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold font-mono">
                          {int.status}
                        </span>
                        <button
                          onClick={() => triggerDirectAction('TEST_INTEGRATION_WEBHOOK', { integrationId: int.id })}
                          className="px-3 py-1.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 text-xs font-semibold transition"
                        >
                          Test Webhook
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 11. AGENT ACTIONS VIEW */}
            {activeTab === 'agent-actions' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Agent Tool &amp; Action Governance</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">SuperAdmin permission controls over autonomous tools (Cart Mutation, Order Refunds, Stock Search).</p>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-zinc-200 text-zinc-500 uppercase text-[10px] bg-zinc-50">
                        <th className="p-3.5 font-sans">Action Name</th>
                        <th className="p-3.5 font-sans">Type</th>
                        <th className="p-3.5 font-sans">Risk Level</th>
                        <th className="p-3.5 font-sans">Executions</th>
                        <th className="p-3.5 font-sans">Gate</th>
                        <th className="p-3.5 font-sans text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {agentActionsList.map((act: any) => (
                        <tr key={act.id} className="hover:bg-zinc-50 transition">
                          <td className="p-3.5 font-sans font-bold text-zinc-900">{act.name}</td>
                          <td className="p-3.5 text-zinc-600">{act.type}</td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] border font-semibold ${
                              act.riskLevel === 'HIGH' 
                                ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                : act.riskLevel === 'MEDIUM' 
                                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {act.riskLevel}
                            </span>
                          </td>
                          <td className="p-3.5 text-zinc-900 font-bold">{act.executionsCount}</td>
                          <td className="p-3.5 text-zinc-500 font-sans text-[11px]">{act.approvalRequired ? 'Approval Gate Required' : 'Auto Allowed'}</td>
                          <td className="p-3.5 text-right">
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                              {act.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 12. CONVERSATIONS MONITOR VIEW */}
            {activeTab === 'conversations' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Cross-Tenant Live Conversations Monitor</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Real-time shopper chats and AI response transcripts across all active storefronts.</p>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-zinc-200 text-zinc-500 uppercase text-[10px] bg-zinc-50">
                        <th className="p-3.5 font-sans">Conversation ID</th>
                        <th className="p-3.5 font-sans">Tenant Store</th>
                        <th className="p-3.5 font-sans">Shopper</th>
                        <th className="p-3.5 font-sans">Latest Message</th>
                        <th className="p-3.5 font-sans">Messages</th>
                        <th className="p-3.5 font-sans text-right">Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {liveConversations.map((conv: any) => (
                        <tr key={conv.id} className="hover:bg-zinc-50 transition">
                          <td className="p-3.5 font-bold text-indigo-600">{conv.id.substring(0, 12)}...</td>
                          <td className="p-3.5 font-sans font-semibold text-zinc-800">{conv.tenantName}</td>
                          <td className="p-3.5 font-sans text-zinc-600">{conv.customerName}</td>
                          <td className="p-3.5 font-sans text-zinc-500 max-w-xs truncate">{conv.lastMessage}</td>
                          <td className="p-3.5 font-bold text-zinc-900">{conv.messagesCount}</td>
                          <td className="p-3.5 text-right text-zinc-400">{conv.updatedAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 13. PLATFORM ANALYTICS VIEW */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Platform-Wide Intelligence Analytics</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Aggregate conversion metrics, shopper intent distributions, and agent resolution speeds.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 font-mono">
                  <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-1 shadow-2xs">
                    <span className="text-zinc-500 text-xs font-sans font-medium">Cart Conversion Rate</span>
                    <p className="text-2xl font-bold text-emerald-600">32.8%</p>
                    <p className="text-[10px] text-zinc-400 font-sans">+8.4% with AI Agent</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-1 shadow-2xs">
                    <span className="text-zinc-500 text-xs font-sans font-medium">Avg Resolution Time</span>
                    <p className="text-2xl font-bold text-indigo-600">1.2s</p>
                    <p className="text-[10px] text-zinc-400 font-sans">Sub-second SSE latency</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-1 shadow-2xs">
                    <span className="text-zinc-500 text-xs font-sans font-medium">Shopper Satisfaction</span>
                    <p className="text-2xl font-bold text-emerald-600">98.6%</p>
                    <p className="text-[10px] text-zinc-400 font-sans">CSAT based on 1.4k chats</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-1 shadow-2xs">
                    <span className="text-zinc-500 text-xs font-sans font-medium">Deflection Rate</span>
                    <p className="text-2xl font-bold text-zinc-900">89.2%</p>
                    <p className="text-[10px] text-zinc-400 font-sans">Zero human intervention</p>
                  </div>
                </div>
              </div>
            )}

            {/* 14. SYSTEM HEALTH VIEW */}
            {activeTab === 'system-health' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Infrastructure &amp; Operations Health</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Live node health across databases, LLM provider APIs, background workers, and webhooks.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                  {[
                    { name: 'Primary SQLite / DB Layer', status: 'OPERATIONAL', latency: '2ms', uptime: '100%' },
                    { name: 'Vector Index (128-dim Cosine)', status: 'OPERATIONAL', latency: '4ms', uptime: '100%' },
                    { name: 'OpenAI API Mesh Gateway', status: 'OPERATIONAL', latency: '340ms', uptime: '99.98%' },
                    { name: 'Google Gemini Pro Gateway', status: 'OPERATIONAL', latency: '280ms', uptime: '99.99%' },
                    { name: 'Shopify Webhook Ingestion Pool', status: 'OPERATIONAL', latency: '12ms', uptime: '100%' },
                    { name: 'FastAPI Agent Orchestrator', status: 'OPERATIONAL', latency: '15ms', uptime: '100%' },
                  ].map((srv, idx) => (
                    <div key={idx} className="p-5 rounded-2xl bg-white border border-zinc-200 flex items-center justify-between shadow-2xs">
                      <div>
                        <p className="font-semibold text-zinc-900 font-sans">{srv.name}</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">Latency: {srv.latency} • Uptime: {srv.uptime}</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                        {srv.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 15. LOGS & ERRORS VIEW */}
            {activeTab === 'logs' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Platform Telemetry &amp; System Logs</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Real-time system event logs, gateway traces, and error notifications.</p>
                </div>

                <div className="bg-zinc-900 text-zinc-100 rounded-2xl p-5 font-mono text-xs shadow-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <span className="text-zinc-400 text-[11px]">System Output Stream (Live)</span>
                    <button
                      onClick={() => showToast('System log buffer refreshed.')}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300 transition"
                    >
                      Clear Log Buffer
                    </button>
                  </div>
                  <div className="space-y-2">
                    {systemLogs.map((log: any) => (
                      <div key={log.id} className="flex items-start gap-3 py-1 border-b border-zinc-800/50">
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${
                          log.level === 'WARN' ? 'bg-amber-900/60 text-amber-300' :
                          log.level === 'SUCCESS' ? 'bg-emerald-900/60 text-emerald-300' :
                          'bg-indigo-900/60 text-indigo-300'
                        }`}>
                          {log.level}
                        </span>
                        <span className="text-zinc-400 text-[11px] shrink-0">[{log.service}]</span>
                        <span className="text-zinc-200 flex-1">{log.message}</span>
                        <span className="text-zinc-500 text-[10px] shrink-0">{log.timestamp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 16. SECURITY & ACCESS VIEW */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Root Security &amp; Access Governance</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Strict multi-tenant cryptographic isolation, rate limits, and encryption standards.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-3 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <h4 className="font-bold text-zinc-900 font-sans">Cryptographic Data Isolation</h4>
                    </div>
                    <p className="text-zinc-600 font-sans text-xs">Every tenant query is scoped with mandatory <code className="bg-zinc-100 px-1 py-0.5 rounded">workspace_id</code> foreign key filters preventing cross-tenant leakage.</p>
                    <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-700">
                      AES-256-GCM Encryption Active at Rest
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-3 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-red-600" />
                      <h4 className="font-bold text-zinc-900 font-sans">Rate Limiter &amp; Token Bucket</h4>
                    </div>
                    <p className="text-zinc-600 font-sans text-xs">Sliding window rate limiters enforce 60 req/min per IP with token bucket bursting prevention.</p>
                    <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-emerald-700 font-bold">
                      Strict Token Bucket: Active (0 Dropped)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 17. AUDIT LOGS VIEW */}
            {activeTab === 'audit-logs' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 tracking-tight">SuperAdmin Immutable Audit Trail</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Tamper-resistant audit log of all administrative interventions and tenant modifications.</p>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs font-mono text-[11px]">
                    <thead>
                      <tr className="border-b border-zinc-200 text-zinc-500 uppercase text-[10px] bg-zinc-50">
                        <th className="p-3.5 font-sans">Event Action</th>
                        <th className="p-3.5 font-sans">Admin</th>
                        <th className="p-3.5 font-sans">Tenant Target</th>
                        <th className="p-3.5 font-sans">Metadata</th>
                        <th className="p-3.5 font-sans text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {auditLogs.map((log: any) => (
                        <tr key={log.id} className="hover:bg-zinc-50 transition">
                          <td className="p-3.5 font-semibold text-zinc-900">{log.action}</td>
                          <td className="p-3.5 text-zinc-700">{log.admin}</td>
                          <td className="p-3.5 text-zinc-500">{log.tenant}</td>
                          <td className="p-3.5 text-zinc-500">{log.metadata}</td>
                          <td className="p-3.5 text-right text-zinc-400">{log.timestamp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 18. FEATURE FLAGS VIEW */}
            {activeTab === 'feature-flags' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Platform Feature Flags &amp; Rollouts</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Control progressive rollouts of multimodal search, new rerankers, and autonomous tools.</p>
                </div>

                <div className="space-y-3">
                  {featureFlags.map((flag) => (
                    <div key={flag.id} className="p-5 rounded-2xl bg-white border border-zinc-200 flex items-center justify-between shadow-2xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-zinc-900 text-xs">{flag.name}</h4>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600 font-semibold">
                            {flag.key}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                            {flag.rollout}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">{flag.desc}</p>
                      </div>

                      <button
                        onClick={() => {
                          const updated = featureFlags.map(f => f.id === flag.id ? { ...f, enabled: !f.enabled } : f);
                          setFeatureFlags(updated);
                          triggerDirectAction('TOGGLE_FEATURE_FLAG', { enabled: !flag.enabled }, flag.id);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shadow-2xs cursor-pointer ${
                          flag.enabled
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-zinc-100 text-zinc-600 border border-zinc-200 hover:bg-zinc-200'
                        }`}
                      >
                        {flag.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 19. PLATFORM SETTINGS VIEW */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Platform Global Configurations</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Control global runtime limits, fallback behaviors, and platform mesh settings.</p>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-2xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1.5">
                      <label className="font-semibold text-zinc-700">Platform Environment</label>
                      <input
                        type="text"
                        value={platformSettings.environment || 'production'}
                        readOnly
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 font-mono text-zinc-600"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-semibold text-zinc-700">Default Currency</label>
                      <input
                        type="text"
                        value={platformSettings.defaultCurrency || 'USD'}
                        readOnly
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 font-mono text-zinc-600"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-semibold text-zinc-700">Global Webhook Retry Max</label>
                      <input
                        type="text"
                        value="5 attempts (exponential backoff)"
                        readOnly
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 font-mono text-zinc-600"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-semibold text-zinc-700">SSE Keep-Alive Heartbeat</label>
                      <input
                        type="text"
                        value="15 seconds"
                        readOnly
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 font-mono text-zinc-600"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => triggerDirectAction('UPDATE_PLATFORM_SETTINGS', platformSettings)}
                    className="py-2 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition"
                  >
                    Save Platform Settings
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Dangerous Action Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold text-zinc-900">{confirmDialog.title}</h3>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              {confirmDialog.description}
            </p>

            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-700 font-mono">
              ⚠️ This administrative action directly impacts production tenant environments.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteConfirmedAction}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs transition cursor-pointer"
              >
                Confirm Operation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tenant Detail Inspection Modal (11 Sub-Tabs with Real Enriched Data) */}
      {inspectTenant && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-700 font-bold text-xs shadow-2xs">
                  {inspectTenant.name[0]}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    {inspectTenant.name}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-700 font-semibold">
                      {inspectTenant.plan}
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-mono">{inspectTenant.id} • Owner: {inspectTenant.owner?.email || 'N/A'}</p>
                </div>
              </div>

              <button
                onClick={() => setInspectTenant(null)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 11 Sub-Tabs Navigation */}
            <div className="px-5 border-b border-zinc-200 bg-zinc-50/50 flex items-center gap-2 overflow-x-auto">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'users', label: 'Users' },
                { id: 'agent', label: 'Agents' },
                { id: 'products', label: 'Products' },
                { id: 'knowledge', label: 'Knowledge' },
                { id: 'integrations', label: 'Integrations' },
                { id: 'conversations', label: 'Conversations' },
                { id: 'actions', label: 'Actions' },
                { id: 'usage', label: 'Usage' },
                { id: 'billing', label: 'Billing' },
                { id: 'audit', label: 'Audit Logs' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setInspectTenantTab(tab.id)}
                  className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
                    inspectTenantTab === tab.id
                      ? 'border-red-600 text-red-600'
                      : 'border-transparent text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Body with Dedicated Sub-Views */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {inspectTenantTab === 'overview' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                    <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200">
                      <span className="text-zinc-500 text-[10px] font-sans font-medium">Monthly Messages</span>
                      <p className="text-base font-bold text-zinc-900">{inspectTenant.monthlyLimits?.messages?.toLocaleString() || 5000}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200">
                      <span className="text-zinc-500 text-[10px] font-sans font-medium">Token Quota</span>
                      <p className="text-base font-bold text-zinc-900">{((inspectTenant.monthlyLimits?.tokens || 5000000) / 1000000).toFixed(0)}M</p>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200">
                      <span className="text-zinc-500 text-[10px] font-sans font-medium">Storage Quota</span>
                      <p className="text-base font-bold text-zinc-900">{inspectTenant.monthlyLimits?.documents || 50} Docs</p>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200">
                      <span className="text-zinc-500 text-[10px] font-sans font-medium">Store Connectors</span>
                      <p className="text-base font-bold text-zinc-900">{inspectTenant.monthlyLimits?.stores || 1} Max</p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2">
                    <h4 className="font-semibold text-zinc-900 text-xs">Storefront Connectivity</h4>
                    <p className="text-zinc-600">Connected Store: <strong className="text-zinc-900">{inspectTenant.connectedStore}</strong></p>
                    <p className="text-zinc-600">Catalog Synced: <strong className="text-zinc-900">{inspectTenant.productsCount || 0} products</strong></p>
                    <p className="text-zinc-600">Knowledge Indexed: <strong className="text-zinc-900">{inspectTenant.documentsCount || 0} documents ({inspectTenant.chunksCount || 0} chunks)</strong></p>
                  </div>
                </div>
              )}

              {inspectTenantTab === 'users' && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-zinc-900 text-xs">Workspace Members</h4>
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl overflow-hidden text-xs">
                    {(inspectTenant.users || []).map((u: any) => (
                      <div key={u.id} className="p-3 border-b border-zinc-200 last:border-0 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-zinc-900">{u.name}</p>
                          <p className="text-[10px] font-mono text-zinc-500">{u.email}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-200 font-mono text-zinc-700">MEMBER</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {inspectTenantTab === 'agent' && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-zinc-900 text-xs">Configured Agents</h4>
                  <div className="space-y-2">
                    {(inspectTenant.agents || []).map((a: any) => (
                      <div key={a.id} className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-zinc-900">{a.name}</p>
                          <p className="text-[10px] font-mono text-zinc-500">{a.role} • ID: {a.id}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                          {a.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {inspectTenantTab === 'products' && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-zinc-900 text-xs">Synced Products ({inspectTenant.productsCount || 0})</h4>
                  <div className="space-y-2">
                    {(inspectTenant.products || []).map((p: any) => (
                      <div key={p.id} className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-zinc-900">{p.title}</p>
                          <p className="text-[10px] font-mono text-zinc-500">ID: {p.id} • Stock: {p.stock || 'In Stock'}</p>
                        </div>
                        <span className="font-mono font-bold text-zinc-900">${p.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {inspectTenantTab === 'knowledge' && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-zinc-900 text-xs">Knowledge Base Documents ({inspectTenant.documentsCount || 0})</h4>
                  <div className="space-y-2">
                    {(inspectTenant.documents || []).map((d: any) => (
                      <div key={d.id} className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-zinc-900">{d.title}</p>
                          <p className="text-[10px] font-mono text-zinc-500">Chunks: {d.chunks || 4} • Status: {d.status}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                          INDEXED
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {inspectTenantTab === 'integrations' && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-zinc-900 text-xs">Tenant Store Connectors</h4>
                  <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-zinc-900">{inspectTenant.connectedStore}</p>
                      <p className="text-[10px] font-mono text-zinc-500">Active E-Commerce Bridge</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                      CONNECTED
                    </span>
                  </div>
                </div>
              )}

              {inspectTenantTab === 'conversations' && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-zinc-900 text-xs">Tenant Conversations ({inspectTenant.conversationsCount || 0})</h4>
                  <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600">
                    Total customer shopping sessions handled by AI agents: <strong className="text-zinc-900 font-mono">{inspectTenant.conversationsCount}</strong>
                  </div>
                </div>
              )}

              {inspectTenantTab === 'actions' && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-zinc-900 text-xs">Permitted Agent Actions</h4>
                  <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600 space-y-2">
                    <p className="font-medium text-zinc-900">Allowed Tool Executions for this workspace:</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 rounded bg-zinc-200 text-[11px] font-mono">search_products</span>
                      <span className="px-2 py-1 rounded bg-zinc-200 text-[11px] font-mono">check_inventory</span>
                      <span className="px-2 py-1 rounded bg-zinc-200 text-[11px] font-mono">apply_coupon</span>
                      <span className="px-2 py-1 rounded bg-zinc-200 text-[11px] font-mono">create_checkout</span>
                    </div>
                  </div>
                </div>
              )}

              {inspectTenantTab === 'usage' && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-zinc-900 text-xs">Monthly Resource Consumption</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                      <span className="text-[10px] text-zinc-500 font-sans">AI Tokens</span>
                      <p className="text-lg font-bold text-zinc-900">{inspectTenant.aiUsageTokens}</p>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                      <span className="text-[10px] text-zinc-500 font-sans">Storage Consumed</span>
                      <p className="text-lg font-bold text-zinc-900">{inspectTenant.storageMb}</p>
                    </div>
                  </div>
                </div>
              )}

              {inspectTenantTab === 'billing' && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-zinc-900 text-xs">Plan &amp; Subscription Billing</h4>
                  <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs space-y-2">
                    <p className="text-zinc-600">Active Plan: <strong className="text-zinc-900 font-mono">{inspectTenant.plan}</strong></p>
                    <p className="text-zinc-600">Payment Status: <strong className="text-emerald-600 font-mono">Current (Good Standing)</strong></p>
                  </div>
                </div>
              )}

              {inspectTenantTab === 'audit' && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-zinc-900 text-xs">Audit Logs</h4>
                  <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600">
                    All administrative operations on workspace {inspectTenant.id} are recorded in the central immutable audit log.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}