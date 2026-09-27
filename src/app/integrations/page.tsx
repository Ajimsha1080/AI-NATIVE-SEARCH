'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import { 
  Puzzle, ShoppingCart, RefreshCw, CheckCircle2, 
  ExternalLink, ArrowRight, ShieldCheck, Settings, X, Send, Key, Globe, Lock,
  Truck, CreditCard, Terminal, Radio, Play, Check, AlertCircle, Copy, Clock, Activity, Zap,
  Unlink, FileText, RotateCcw, AlertTriangle
} from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';

interface IntegrationField {
  key: string;
  label: string;
  placeholder: string;
  isSecret?: boolean;
}

interface ConnectorItem {
  id: string;
  name: string;
  category: string;
  type: string;
  description: string;
  authType: string;
  fields: IntegrationField[];
  status: 'NOT_CONNECTED' | 'CONNECTED' | 'ERROR' | 'SYNCING';
  connected_at: string | null;
  connected_by_email: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_error: string | null;
  config: Record<string, any>;
  masked_credentials: Record<string, string>;
  auditTrail: string | null;
}

interface Metrics {
  activeConnectors: number;
  productsCount: number;
  ordersCount: number;
  knowledgeCount: number;
  webhookHealth: string;
}

const ICON_MAP: Record<string, any> = {
  shopify: ShoppingCart,
  woocommerce: ShoppingCart,
  razorpay: CreditCard,
  stripe: CreditCard,
  logistics: Truck,
  web_crawler: Globe,
  custom_webhooks: Zap
};

