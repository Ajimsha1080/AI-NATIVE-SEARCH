'use client';

import React, { useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import ChatBox from '@/components/chat/ChatBox';
import TraceInspector from '@/components/studio/TraceInspector';
import { 
  Search, Play, Bug, Database, Cpu, Sparkles, 
  CheckCircle2, ShieldCheck, Terminal, Layers, RefreshCw 
} from 'lucide-react';

export default function AISearchPlaygroundPage() {
  const [currentTrace, setCurrentTrace] = useState<any>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedAgentName, setSelectedAgentName] = useState<string>('ShopMate AI Concierge');

  React.useEffect(() => {
    async function loadAgents() {
      try {
        const res = await fetch('/api/agents');
        if (res.ok) {
          const data = await res.json();
          const list = data.agents || [];
          setAgents(list);
          if (list.length > 0) {
            setSelectedAgentId(list[0].id);
            setSelectedAgentName(list[0].name);
          }
        }
      } catch {}
    }
    loadAgents();
  }, []);

  return (
    <div className="flex h-screen bg-[#f4f5f7] text-zinc-900 font-sans antialiased selection:bg-zinc-200 selection:text-zinc-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />

        <div className="flex-1 overflow-hidden flex flex-col p-5 space-y-4">
          
          {/* Header & Debug Mode Toggle */}
          <div className="bg-white border border-zinc-200 rounded-2xl px-5 py-3.5 flex items-center justify-between shrink-0 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-xs">
                <Search className="w-4.5 h-4.5" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  AI Search &amp; Storefront Testing Playground
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </h1>
                <p className="text-[11px] text-zinc-500">
                  Execute live customer natural queries, product searches, image uploads, policy lookups, and order status.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {agents.length > 1 && (
                <select
                  value={selectedAgentId}
                  onChange={(e) => {
                    setSelectedAgentId(e.target.value);
                    const found = agents.find(a => a.id === e.target.value);
                    if (found) setSelectedAgentName(found.name);
                  }}
                  className="bg-zinc-50 border border-zinc-200 text-xs font-semibold text-zinc-800 rounded-xl px-3 py-1.5 focus:outline-none focus:border-zinc-400"
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              )}

              {/* Debug / Diagnostics Mode Toggle */}
              <button
                onClick={() => setDebugMode(!debugMode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                  debugMode
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                <Bug className="w-3.5 h-3.5" />
                <span>Admin Diagnostics: {debugMode ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>

          {/* Main Workspace Split: Chat Playground (Left) & Optional Debug Diagnostics (Right) */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 overflow-hidden">
            
            {/* Chat Testing Window */}
            <div className={`${debugMode ? 'lg:col-span-7' : 'lg:col-span-12'} h-full min-h-0`}>
              <ChatBox
                agentId={selectedAgentId || "agent_shopmate_01"}
                agentName={selectedAgentName}
                onTraceUpdate={(trace) => setCurrentTrace(trace)}
              />
            </div>

            {/* Debug Retrieval Diagnostics (Without exposing Chain-of-thought) */}
            {debugMode && (
              <div className="lg:col-span-5 h-full min-h-0 overflow-hidden flex flex-col bg-white border border-zinc-200 rounded-2xl shadow-2xs">
                <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-purple-600" />
                    <h2 className="text-xs font-bold text-zinc-900 uppercase font-mono tracking-wider">
                      Retrieval Diagnostics
                    </h2>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400">Live RRF Telemetry</span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {currentTrace ? (
                    <TraceInspector trace={currentTrace} />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-2">
                      <Database className="w-8 h-8 text-zinc-400" />
                      <p className="text-xs font-bold text-zinc-900">Awaiting Search Query</p>
                      <p className="text-[11px] text-zinc-500 max-w-xs">
                        Type a question like &quot;Show me black running shoes under ₹1,500&quot; to inspect dense/sparse ranking and grounding scores.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}
