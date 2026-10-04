'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Package, BookOpen, Layers, 
  Search, Globe, Settings, Menu
} from 'lucide-react';
import { fetchWithCache } from '@/lib/client-cache';

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    // Load persisted sidebar state
    const saved = localStorage.getItem('shopmate_sidebar_collapsed');
    if (saved !== null) {
      setIsCollapsed(saved === 'true');
    }

    const handleToggle = () => {
      const current = localStorage.getItem('shopmate_sidebar_collapsed') === 'true';
      setIsCollapsed(current);
    };

    window.addEventListener('shopmate_sidebar_toggle', handleToggle);

    // Background pre-warm core endpoints on idle
    const prewarm = () => {
      fetchWithCache('/api/commerce/products');
      fetchWithCache('/api/ai-mode/config');
      fetchWithCache('/api/ai-mode/knowledge');
      fetchWithCache('/api/ai-mode/deployments');
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(prewarm);
    } else {
      setTimeout(prewarm, 400);
    }

    return () => {
      window.removeEventListener('shopmate_sidebar_toggle', handleToggle);
    };
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('shopmate_sidebar_collapsed', String(next));
      window.dispatchEvent(new Event('shopmate_sidebar_toggle'));
      return next;
    });
  };

  const navigation = [
    { 
      name: 'AI Mode', 
      href: '/ai-mode', 
      icon: Layers,
      isActive: (path: string) => path === '/ai-mode'
    },
    { 
      name: 'AI Search', 
      href: '/ai-mode/search', 
      icon: Search,
      isActive: (path: string) => path.startsWith('/ai-mode/search')
    },
    { 
      name: 'Product Catalog', 
      href: '/products', 
      icon: Package,
      isActive: (path: string) => path.startsWith('/products')
    },
    { 
      name: 'Knowledge Base', 
      href: '/ai-mode/knowledge', 
      icon: BookOpen,
      isActive: (path: string) => path.startsWith('/ai-mode/knowledge')
    },
    { 
      name: 'Widget & Deploy', 
      href: '/ai-mode/deployment', 
      icon: Globe,
      isActive: (path: string) => path.startsWith('/ai-mode/deployment')
    },
    { 
      name: 'Settings', 
      href: '/ai-mode/settings', 
      icon: Settings,
      isActive: (path: string) => path.startsWith('/ai-mode/settings')
    },
  ];

  return (
    <aside 
      className={`hidden md:flex border-r border-zinc-200 bg-white flex-col justify-between shrink-0 select-none overflow-y-auto shadow-xs transition-all duration-200 ease-in-out ${
        isCollapsed ? 'w-16' : 'w-56'
      }`}
    >
      <div className="flex flex-col">
        {/* Brand Header with 3-bar Toggle */}
        <div className={`h-14 border-b border-zinc-100 flex items-center sticky top-0 bg-white z-10 transition-all ${
          isCollapsed ? 'px-2 justify-center' : 'px-4 justify-between'
        }`}>
          {!isCollapsed && (
            <Link href="/ai-mode" className="flex items-center gap-2 group truncate">
              <span className="font-bold text-sm text-zinc-900 tracking-tight">
                AI Native
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 border border-zinc-200 text-zinc-600 font-medium">
                SEARCH
              </span>
            </Link>
          )}

          {/* 3-Bar (Hamburger) Button to Open/Close Sidebar */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={isCollapsed ? "Open sidebar" : "Close sidebar"}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 border border-transparent hover:border-zinc-200 transition cursor-pointer flex items-center justify-center shrink-0"
            title={isCollapsed ? "Open sidebar (3-bar)" : "Close sidebar (3-bar)"}
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-2 space-y-0.5 pt-2.5">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = item.isActive(pathname);

            const handleHover = () => {
              if (item.href === '/products') fetchWithCache('/api/commerce/products');
              else if (item.href === '/ai-mode/knowledge') fetchWithCache('/api/ai-mode/knowledge');
              else if (item.href === '/ai-mode/deployment') fetchWithCache('/api/ai-mode/deployments');
              else if (item.href === '/ai-mode/settings') fetchWithCache('/api/ai-mode/config');
            };

            return (
              <Link
                key={item.name}
                href={item.href}
                prefetch={true}
                onMouseEnter={handleHover}
                title={item.name}
                className={`flex items-center rounded-xl text-xs font-medium transition-all duration-150 group relative ${
                  isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'
                } ${
                  active
                    ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50'
                }`}
              >
                <Icon 
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    active ? 'text-zinc-950 stroke-[2.2]' : 'text-zinc-500 group-hover:text-zinc-900'
                  }`} 
                />
                {!isCollapsed && (
                  <span className="tracking-tight truncate">{item.name}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Footer Actions */}
      <div className={`p-2.5 border-t border-zinc-100 sticky bottom-0 bg-white space-y-1 ${
        isCollapsed ? 'flex justify-center' : ''
      }`}>
        <Link
          href="/ai-mode/settings"
          className={`flex items-center rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 transition group ${
            isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
          }`}
          title="Settings"
        >
          <Settings className="w-4 h-4 text-zinc-500 group-hover:text-zinc-900 shrink-0" />
          {!isCollapsed && (
            <span className="text-xs">Settings</span>
          )}
        </Link>
      </div>
    </aside>
  );
}