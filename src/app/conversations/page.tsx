'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import { 
  MessageSquare, Search, Bot, User, Clock, CheckCircle, 
  Send, ShieldAlert, ShoppingBag, Truck, ZoomIn, ZoomOut, X,
  Headphones, RefreshCw, Globe, Smartphone, Sparkles, Tag, ArrowUpRight
} from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { fetchWithCache, getClientCachedData } from '@/lib/client-cache';

interface ProductCardData {
  id: string;
  title: string;
  price: number;
  compare_at_price?: number;
  currency?: string;
  images?: string[];
  imageUrl?: string;
  in_stock?: boolean;
  category?: string;
  description?: string;
}

export default function ConversationsWorkspacePage() {
  const cachedConvos = getClientCachedData<{ conversations: any[] }>('/api/conversations')?.conversations || [];
  const [conversations, setConversations] = useState<any[]>(() => cachedConvos);
  const [selectedConvo, setSelectedConvo] = useState<any | null>(() => cachedConvos[0] || null);
  const [messages, setMessages] = useState<any[]>(() => cachedConvos[0]?.messages || []);
  const [loading, setLoading] = useState(cachedConvos.length === 0);
  const [liveSync, setLiveSync] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [previewModal, setPreviewModal] = useState<{ url: string; title: string; price?: number; description?: string } | null>(null);
  const [zoomScale, setZoomScale] = useState(1);

  useEffect(() => {
    fetchConversations(conversations.length === 0);

    const interval = setInterval(() => {
      if (liveSync) {
        syncLiveConversations();
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [liveSync, selectedConvo?.id]);

  async function fetchConversations(isInitial = false) {
    if (isInitial && conversations.length === 0) setLoading(true);
    try {
      const data = await fetchWithCache<{ conversations: any[] }>('/api/conversations');
      const convos = (data?.conversations || []).sort((a: any, b: any) => {
        const timeA = new Date(a.updated_at || a.updatedAt || a.created_at || 0).getTime();
        const timeB = new Date(b.updated_at || b.updatedAt || b.created_at || 0).getTime();
        return timeB - timeA;
      });
      setConversations(convos);
      if (isInitial && convos.length > 0 && !selectedConvo) {
        selectConversation(convos[0]);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }

  async function syncLiveConversations() {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        const convos = (data.conversations || []).sort((a: any, b: any) => {
          const timeA = new Date(a.updated_at || a.updatedAt || a.created_at || 0).getTime();
          const timeB = new Date(b.updated_at || b.updatedAt || b.created_at || 0).getTime();
          return timeB - timeA;
        });
        setConversations(convos);
        if (selectedConvo?.id) {
          const msgRes = await fetch(`/api/conversations/${selectedConvo.id}`);
          if (msgRes.ok) {
            const msgData = await msgRes.json();
            if (Array.isArray(msgData.messages)) {
              setMessages(msgData.messages);
            }
          }
        }
      }
    } catch {}
  }

  async function selectConversation(convo: any) {
    setSelectedConvo(convo);
    try {
      const res = await fetch(`/api/conversations/${convo.id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Failed to load messages for conversation:', err);
    }
  }

  async function handleTakeover(status: 'HUMAN_TAKEOVER' | 'ACTIVE' | 'RESOLVED') {
    if (!selectedConvo) return;
    try {
      const res = await fetch(`/api/conversations/${selectedConvo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        const updated = { ...selectedConvo, status };
        setSelectedConvo(updated);
        setConversations(conversations.map(c => c.id === updated.id ? updated : c));
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim() || !selectedConvo || sendingReply) return;
    setSendingReply(true);
    try {
      const res = await fetch(`/api/conversations/${selectedConvo.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'HUMAN',
          content: replyText,
          metadata: { humanHandoff: true, operator: 'Staff Agent' }
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setMessages(prev => [...prev, data.message]);
        }
        setReplyText('');
      }
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setSendingReply(false);
    }
  }

  const renderFormattedText = (text: string) => {
    if (!text) return '';
    const boldRegex = /\*\*(.*?)\*\*/g;
    const elements: React.ReactNode[] = [];
    let lastIdx = 0;
    let match;

    while ((match = boldRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        elements.push(text.substring(lastIdx, match.index));
      }
      elements.push(
        <strong key={`bold-${match.index}`} className="font-bold text-inherit">
          {match[1]}
        </strong>
      );
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) {
      elements.push(text.substring(lastIdx));
    }

    return elements.length > 0 ? elements : text;
  };

  const filteredConversations = conversations.filter(c => {
    const idStr = String(c.id || '').toLowerCase();
    const channelStr = String(c.channel || '').toLowerCase();
    const agentStr = String(c.agent_id || c.agentId || '').toLowerCase();
    const customerStr = String(c.customer_name || c.customer_email || c.customer_identifier || c.customerIdentifier || '').toLowerCase();
    const searchLower = searchTerm.toLowerCase().trim();

    const matchesSearch = !searchLower || 
      idStr.includes(searchLower) || 
      channelStr.includes(searchLower) || 
      agentStr.includes(searchLower) || 
      customerStr.includes(searchLower);

    const isMatchStatus = 
      statusFilter === 'ALL' ||
      c.status === statusFilter ||
      (statusFilter === 'ACTIVE' && (c.status === 'ACTIVE' || c.status === 'OPEN')) ||
      (statusFilter === 'HUMAN_TAKEOVER' && c.status === 'HUMAN_TAKEOVER') ||
      (statusFilter === 'RESOLVED' && c.status === 'RESOLVED');

    return matchesSearch && isMatchStatus;
  });

  return (
    <div className="flex h-screen bg-[#f4f5f7] text-zinc-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f4f5f7]">
        <Navbar />

        <div className="flex-1 flex min-h-0">
          {/* Conversation List Pane */}
          <div className="w-80 md:w-96 border-r border-zinc-200 flex flex-col bg-white shrink-0">
            <div className="p-4 border-b border-zinc-200 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-zinc-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-zinc-600" />
                  Live Support Inbox
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchConversations(true)}
                    className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition"
                    title="Refresh conversations"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter sessions by customer or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-zinc-100 border border-zinc-200 rounded-xl p-0.5 text-xs">
                {[
                  { id: 'ALL', label: 'ALL' },
                  { id: 'ACTIVE', label: 'ACTIVE' },
                  { id: 'HUMAN_TAKEOVER', label: 'TAKEOVER' },
                  { id: 'RESOLVED', label: 'RESOLVED' }
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setStatusFilter(st.id)}
                    className={`flex-1 py-1 rounded-lg font-mono text-[10px] font-semibold uppercase transition ${
                      statusFilter === st.id ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List of sessions */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
              {loading ? (
                <div className="p-8 text-center text-xs text-zinc-500 font-mono flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-zinc-400" />
                  <span>Loading live sessions...</span>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400 font-mono">No conversations matching filters.</div>
              ) : (
                filteredConversations.map((convo) => {
                  const isSelected = selectedConvo?.id === convo.id;
                  const dateVal = convo.updated_at || convo.updatedAt || convo.created_at || convo.createdAt || Date.now();
                  const customerLabel = convo.customer_name || convo.customer_email || (convo.customer_identifier && !convo.customer_identifier.includes('anonymous') ? convo.customer_identifier : `Shopper #${convo.id.slice(-5)}`);
                  const isWeb = convo.channel === 'WEBSITE' || !convo.channel;

                  return (
                    <button
                      key={convo.id}
                      onClick={() => selectConversation(convo)}
                      className={`w-full text-left p-3.5 transition flex flex-col gap-1.5 border-l-3 ${
                        isSelected 
                          ? 'bg-zinc-50 border-zinc-900 shadow-xs' 
                          : 'border-transparent hover:bg-zinc-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-900 truncate max-w-[170px]">{customerLabel}</span>
                        <StatusBadge status={convo.status || 'ACTIVE'} size="sm" />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                        <span className="flex items-center gap-1 text-zinc-600">
                          {isWeb ? <Globe className="w-3 h-3 text-blue-500" /> : <Smartphone className="w-3 h-3 text-emerald-500" />}
                          <span className="truncate max-w-[120px]">{convo.agent_id || 'ShopMate AI'}</span>
                        </span>
                        <span className="flex items-center gap-1 text-zinc-400">
                          <Clock className="w-3 h-3" />
                          {new Date(dateVal).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat Stream & Details Pane */}
          {selectedConvo ? (
            <div className="flex-1 flex flex-col bg-[#f4f5f7] min-w-0">
              {/* Header */}
              <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-white shrink-0 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-zinc-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-zinc-900 flex items-center gap-2">
                      <span className="truncate">{selectedConvo.customer_name || selectedConvo.customer_email || `Session ${selectedConvo.id}`}</span>
                      <StatusBadge status={selectedConvo.status || 'ACTIVE'} size="sm" />
                    </h3>
                    <p className="text-[11px] text-zinc-500 font-mono truncate">
                      Channel: {selectedConvo.channel || 'WEBSITE'} • Agent: {selectedConvo.agent_id || 'ShopMate AI'} • ID: {selectedConvo.id}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {selectedConvo.status !== 'HUMAN_TAKEOVER' ? (
                    <button
                      onClick={() => handleTakeover('HUMAN_TAKEOVER')}
                      className="px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> Take Over Session
                    </button>
                  ) : (
                    <button
                      onClick={() => handleTakeover('ACTIVE')}
                      className="px-3.5 py-1.5 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Bot className="w-3.5 h-3.5" /> Return to AI
                    </button>
                  )}
                  <button
                    onClick={() => handleTakeover('RESOLVED')}
                    className="px-3.5 py-1.5 rounded-full bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Resolve
                  </button>
                </div>
              </div>

              {/* Message Transcript */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-xs text-zinc-400 font-mono">No messages recorded in this session.</div>
                ) : (
                  messages.map((m) => {
                    const isUserRole = m.role?.toLowerCase() === 'user';
                    const isHumanHandoff = m.role?.toUpperCase() === 'HUMAN';
                    const msgTime = m.created_at || m.createdAt || Date.now();

                    // Extract products from interactive_payload or metadata
                    const productsList: ProductCardData[] = 
                      (m.interactive_payload?.type === 'PRODUCTS' && Array.isArray(m.interactive_payload.data))
                        ? m.interactive_payload.data
                        : (m.metadata?.products && Array.isArray(m.metadata.products))
                        ? m.metadata.products
                        : [];

                    const orderTrackingData = 
                      (m.interactive_payload?.type === 'ORDER_TRACKING')
                        ? m.interactive_payload.data
                        : null;

                    return (
                      <div
                        key={m.id}
                        className={`flex items-start gap-3 ${isUserRole ? 'flex-row-reverse' : 'flex-row'}`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs shadow-2xs ${
                            isUserRole
                              ? 'bg-zinc-900 text-white font-bold'
                              : isHumanHandoff
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {isUserRole ? <User className="w-3.5 h-3.5" /> : isHumanHandoff ? <Headphones className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                        </div>

                        <div className={`flex flex-col gap-1.5 max-w-xl ${isUserRole ? 'items-end' : 'items-start'}`}>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
                            <span className="font-semibold text-zinc-700">
                              {isUserRole ? 'Customer' : isHumanHandoff ? 'Human Operator' : 'ShopMate AI'}
                            </span>
                            <span>•</span>
                            <span>{new Date(msgTime).toLocaleTimeString('en-US')}</span>
                          </div>

                          <div
                            className={`p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap shadow-2xs ${
                              isUserRole
                                ? 'bg-zinc-900 text-white rounded-tr-none'
                                : isHumanHandoff
                                ? 'bg-amber-50 border border-amber-200 text-amber-900 rounded-tl-none'
                                : 'bg-white border border-zinc-200 text-zinc-900 rounded-tl-none'
                            }`}
                          >
                            {renderFormattedText(m.content)}
                          </div>

                          {/* Live Product Cards Rendered in Real-Time */}
                          {productsList.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full mt-1.5">
                              {productsList.map((p, pIdx) => {
                                const imgSrc = p.imageUrl || p.images?.[0] || 'https://cdn.shopify.com/s/files/1/0446/5629/6087/files/SJ1-1-100.webp?v=1776246748';
                                return (
                                  <div 
                                    key={p.id || pIdx} 
                                    className="bg-white border border-zinc-200 hover:border-zinc-300 transition rounded-2xl p-3 flex flex-col justify-between gap-2.5 shadow-2xs group"
                                  >
                                    <div className="flex items-start gap-2.5">
                                      <div 
                                        onClick={() => {
                                          setPreviewModal({
                                            url: imgSrc,
                                            title: p.title,
                                            price: p.price,
                                            description: p.description
                                          });
                                          setZoomScale(1);
                                        }}
                                        className="w-16 h-16 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer relative group/img shadow-2xs"
                                        title="Click to zoom image"
                                      >
                                        <img src={imgSrc} alt={p.title} className="w-full h-full object-cover group-hover/img:scale-105 transition duration-300" />
                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center">
                                          <ZoomIn className="w-3.5 h-3.5 text-white" />
                                        </div>
                                      </div>

                                      <div className="flex-1 min-w-0">
                                        <h4 className="text-xs font-bold text-zinc-900 truncate leading-snug">{p.title}</h4>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <span className="text-xs font-bold text-emerald-700 font-mono">₹{p.price?.toLocaleString('en-IN')}</span>
                                          {p.compare_at_price && p.compare_at_price > p.price && (
                                            <span className="text-[10px] text-zinc-400 line-through font-mono">₹{p.compare_at_price?.toLocaleString('en-IN')}</span>
                                          )}
                                        </div>
                                        {p.category && (
                                          <span className="inline-block mt-1 text-[9px] font-medium bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">
                                            {p.category}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {p.description && (
                                      <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed">
                                        {p.description}
                                      </p>
                                    )}

                                    <div className="flex items-center justify-between pt-1 border-t border-zinc-100 text-[10px]">
                                      <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> In Stock
                                      </span>
                                      <button
                                        onClick={() => {
                                          setPreviewModal({
                                            url: imgSrc,
                                            title: p.title,
                                            price: p.price,
                                            description: p.description
                                          });
                                        }}
                                        className="text-zinc-600 hover:text-zinc-900 font-semibold flex items-center gap-0.5"
                                      >
                                        View Photo <ArrowUpRight className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Live Order Tracking Cards */}
                          {orderTrackingData && (
                            <div className="w-full mt-1.5 bg-white border border-zinc-200 rounded-2xl p-3.5 shadow-2xs space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Truck className="w-4 h-4 text-emerald-600" />
                                  <span className="text-xs font-bold text-zinc-900">{orderTrackingData.order_number || 'Order Tracking'}</span>
                                </div>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                                  {orderTrackingData.status || 'IN TRANSIT'}
                                </span>
                              </div>
                              <div className="text-xs text-zinc-600 font-mono space-y-1">
                                <div>Carrier: <strong className="text-zinc-900">{orderTrackingData.carrier || 'Bluedart Express'}</strong></div>
                                <div>Tracking: <strong className="text-zinc-900">{orderTrackingData.tracking_number || 'BD-8941039821-IN'}</strong></div>
                                {orderTrackingData.estimated_delivery && (
                                  <div>ETA: <strong className="text-emerald-700">{orderTrackingData.estimated_delivery}</strong></div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Takeover Reply Box */}
              <form onSubmit={handleSendReply} className="p-4 border-t border-zinc-200 bg-white flex gap-2 shrink-0">
                <input
                  type="text"
                  placeholder={selectedConvo.status === 'HUMAN_TAKEOVER' ? "Type human operator response..." : "Take over session to send manual response..."}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || sendingReply}
                  className="px-4 py-2 bg-[#18181b] hover:bg-[#27272a] text-white text-xs font-semibold rounded-xl transition disabled:opacity-40 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" /> Send
                </button>
              </form>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8 text-zinc-400 text-xs font-mono">
              Select a session from the list to view transcript and manage human handoff.
            </div>
          )}
        </div>
      </div>

      {/* Full Resolution Image & Product Zoom Modal */}
      {previewModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewModal(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-zinc-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/70">
              <div>
                <h3 className="text-xs font-bold text-zinc-900">{previewModal.title}</h3>
                {previewModal.price && (
                  <p className="text-xs font-semibold text-emerald-600 font-mono mt-0.5">₹{previewModal.price.toLocaleString('en-IN')}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoomScale(s => Math.min(s + 0.25, 2.5))}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-black/5 transition"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomScale(s => Math.max(s - 0.25, 0.75))}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-black/5 transition"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-black/5 transition"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-zinc-50 min-h-[300px]">
              <img 
                src={previewModal.url} 
                alt={previewModal.title} 
                className="max-h-[60vh] w-auto object-contain rounded-xl transition-transform duration-200"
                style={{ transform: `scale(${zoomScale})` }}
              />
            </div>

            {previewModal.description && (
              <div className="p-4 border-t border-zinc-100 bg-white">
                <p className="text-xs text-zinc-600 leading-relaxed">{previewModal.description}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}