'use client';
import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import StudioSidebar from '@/components/layout/StudioSidebar';
import ChatBox from '@/components/chat/ChatBox';
import TraceInspector from '@/components/studio/TraceInspector';
import { 
  Bot, Rocket, CheckCircle2, ShieldCheck, Sparkles, 
  RotateCcw, ArrowRight, Activity, Zap, Terminal, RefreshCw
} from 'lucide-react';

export default function PlaygroundPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const agentId = resolvedParams.id;
  const [agent, setAgent] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [tools, setTools] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [currentTrace, setCurrentTrace] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  useEffect(() => {
    fetch(`/api/agents/${agentId}`)
      .then(r => r.json())
      .then(d => {
        setAgent(d.agent);
        setConfig(d.config);
        setTools(d.tools || []);
        setPolicies(d.policies || []);
      })
      .catch(() => {});
  }, [agentId]);

  const [testTrigger, setTestTrigger] = useState<{ text: string; timestamp: number } | null>(null);

  const handleSyncToDeploy = async () => {
    setIsSyncing(true);
    try {
      // Trigger instant sync to deploy runtime
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: {
            status: 'PUBLISHED'
          }
        })
      });
      if (res.ok) {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f4f5f7] text-zinc-900 font-sans antialiased overflow-hidden selection:bg-zinc-200 selection:text-zinc-900">
      <StudioSidebar agentId={agentId} agentName={agent?.name} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />

        {/* Agent Testing Suite Control Header */}
        <header className="px-5 py-3 bg-white border-b border-zinc-200 shrink-0 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-2xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-zinc-950">Agent Testing Suite</h1>
                <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Sandbox
                </span>
                <span className="text-[10px] font-medium text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 font-mono">
                  {agent?.name || 'Blue Tyga Concierge'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500">
                Execute interactive test queries against live catalog tools, RAG policies &amp; guardrails before deploying.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {syncSuccess && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 animate-fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" /> Synced with Deploy!
              </span>
            )}

            <button
              onClick={handleSyncToDeploy}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-300 transition shadow-2xs disabled:opacity-60"
              title="Sync latest tested persona, guardrails, and catalog configuration to deployment"
            >
              {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-600" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-zinc-600" />
              )}
              <span>Sync Changes</span>
            </button>

            <Link
              href={`/agents/${agentId}/deploy`}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#18181b] hover:bg-[#27272a] text-white transition shadow-xs"
            >
              <Rocket className="w-3.5 h-3.5 text-emerald-400" />
              <span>Deploy &amp; Embed</span>
              <ArrowRight className="w-3 h-3 text-zinc-400" />
            </Link>
          </div>
        </header>

        {/* Main Testing Area: Chat Sandbox + Trace Telemetry */}
        <main className="flex-1 p-5 grid grid-cols-1 lg:grid-cols-2 gap-5 min-h-0 overflow-hidden">
          <div className="h-full min-h-0">
            <ChatBox
              agentId={agentId}
              agentName={agent?.name || 'Blue Tyga AI Concierge'}
              externalTrigger={testTrigger}
              onTraceUpdate={trace => setCurrentTrace(trace)}
            />
          </div>
          <div className="h-full min-h-0 overflow-hidden">
            <TraceInspector 
              trace={currentTrace} 
              onSelectPrompt={prompt => setTestTrigger({ text: prompt, timestamp: Date.now() })}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
