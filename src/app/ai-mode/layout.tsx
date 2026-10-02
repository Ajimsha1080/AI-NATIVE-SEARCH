'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { 
  Sparkles, 
  BookOpen, 
  Search, 
  Code2, 
  Settings
} from 'lucide-react';

export default function AIModeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { name: 'Overview', href: '/ai-mode', icon: Sparkles, exact: true },
    { name: 'Knowledge', href: '/ai-mode/knowledge', icon: BookOpen },
    { name: 'AI Search', href: '/ai-mode/search', icon: Search },
    { name: 'Deployment', href: '/ai-mode/deployment', icon: Code2 },
    { name: 'Settings', href: '/ai-mode/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#f4f5f7] text-zinc-900 font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f4f5f7]">
        <Navbar />

        {/* AI Mode Sub-Header & Navigation */}
        <div className="bg-white border-b border-zinc-200/80 px-6 py-3 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-zinc-900 tracking-tight">AI Mode</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  NEW
                </span>
              </div>
              <p className="text-[11px] text-zinc-500">Autonomous conversational product discovery &amp; recommendation layer</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-zinc-100/80 p-1 rounded-xl border border-zinc-200/60">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-white text-zinc-900 font-semibold shadow-xs border border-zinc-200/60'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600' : 'text-zinc-500'}`} />
                  <span>{tab.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
