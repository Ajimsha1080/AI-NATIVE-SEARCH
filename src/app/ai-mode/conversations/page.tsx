'use client';

import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, ShieldCheck, ShieldAlert, User, Bot, 
  Search, RefreshCw, Eye, EyeOff, Calendar, AlertCircle
} from 'lucide-react';

interface Message {
  id: string;
  sender: string;
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  status: string;
  message_count: number;
  created_at: string;
  messages: Message[];
}

export default function ConversationsViewerPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [redactPII, setRedactPII] = useState(true);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/analytics/conversations?redact_pii=${redactPII}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
        if (selectedConv) {
          const updated = (data.conversations || []).find((c: Conversation) => c.id === selectedConv.id);
          if (updated) setSelectedConv(updated);
        }
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [redactPII]);

  const filtered = conversations.filter(c => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      c.messages?.some(m => m.content.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto h-[calc(100vh-6rem)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Customer Conversations</h1>
          <p className="text-xs text-zinc-500">Inspect shopper chat interactions with built-in DPDP compliance controls.</p>
        </div>

        {/* PII Toggle & Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRedactPII(prev => !prev)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition shadow-2xs ${
              redactPII
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {redactPII ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                PII Redaction Active
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                PII Masking Off (Raw Data)
              </>
            )}
          </button>

          <button
            onClick={fetchConversations}
            className="p-2 bg-white border border-zinc-200 rounded-xl text-zinc-600 hover:bg-zinc-50 transition shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Dual-Pane Viewer */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-6 bg-white border border-zinc-200 rounded-2xl shadow-2xs overflow-hidden">
        {/* Left Column: Conversations List */}
        <div className="md:col-span-4 border-r border-zinc-200 flex flex-col h-full">
          <div className="p-3 border-b border-zinc-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="Search transcripts..."
                className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
            {loading && conversations.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 text-xs">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-indigo-500" />
                Loading sessions...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 text-xs">
                <MessageSquare className="w-5 h-5 mx-auto mb-2 text-zinc-300" />
                No conversations found.
              </div>
            ) : (
              filtered.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelectedConv(c)}
                  className={`p-3.5 cursor-pointer transition text-xs ${
                    selectedConv?.id === c.id ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : 'hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold text-zinc-900 mb-1">
                    <span className="truncate max-w-[180px]">{c.title || 'Inquiry Session'}</span>
                    <span className="text-[10px] text-zinc-400 font-normal">
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-500 text-[11px]">
                    <span>{c.messages?.length || 0} messages</span>
                    <span className="text-[10px] bg-zinc-100 px-1.5 py-0.5 rounded font-mono text-zinc-600">
                      {c.id.slice(0, 10)}...
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Transcript Viewer */}
        <div className="md:col-span-8 flex flex-col h-full bg-zinc-50/40">
          {selectedConv ? (
            <>
              {/* Transcript Header */}
              <div className="p-4 bg-white border-b border-zinc-200 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-zinc-900">{selectedConv.title || 'Customer Session'}</h3>
                  <span className="text-[10px] text-zinc-400 font-mono">Session ID: {selectedConv.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                    {selectedConv.status}
                  </span>
                </div>
              </div>

              {/* Messages Thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedConv.messages?.length === 0 ? (
                  <div className="py-12 text-center text-zinc-400 text-xs">
                    No messages recorded in this session.
                  </div>
                ) : (
                  selectedConv.messages?.map(m => {
                    const isUser = m.sender === 'user' || m.sender === 'shopper';
                    return (
                      <div
                        key={m.id}
                        className={`flex gap-3 max-w-xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white ${
                          isUser ? 'bg-zinc-800' : 'bg-indigo-600'
                        }`}>
                          {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                        </div>
                        <div className={`p-3.5 rounded-2xl text-xs space-y-1 shadow-2xs ${
                          isUser ? 'bg-indigo-600 text-white rounded-tr-xs' : 'bg-white text-zinc-800 border border-zinc-200 rounded-tl-xs'
                        }`}>
                          <div className={`text-[10px] font-semibold ${isUser ? 'text-indigo-200' : 'text-zinc-400'}`}>
                            {isUser ? 'Shopper' : 'ShopMate AI'}
                          </div>
                          <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 text-xs space-y-2">
              <MessageSquare className="w-8 h-8 text-zinc-300" />
              <span>Select a conversation from the left to view the transcript.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
