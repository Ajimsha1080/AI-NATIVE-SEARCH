'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import StudioSidebar from '@/components/layout/StudioSidebar';
import { MessageSquare, ArrowRight, ExternalLink, Inbox } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default function AgentConversationsPage() {
  const params = useParams();
  const agentId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
  const [conversations, setConversations] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/conversations')
      .then(r => r.json())
      .then(d => {
        const list = (d.conversations || []).filter((c: any) => c.agent_id === agentId);
        setConversations(list.length > 0 ? list : d.conversations || []);
      })
      .catch(() => {});
  }, [agentId]);

  return (
    <div className="flex h-screen bg-[#f4f5f7] text-zinc-900 font-sans antialiased overflow-hidden selection:bg-zinc-200">
      <StudioSidebar agentId={agentId} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Agent Conversation Sessions</h1>
                <p className="text-xs text-zinc-600 mt-1">Audit customer dialogs, tool calls, and escalations handled by this agent.</p>
              </div>
              <Link
                href="/conversations"
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded-xl transition flex items-center gap-2 shadow-xs"
              >
                <Inbox className="w-3.5 h-3.5" />
                <span>Open Full Inbox</span>
              </Link>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-zinc-200 space-y-4 shadow-2xs">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Active Sessions ({conversations.length})</h3>
              <div className="divide-y divide-zinc-100">
                {conversations.length > 0 ? (
                  conversations.map((c) => (
                    <div key={c.id} className="py-4 flex items-center justify-between hover:bg-zinc-50/60 p-2 rounded-xl transition">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-zinc-900 text-xs">{c.id}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                            c.status === 'ESCALATED'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {c.status}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-600 mt-1">
                          Channel: <strong className="text-zinc-800">{c.channel}</strong> • {c.message_count} messages
                        </p>
                      </div>
                      <Link
                        href={`/conversations/${c.id}`}
                        className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-xs text-zinc-900 font-semibold rounded-xl border border-zinc-200 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Inspect Thread</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center text-xs text-zinc-400 space-y-2">
                    <MessageSquare className="w-6 h-6 mx-auto text-zinc-300" />
                    <p className="font-medium text-zinc-600">No active customer sessions</p>
                    <p className="text-[11px] text-zinc-400">Conversations handled by this agent will appear here in real time.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
