'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import { 
  Sparkles, BookOpen, Search, Eye, Globe, 
  Settings, ArrowUpRight, Zap, Layers 
} from 'lucide-react';

export default function AiModeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { name: 'Overview', href: '/ai-mode', icon: Sparkles, exact: true },
    { name: 'Knowledge', href: '/ai-mode/knowledge', icon: BookOpen },
    { name: 'AI Search', href: '/ai-mode/search', icon: Search },
    { name: 'Preview', href: '/ai-mode/preview', icon: Eye },
    { name: 'Deployment', href: '/ai-mode/deployment', icon: Globe },
    { name: 'Settings', href: '/ai-mode/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#fafafa] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />

        {/* AI Mode Sub-Header & Navigation Tabs */}
        <header className="bg-white border-b border-zinc-200 px-6 pt-5 pb-0 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-200">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-zinc-900 tracking-tight">AI Mode</h1>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                    Standalone Engine
                  </span>
                </div>
                <p className="text-xs text-zinc-500">
                  Next-generation AI-native shopping experience, hybrid retrieval, and standalone widget deployment.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link 
                href="/ai-mode/preview"
                className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-300" />
                <span>Live Preview</span>
              </Link>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="flex space-x-1 border-t border-zinc-100 pt-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.exact 
                ? pathname === tab.href 
                : pathname.startsWith(tab.href);

              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition -mb-px whitespace-nowrap ${
                    isActive
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-zinc-500 hover:text-zinc-900 hover:border-zinc-300'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600' : 'text-zinc-400'}`} />
                  <span>{tab.name}</span>
                </Link>
              );
            })}
          </nav>
        </header>

        {/* Main AI Mode Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
