'use client';

import React, { useEffect, useState, use } from 'react';
import Navbar from '@/components/layout/Navbar';
import StudioSidebar from '@/components/layout/StudioSidebar';
import { BarChart3, CheckCircle2, Clock, Cpu, Zap, Activity } from 'lucide-react';

export default function AgentAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const agentId = resolvedParams.id;
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {});
  }, [agentId]);

  return (
    <div className="flex h-screen bg-[#f4f5f7] text-zinc-900 font-sans antialiased overflow-hidden selection:bg-zinc-200">
      <StudioSidebar agentId={agentId} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="max-w-5xl mx-auto space-y-6">
            <div>
              <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Agent Analytics & Traces</h1>
              <p className="text-xs text-zinc-600 mt-1">Real-time latency breakdown, token consumption, and execution step traces.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-1 shadow-2xs">
                <span className="text-[10px] font-mono text-zinc-500 uppercase font-semibold">Avg Response Latency</span>
                <p className="text-2xl font-bold font-mono text-zinc-900">{data?.avgLatencyMs ?? 0}ms</p>
                <p className="text-[10px] font-mono text-emerald-700 font-semibold">Live Real-Time</p>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-1 shadow-2xs">
                <span className="text-[10px] font-mono text-zinc-500 uppercase font-semibold">Total Tokens Processed</span>
                <p className="text-2xl font-bold font-mono text-zinc-900">{Number(data?.totalTokens ?? 0).toLocaleString('en-IN')}</p>
                <p className="text-[10px] font-mono text-zinc-500">Live Agent Interactions</p>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-1 shadow-2xs">
                <span className="text-[10px] font-mono text-zinc-500 uppercase font-semibold">Tool Success Rate</span>
                <p className="text-2xl font-bold font-mono text-emerald-700">{data?.toolSuccessRate || '0.0%'}</p>
                <p className="text-[10px] font-mono text-zinc-500">Verified tool executions</p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-zinc-200 space-y-4 shadow-2xs">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Recent Execution Traces</h3>
              <div className="space-y-3">
                {(!data?.traces || data.traces.length === 0) ? (
                  <div className="py-8 text-center text-xs text-zinc-400 font-mono">
                    No execution traces recorded yet. Traces will appear here in real-time as users interact with this agent.
                  </div>
                ) : (
                  data.traces.map((t: any) => (
                    <div key={t.id} className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs space-y-2 hover:bg-white transition">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-900 font-mono">{t.id}</span>
                        <span className="font-mono text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">{t.latency_ms}ms • {t.tokens_used?.total || 140} tokens</span>
                      </div>
                      <p className="text-zinc-800"><strong>Intent:</strong> {t.intent}</p>
                      <p className="text-zinc-600"><strong>Tools:</strong> {t.tool_executions?.map((x: any) => x.tool_name).join(', ') || 'None'}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
