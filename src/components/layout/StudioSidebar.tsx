'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  ArrowLeft, Bot, Palette, ShieldCheck, 
  Play, Rocket, ChevronRight 
} from 'lucide-react';

export default function StudioSidebar({ agentId, agentName }: { agentId: string; agentName?: string; [key: string]: any }) {
  const pathname = usePathname();

  const studioTabs = [
    { name: 'Overview', path: `/agents/${agentId}`, icon: Bot },
    { name: 'Identity & Persona', path: `/agents/${agentId}/design`, icon: Palette },
    { name: 'Guardrails & Rules', path: `/agents/${agentId}/rules`, icon: ShieldCheck },
    { name: 'Playground', path: `/agents/${agentId}/playground`, icon: Play, highlight: true },
    { name: 'Deploy & Embed', path: `/agents/${agentId}/deploy`, icon: Rocket },
  ];

  return (
    <aside className="w-56 border-r border-zinc-200 bg-[#f9fafb] flex flex-col justify-between shrink-0 select-none">
      <div className="flex flex-col">
        {/* Back button & Agent Badge */}
        <div className="h-14 px-3 border-b border-zinc-200 flex items-center justify-between bg-white">
          <Link
            href="/agents"
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-950 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Fleet
          </Link>
          <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-700 truncate max-w-[90px]">
            {agentId}
          </span>
        </div>

        {/* Studio Sub-pages */}
        <nav className="p-2 space-y-0.5 overflow-y-auto max-h-[calc(100vh-130px)]">
          {studioTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.path;
            return (
              <Link
                key={tab.name}
                href={tab.path}
                prefetch={true}
                className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition ${
                  isActive
                    ? 'bg-white text-zinc-950 font-semibold border border-zinc-200 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-zinc-950' : 'text-zinc-500'}`} />
                  <span>{tab.name}</span>
                </div>
                {tab.highlight && !isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-2.5 border-t border-zinc-200 bg-white">
        <Link
          href={`/agents/${agentId}/playground`}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-[#18181b] hover:bg-[#27272a] text-white text-xs font-semibold transition shadow-xs"
        >
          <Play className="w-3 h-3 fill-current" /> Test in Playground
        </Link>
      </div>
    </aside>
  );
}