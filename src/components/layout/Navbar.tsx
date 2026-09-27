'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Bot, Shield, LogOut, ChevronDown, User, Plus, 
  Building, Search, Sparkles, ExternalLink, ArrowRight,
  Menu, X, LayoutGrid, Package, BookOpen, Layers, 
  MessageSquare, BarChart3, Globe, ShieldCheck, Users, CreditCard, Settings
} from 'lucide-react';
import CommandMenu from '@/components/ui/CommandMenu';
import { fetchWithCache, getClientCachedData } from '@/lib/client-cache';

export default function Navbar() {
  const router = useRouter();
  const cachedUser = getClientCachedData<{ user: any }>('/api/auth/me');
  const [user, setUser] = useState<any>(() => cachedUser?.user || null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  const mobileLinks = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutGrid },
    { name: 'AI Agent Studio', href: '/agents/agent_shopmate_01', icon: Bot },
    { name: 'Products & Catalog', href: '/products', icon: Package },
    { name: 'Knowledge Base', href: '/knowledge', icon: BookOpen },
    { name: 'Conversations', href: '/conversations', icon: MessageSquare },
    { name: 'Integrations Hub', href: '/integrations', icon: Layers },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Widget & Deploy', href: '/deployments', icon: Globe },
    { name: 'Security Console', href: '/security', icon: ShieldCheck },
    { name: 'Team Members', href: '/team', icon: Users },
    { name: 'Billing & Plans', href: '/billing', icon: CreditCard },
    { name: 'Settings', href: '/settings', icon: Settings },
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
            className="md:hidden p-1.5 rounded-lg text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 border border-zinc-200 transition"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-lg bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <Building className="w-3.5 h-3.5 text-zinc-500" />
            <span className="truncate max-w-[110px] sm:max-w-[150px] font-semibold text-zinc-900">{user?.workspaceName || 'Blue Tyga Store'}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-200/80 text-zinc-600 font-medium hidden sm:inline">
              {user?.role || 'OWNER'}
            </span>
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
                  return (
                    <Link
                      key={link.name}
                      href={link.href}
                      onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 transition"
                    >
                      <Icon className="w-4 h-4 text-zinc-500 shrink-0" />
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