export default function IntegrationsWorkspacePage() {
  const [connectors, setConnectors] = useState<ConnectorItem[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    activeConnectors: 0,
    productsCount: 0,
    ordersCount: 0,
    knowledgeCount: 0,
    webhookHealth: 'STANDBY'
  });
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal States
  const [activeModal, setActiveModal] = useState<ConnectorItem | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Disconnect Confirmation Modal
  const [disconnectModal, setDisconnectModal] = useState<ConnectorItem | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Logs / Delivery Drawer
  const [logsModal, setLogsModal] = useState<ConnectorItem | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsData, setLogsData] = useState<{ syncJobs: any[]; auditLogs: any[]; webhookDeliveries: any[] }>({
    syncJobs: [],
    auditLogs: [],
    webhookDeliveries: []
  });
  const [replayingEventId, setReplayingEventId] = useState<string | null>(null);

  // Live Terminal Stream
  const [liveStream, setLiveStream] = useState<any[]>([]);

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations');
      if (res.ok) {
        const data = await res.json();
        if (data.connectors) setConnectors(data.connectors);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Failed to load integrations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
    const interval = setInterval(fetchIntegrations, 10000);
    return () => clearInterval(interval);
  }, [fetchIntegrations]);

  function openConnectModal(connector: ConnectorItem) {
    setActiveModal(connector);
    setModalError(null);
    // Initialize form data with masked or existing config
    const initial: Record<string, string> = {};
    connector.fields.forEach(f => {
      if (connector.masked_credentials && connector.masked_credentials[f.key]) {
        initial[f.key] = connector.masked_credentials[f.key];
      } else if (connector.config && connector.config[f.key]) {
        initial[f.key] = connector.config[f.key];
      } else {
        initial[f.key] = '';
      }
    });
    setFormData(initial);
  }

  async function handleSaveAndConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!activeModal) return;

    setConnecting(true);
    setModalError(null);

    try {
      const res = await fetch(`/api/integrations/${activeModal.id}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentials: formData,
          config: formData
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error?.message || 'Failed to authenticate and connect connector.');
        return;
      }

      setSuccessMsg(data.message || `Successfully connected ${activeModal.name}!`);
      setActiveModal(null);
      await fetchIntegrations();

      // Add to live stream
      setLiveStream(prev => [
        {
          id: `stream_${Date.now()}`,
          connector: activeModal.name,
          action: 'CONNECTED',
          message: `Authenticated and encrypted credentials at rest (AES-256-GCM).`,
          time: new Date().toLocaleTimeString('en-US'),
          status: 'SUCCESS'
        },
        ...prev
      ]);

      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setModalError(err.message || 'Network handshake failed.');
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect(connector: ConnectorItem) {
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/integrations/${connector.id}/disconnect`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error?.message || 'Failed to disconnect integration.');
        return;
      }

      setSuccessMsg(data.message || `Disconnected ${connector.name}.`);
      setDisconnectModal(null);
      await fetchIntegrations();

      // Add to live stream
      setLiveStream(prev => [
        {
          id: `stream_${Date.now()}`,
          connector: connector.name,
          action: 'DISCONNECTED',
          message: 'Revoked local session tokens & cleared credentials.',
          time: new Date().toLocaleTimeString('en-US'),
          status: 'DISCONNECTED'
        },
        ...prev
      ]);

      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error executing disconnect.');
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSync(connector: ConnectorItem) {
    setSyncingId(connector.id);
    try {
      const res = await fetch(`/api/integrations/${connector.id}/sync`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error?.message || `Sync failed for ${connector.name}.`);
        setTimeout(() => setErrorMsg(null), 5000);
        return;
      }

      setSuccessMsg(data.message || `Synchronized ${connector.name} successfully.`);
      await fetchIntegrations();

      // Add to live stream
      setLiveStream(prev => [
        {
          id: `stream_${Date.now()}`,
          connector: connector.name,
          action: 'SYNC',
          message: data.message || 'Sync completed successfully.',
          time: new Date().toLocaleTimeString('en-US'),
          status: 'SUCCESS'
        },
        ...prev
      ]);

      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Sync network request failed.');
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setSyncingId(null);
    }
  }

  async function handleSyncAll() {
    setSyncingId('ALL');
    try {
      const res = await fetch('/api/integrations/sync-all', {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error?.message || 'Sync All failed.');
        setTimeout(() => setErrorMsg(null), 5000);
        return;
      }

      setSuccessMsg(data.message || 'All active store connectors synchronized successfully!');
      await fetchIntegrations();

      setLiveStream(prev => [
        {
          id: `stream_${Date.now()}`,
          connector: 'All Connectors',
          action: 'SYNC_ALL',
          message: data.message,
          time: new Date().toLocaleTimeString('en-US'),
          status: 'SUCCESS'
        },
        ...prev
      ]);

      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Sync All request failed.');
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setSyncingId(null);
    }
  }

  async function openLogsDrawer(connector: ConnectorItem) {
    setLogsModal(connector);
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/integrations/${connector.id}/logs`);
      if (res.ok) {
        const data = await res.json();
        setLogsData({
          syncJobs: data.syncJobs || [],
          auditLogs: data.auditLogs || [],
          webhookDeliveries: data.webhookDeliveries || []
        });
      }
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }

  async function handleReplayEvent(eventId: string, eventType?: string) {
    if (!logsModal) return;
    setReplayingEventId(eventId);
    try {
      const res = await fetch(`/api/integrations/${logsModal.id}/logs/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, eventType })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || `Replayed event ${eventId} successfully!`);
        await openLogsDrawer(logsModal);
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setErrorMsg(data.error?.message || 'Failed to replay event.');
        setTimeout(() => setErrorMsg(null), 5000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error replaying event.');
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setReplayingEventId(null);
    }
  }

  return (
    <div className="flex h-screen bg-[#f4f5f7] text-zinc-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f4f5f7]">
        <Navbar />

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2.5">
                  <Puzzle className="w-5 h-5 text-indigo-600" />
                  Store Integrations &amp; Real-World Connectors
                </h1>
                <p className="text-xs text-zinc-500 mt-1">
                  Connect Shopify, WooCommerce, Indian payment gateways, shipping logistics, and AI web crawlers.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSyncAll}
                  disabled={!!syncingId || metrics.activeConnectors === 0}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition flex items-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingId === 'ALL' ? 'animate-spin' : ''}`} />
                  <span>{syncingId === 'ALL' ? 'Synchronizing All...' : 'Sync All Connectors'}</span>
                </button>
              </div>
            </div>

            {/* Live Metrics Ribbon */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                  <span>ACTIVE CONNECTORS</span>
                  <Activity className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-xl font-bold text-zinc-900 font-mono">
                  {metrics.activeConnectors} {metrics.activeConnectors === 1 ? 'Live' : 'Live'}
                </div>
                <div className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${metrics.activeConnectors > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-300'}`}></span>
                  {metrics.activeConnectors > 0 ? 'Operational Handshake' : 'Awaiting Connection'}
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                  <span>SYNCED CATALOG ITEMS</span>
                  <ShoppingCart className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div className="text-xl font-bold text-zinc-900 font-mono">{metrics.productsCount} Products</div>
                <div className="text-[10px] text-zinc-500 font-medium">{metrics.ordersCount} Live Orders Active</div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                  <span>WEB CRAWLER CHUNKS</span>
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="text-xl font-bold text-zinc-900 font-mono">{metrics.knowledgeCount} Vectors</div>
                <div className="text-[10px] text-zinc-500 font-medium">Dense Semantic Store Knowledge</div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                  <span>WEBHOOK DISPATCH</span>
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="text-xl font-bold text-zinc-900 font-mono">HMAC-SHA256</div>
                <div className="text-[10px] text-emerald-600 font-medium">{metrics.webhookHealth}</div>
              </div>
            </div>

            {/* Notification Banners */}
            {successMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center gap-3 font-mono shadow-xs animate-in fade-in duration-150">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="font-semibold">{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 flex items-center gap-3 font-mono shadow-xs animate-in fade-in duration-150">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span className="font-semibold">{errorMsg}</span>
              </div>
            )}

            {/* Connectors Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {connectors.map((connector) => {
                const Icon = ICON_MAP[connector.id] || Puzzle;
                const isConnected = connector.status === 'CONNECTED';
                const isSyncing = syncingId === connector.id || syncingId === 'ALL';

                return (
                  <div
                    key={connector.id}
                    className={`bg-white border rounded-3xl p-5 hover:border-zinc-300 transition-all flex flex-col justify-between gap-4 shadow-xs group ${
                      isConnected ? 'border-zinc-200' : 'border-dashed border-zinc-300 bg-zinc-50/50'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition-all ${
                            isConnected 
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                              : 'bg-zinc-100 border-zinc-200 text-zinc-400 group-hover:text-zinc-600'
                          }`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors">
                              {connector.name}
                            </h3>
                            <p className="text-[10px] text-zinc-400 font-mono">{connector.type}</p>
                          </div>
                        </div>

                        {isConnected ? (
                          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold shadow-2xs flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Connected
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-500 font-semibold">
                            Not Connected
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-600 leading-relaxed">
                        {connector.description}
                      </p>

                      {/* Config or Credentials Details */}
                      {isConnected ? (
                        <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-2.5 space-y-1.5 font-mono text-[10px]">
                          {Object.entries(connector.masked_credentials).length > 0 ? (
                            Object.entries(connector.masked_credentials).slice(0, 2).map(([k, v]) => (
                              <div key={k} className="flex items-center justify-between gap-2">
                                <span className="text-zinc-400 uppercase font-semibold">{k.replace(/([A-Z])/g, ' $1').trim()}:</span>
                                <span className="text-zinc-800 font-medium truncate max-w-[220px]">{v}</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-zinc-400 italic">Authenticated via Secure Environment</div>
                          )}
                          {connector.auditTrail && (
                            <div className="pt-1 border-t border-zinc-200/60 text-[9px] text-zinc-400 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="truncate">{connector.auditTrail}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-zinc-100/70 border border-zinc-200/80 rounded-xl p-2.5 font-mono text-[10px] text-zinc-500 flex items-center justify-between">
                          <span>Authentication required to sync data</span>
                          <span className="text-zinc-400">AES-256-GCM</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-zinc-100 flex items-center justify-between font-mono text-[11px]">
                      <span className="text-zinc-500 flex items-center gap-1.5 text-[10px]">
                        <Clock className="w-3 h-3 text-zinc-400" />
                        Last sync: <span className="font-semibold text-zinc-700">
                          {isConnected 
                            ? (connector.last_sync_at ? new Date(connector.last_sync_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now')
                            : 'Never'}
                        </span>
                      </span>

                      <div className="flex items-center gap-2">
                        {isConnected ? (
                          <>
                            <button
                              onClick={() => openLogsDrawer(connector)}
                              title="View Delivery Logs"
                              className="p-1.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-600 hover:text-zinc-900 transition shadow-2xs cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openConnectModal(connector)}
                              className="px-3 py-1.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-xs font-semibold text-zinc-700 hover:text-zinc-900 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <Settings className="w-3.5 h-3.5" /> Rotate
                            </button>
                            <button
                              onClick={() => handleSync(connector)}
                              disabled={isSyncing}
                              className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                              {isSyncing ? 'Syncing...' : 'Sync'}
                            </button>
                            <button
                              onClick={() => setDisconnectModal(connector)}
                              title="Disconnect Integration"
                              className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 hover:text-rose-800 transition shadow-2xs cursor-pointer"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => openConnectModal(connector)}
                            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Key className="w-3.5 h-3.5" /> Connect
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Real-Time Activity & Sync Terminal */}
            <div className="bg-zinc-900 text-white rounded-3xl p-5 shadow-xl border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold font-mono text-zinc-200">Real-Time Connector Event Stream</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  LIVE LISTENER
                </div>
              </div>

              <div className="space-y-2 font-mono text-xs max-h-56 overflow-y-auto">
                {liveStream.length === 0 ? (
                  <div className="py-6 text-center text-zinc-400 font-mono text-xs space-y-1">
                    <p>No sync events recorded in this session yet.</p>
                    <p className="text-[11px] text-zinc-500">Connect a store or click &quot;Sync&quot; on any active connector to dispatch live transactions.</p>
                  </div>
                ) : (
                  liveStream.map((log) => (
                    <div key={log.id} className="flex items-start justify-between gap-4 p-2.5 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-indigo-400 font-bold">{log.connector}</span>
                          <span className="text-zinc-500">•</span>
                          <span className="text-zinc-400 text-[10px]">{log.action}</span>
                        </div>
                        <p className="text-zinc-300 text-xs">{log.message}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-zinc-400 block">{log.time}</span>
                        <span className="text-[10px] text-emerald-400 font-semibold">{log.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Real-World Connector Configuration & Connection Modal */}
        {activeModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white border border-zinc-200 text-zinc-900 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
              
              {/* Modal Header */}
              <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/70">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center">
                    {React.createElement(ICON_MAP[activeModal.id] || Puzzle, { className: 'w-5 h-5' })}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">{activeModal.name}</h3>
                    <p className="text-[11px] text-zinc-500 font-mono">{activeModal.type}</p>
                  </div>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSaveAndConnect} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                  
                  <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-[11px] text-zinc-600 space-y-1">
                    <p className="font-semibold text-zinc-800 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Zero-Knowledge Secret Encryption
                    </p>
                    <p>
                      Credentials are authenticated directly with the provider and encrypted at rest with AES-256-GCM. Raw keys are never exposed in responses.
                    </p>
                  </div>

                  <div className="space-y-3.5">
                    {activeModal.fields.map((field) => (
                      <div key={field.key} className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-700 block">
                          {field.label}
                        </label>
                        <div className="relative">
                          <input
                            type={field.isSecret ? 'password' : 'text'}
                            value={formData[field.key] || ''}
                            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                            placeholder={field.placeholder}
                            required={!activeModal.masked_credentials[field.key]}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 font-mono placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                          />
                          {field.isSecret && (
                            <Lock className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-2.5 pointer-events-none" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Inline Error Message */}
                  {modalError && (
                    <div className="p-3.5 rounded-2xl text-xs font-mono flex items-start gap-2.5 bg-rose-50 border border-rose-200 text-rose-900 animate-in fade-in">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-semibold">Authentication Failed</p>
                        <p className="text-[11px] text-rose-700">{modalError}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={connecting}
                    className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <ShieldCheck className={`w-3.5 h-3.5 ${connecting ? 'animate-spin' : ''}`} />
                    {connecting ? 'Validating Handshake...' : 'Authenticate & Connect'}
                  </button>
                </div>
              </form>

            </div>
          </div>
        )}

        {/* Disconnect Confirmation Modal */}
        {disconnectModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white border border-zinc-200 text-zinc-900 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-900">Disconnect {disconnectModal.name}?</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Disconnecting will revoke the stored access keys, halt real-time background catalog syncs, and unregister webhook listeners.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setDisconnectModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDisconnect(disconnectModal)}
                  disabled={disconnecting}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Unlink className={`w-3.5 h-3.5 ${disconnecting ? 'animate-spin' : ''}`} />
                  {disconnecting ? 'Revoking...' : 'Confirm Disconnect'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Logs & Deliveries Drawer / Modal */}
        {logsModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white border border-zinc-200 text-zinc-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
              
              <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/70">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">{logsModal.name} &mdash; Delivery &amp; Sync History</h3>
                    <p className="text-[11px] text-zinc-500 font-mono">Real-time webhook payloads and audit traces</p>
                  </div>
                </div>
                <button onClick={() => setLogsModal(null)} className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-5 flex-1 font-mono text-xs">
                {logsLoading ? (
                  <div className="py-12 text-center text-zinc-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Loading delivery history...</span>
                  </div>
                ) : (
                  <>
                    {/* Webhook Deliveries */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
                        Recent Webhook Deliveries
                      </div>
                      {logsData.webhookDeliveries.length === 0 ? (
                        <p className="text-zinc-400 italic text-[11px]">No deliveries recorded yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {logsData.webhookDeliveries.map((d: any) => (
                            <div key={d.id} className="p-3 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                    {d.status_code || 200} OK
                                  </span>
                                  <span className="font-bold text-zinc-900">{d.event_type}</span>
                                </div>
                                <span className="text-[10px] text-zinc-400">{d.latency_ms}ms</span>
                              </div>
                              <div className="text-[10px] text-zinc-600 bg-white p-2 rounded-xl border border-zinc-150 overflow-x-auto">
                                <code>{d.payload_preview}</code>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1">
                                <span>{new Date(d.created_at).toLocaleString()}</span>
                                <button
                                  type="button"
                                  onClick={() => handleReplayEvent(d.id, d.event_type)}
                                  disabled={replayingEventId === d.id}
                                  className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-semibold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <RotateCcw className={`w-3 h-3 ${replayingEventId === d.id ? 'animate-spin' : ''}`} />
                                  {replayingEventId === d.id ? 'Replaying...' : 'Replay Event'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Sync Job Logs */}
                    <div className="space-y-2 pt-2 border-t border-zinc-100">
                      <div className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
                        Sync Execution Logs
                      </div>
                      {logsData.syncJobs.length === 0 ? (
                        <p className="text-zinc-400 italic text-[11px]">No sync jobs executed yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {logsData.syncJobs.map((job: any) => (
                            <div key={job.id} className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between">
                              <div>
                                <span className="font-semibold text-zinc-800">{job.message || 'Sync complete'}</span>
                                <span className="block text-[10px] text-zinc-400">{new Date(job.created_at).toLocaleString()}</span>
                              </div>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                {job.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex justify-end">
                <button
                  type="button"
                  onClick={() => setLogsModal(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition cursor-pointer"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}