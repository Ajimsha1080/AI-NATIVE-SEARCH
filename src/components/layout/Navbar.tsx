'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Bot, Shield, LogOut, ChevronDown, User, Plus, 
  Building, Search, ExternalLink, ArrowRight,
  Menu, X, LayoutGrid, Package, BookOpen, Layers, 
  MessageSquare, BarChart3, Globe, ShieldCheck, Users, CreditCard, Settings
} from 'lucide-react';
import CommandMenu from '@/components/ui/CommandMenu';
import { fetchWithCache, getClientCachedData } from '@/lib/client-cache';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const cachedUser = getClientCachedData<{ user: any }>('/api/auth/me');
  const [user, setUser] = useState<any>(() => cachedUser?.user || null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  const mobileLinks = [
    { name: 'AI Mode', href: '/ai-mode', icon: Layers, exact: true },
    { name: 'AI Search', href: '/ai-mode/search', icon: Search },
    { name: 'Products (Catalog)', href: '/products', icon: Package },
    { name: 'Knowledge Base', href: '/ai-mode/knowledge', icon: BookOpen },
    { name: 'Deployments', href: '/ai-mode/deployment', icon: Globe },
    { name: 'Settings', href: '/ai-mode/settings', icon: Settings },
  ];

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
      <header className="h-14 border-b border-zinc-200 bg-white px-3 sm:px-6 flex items-center justify-between z-30 shrink-0 select-none">
        {/* Mobile Hamburger & Workspace Indicator */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open Navigation Menu"
            className="md:hidden p-1.5 rounded-lg text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 border border-zinc-200 transition cursor-pointer"
            title="Open Menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Workspace Switcher */}
          <div className="relative">
            <button
              onClick={async () => {
                const nextState = !wsMenuOpen;
                setWsMenuOpen(nextState);
                if (nextState) {
                  try {
                    const res = await fetch('/api/v1/workspaces/mine', { credentials: 'include' });
                    if (res.ok) {
                      const d = await res.json();
                      setWorkspaces(d.workspaces || []);
                    }
                  } catch (e) {
                    console.error(e);
                  }
                }
              }}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-xs font-medium text-zinc-700 cursor-pointer transition"
              title="Switch Workspace"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <Building className="w-3.5 h-3.5 text-zinc-500" />
              <span className="truncate max-w-[110px] sm:max-w-[150px] font-semibold text-zinc-900">
                {user?.workspaceName || 'My Store'}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-200/80 text-zinc-600 font-medium hidden sm:inline">
                {user?.role || 'OWNER'}
              </span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {wsMenuOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-white border border-zinc-200 rounded-xl shadow-xl py-1 z-50 text-xs divide-y divide-zinc-100">
                <div className="px-3 py-2 bg-zinc-50/50">
                  <p className="font-bold text-[11px] text-zinc-500 uppercase tracking-wider">Your Workspaces</p>
                </div>
                <div className="py-1 max-h-48 overflow-y-auto">
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/v1/workspaces/switch', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ workspace_id: ws.id }),
                          });
                          if (res.ok) {
                            window.location.reload();
                          }
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-zinc-50 cursor-pointer transition ${
                        ws.is_current ? 'bg-indigo-50/40 text-indigo-900 font-bold' : 'text-zinc-700'
                      }`}
                    >
                      <div className="truncate">
                        <div className="truncate font-semibold">{ws.name}</div>
                        <div className="text-[10px] text-zinc-400 font-mono">{ws.role}</div>
                      </div>
                      {ws.is_current && <span className="text-indigo-600 text-[10px] font-bold">ACTIVE</span>}
                    </button>
                  ))}
                </div>
                <div className="p-2">
                  <Link
                    href="/ai-mode/team"
                    onClick={() => setWsMenuOpen(false)}
                    className="block text-center py-1 text-indigo-600 hover:text-indigo-800 font-bold text-[11px]"
                  >
                    Manage Team &amp; Access &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* User dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-1.5 sm:gap-2 p-1 px-2 rounded-lg bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 transition"
            >
              <div className="w-6 h-6 rounded-full bg-zinc-900 text-white font-bold text-xs flex items-center justify-center font-mono shadow-2xs">
                {user?.name ? user.name[0].toUpperCase() : 'M'}
              </div>
              <span className="text-xs font-semibold hidden md:inline truncate max-w-[100px]">{user?.name || 'Merchant'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white border border-zinc-200 rounded-xl shadow-lg py-1 z-50 text-xs divide-y divide-zinc-100">
                <div className="px-3 py-2">
                  <p className="font-semibold text-zinc-900 truncate">{user?.name || 'Alex Vance (Store Owner)'}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{user?.email || 'merchant@shopmate.com'}</p>
                </div>

                <div className="py-1">
                  <Link
                    href="/ai-mode/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-1.5 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-50 transition"
                  >
                    <User className="w-3.5 h-3.5 text-zinc-400" /> AI Settings
                  </Link>
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

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-zinc-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileNavOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-[280px] max-w-[85vw] bg-white h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
            <div className="flex flex-col h-full overflow-hidden">
              {/* Drawer Header */}
              <div className="h-14 px-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center text-white font-bold text-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm text-zinc-900">ShopMate AI</span>
                </div>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="p-1 rounded-lg text-zinc-500 hover:text-zinc-950 hover:bg-zinc-200/60 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="p-3 space-y-1 overflow-y-auto flex-1">
                {mobileLinks.map((link) => {
                  const Icon = link.icon;
                  const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.name}
                      href={link.href}
                      onClick={() => setMobileNavOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                        active
                          ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-2xs'
                          : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                        active ? 'text-zinc-950 stroke-[2.2]' : 'text-zinc-500'
                      }`} />
                      <span>{link.name}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Drawer Bottom User Info */}
              <div className="p-3 border-t border-zinc-200 bg-zinc-50 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-600">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-semibold text-zinc-800">{user?.name || 'Merchant'}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-rose-600 hover:underline text-xs font-semibold"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <CommandMenu isOpen={commandOpen} onClose={() => setCommandOpen(false)} />
    </>
  );
}