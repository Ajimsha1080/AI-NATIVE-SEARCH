'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Bot, Shield, LogOut, ChevronDown, User, Plus, 
  Building, Search, Sparkles, ExternalLink, ArrowRight
} from 'lucide-react';
import CommandMenu from '@/components/ui/CommandMenu';
import PortalSwitcher from '@/components/layout/PortalSwitcher';
import { fetchWithCache, getClientCachedData } from '@/lib/client-cache';

export default function Navbar() {
  const router = useRouter();
  const cachedUser = getClientCachedData<{ user: any }>('/api/auth/me');
  const [user, setUser] = useState<any>(() => cachedUser?.user || null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const data = await fetchWithCache<{ user: any }>('/api/auth/me');
        if (data?.user) {
          setUser(data.user);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadUser();

    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(prev => !prev);
      }
    }
    window.addEventListener('keydown', handleKey);

    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/auth/login');
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <>
      {/* Main Light Navigation Header */}
      <header className="h-14 border-b border-zinc-200 bg-white px-4 sm:px-6 flex items-center justify-between z-30 shrink-0 select-none">
        {/* Workspace Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <Building className="w-3.5 h-3.5 text-zinc-500" />
            <span className="truncate max-w-[140px] font-semibold text-zinc-900">{user?.workspaceName || 'Blue Tyga Store'}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-200/80 text-zinc-600 font-medium">
              {user?.role || 'OWNER'}
            </span>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2.5">
          <PortalSwitcher isSuperAdmin={user ? !!user.is_super_admin : undefined} />

          <Link
            href="/agents/agent_shopmate_01/playground"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition shadow-xs"
          >
            <Bot className="w-3.5 h-3.5" /> Studio
          </Link>

          {/* User dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 p-1 px-2 rounded-lg bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 transition"
            >
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200 font-mono">
                {user?.name ? user.name[0].toUpperCase() : 'M'}
              </div>
              <span className="text-xs font-semibold hidden md:inline truncate max-w-[100px]">{user?.name || 'Merchant'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white border border-zinc-200 rounded-xl shadow-lg py-1 z-50 text-xs divide-y divide-zinc-100">
                <div className="px-3 py-2">
                  <p className="font-semibold text-zinc-900 truncate">{user?.name || 'Demo Merchant'}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{user?.email || 'merchant@shopmate.com'}</p>
                </div>

                <div className="py-1">
                  <Link
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-1.5 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-50 transition"
                  >
                    <User className="w-3.5 h-3.5 text-zinc-400" /> Settings
                  </Link>
                  {user?.is_super_admin && (
                    <Link
                      href="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 transition font-medium"
                    >
                      <Shield className="w-3.5 h-3.5 text-red-500" /> SuperAdmin
                    </Link>
                  )}
                </div>

                <div className="pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-rose-600 hover:bg-rose-50 transition text-left font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
      <CommandMenu isOpen={commandOpen} onClose={() => setCommandOpen(false)} />
    </>
  );
}