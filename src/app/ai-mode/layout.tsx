'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { 
  Layers, 
  BookOpen, 
  Search, 
  Code2,
  CreditCard,
  Users,
  Settings,
  ShoppingBag,
  BarChart3,
  MessageSquare
} from 'lucide-react';

export default function AIModeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { name: 'Overview', href: '/ai-mode', icon: Layers, exact: true },
    { name: 'Knowledge', href: '/ai-mode/knowledge', icon: BookOpen },
    { name: 'AI Search', href: '/ai-mode/search', icon: Search },
    { name: 'Orders', href: '/ai-mode/orders', icon: ShoppingBag },
    { name: 'Analytics', href: '/ai-mode/analytics', icon: BarChart3 },
    { name: 'Conversations', href: '/ai-mode/conversations', icon: MessageSquare },
    { name: 'Deployment', href: '/ai-mode/deployment', icon: Code2 },
    { name: 'Billing', href: '/ai-mode/billing', icon: CreditCard },
    { name: 'Team', href: '/ai-mode/team', icon: Users },
    { name: 'Settings', href: '/ai-mode/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#f4f5f7] text-zinc-900 font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f4f5f7]">
        <Navbar />

        {/* AI Mode Sub-Header & Navigation */}
        <div className="bg-white/95 backdrop-blur-md border-b border-zinc-200/80 px-6 py-2.5 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs z-10">
          <div>
            <h1 className="text-xs font-bold text-zinc-900 tracking-tight">AI Mode</h1>
            <p className="text-[11px] text-zinc-500">Autonomous conversational product discovery &amp; recommendation layer</p>
          </div>

          {/* Premium Segmented Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-zinc-100/90 p-1 rounded-xl border border-zinc-200/70 shadow-2xs self-start sm:self-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer select-none ${
                    isActive
                      ? 'bg-white text-zinc-900 font-semibold shadow-xs border border-zinc-200/80'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 transition-colors ${isActive ? 'text-indigo-600' : 'text-zinc-500'}`} />
                  <span>{tab.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
