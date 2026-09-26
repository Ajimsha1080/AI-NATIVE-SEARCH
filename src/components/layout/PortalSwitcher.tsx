'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, ShoppingBag, ShieldAlert, 
  ChevronDown, ExternalLink, ArrowRight, Sparkles, Layers
} from 'lucide-react';
import { fetchWithCache, getClientCachedData } from '@/lib/client-cache';

interface PortalSwitcherProps {
  isSuperAdmin?: boolean;
}

export default function PortalSwitcher({ isSuperAdmin: propIsSuperAdmin }: PortalSwitcherProps = {}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(() => {
    if (typeof propIsSuperAdmin === 'boolean') return propIsSuperAdmin;
    const cached = getClientCachedData<{ user: any }>('/api/auth/me');
    return !!cached?.user?.is_super_admin;
  });

  useEffect(() => {
    if (typeof propIsSuperAdmin === 'boolean') {
      setIsSuperAdmin(propIsSuperAdmin);
      return;
    }
    fetchWithCache<{ user: any }>('/api/auth/me')
      .then(res => {
        if (res?.user) {
          setIsSuperAdmin(!!res.user.is_super_admin);
        }
      })
      .catch(() => {});
  }, [propIsSuperAdmin]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const portals = [
    {
      id: 'merchant',
      name: 'Merchant Console',
      badge: 'B2B Admin',
      description: 'Fleet management, 12-stage RAG, agent studio & store analytics',
      href: '/dashboard',
      icon: LayoutDashboard,
      active: pathname.startsWith('/dashboard') || pathname.startsWith('/agents') || pathname.startsWith('/knowledge') || pathname.startsWith('/integrations')
    },
    {
      id: 'customer',
      name: 'Customer Storefront & AI',
      badge: 'Live Store Widget',
      description: 'Customer shopping experience, product search & AI order concierge',
      href: '/embed/dep_live_widget_01',
      icon: ShoppingBag,
      active: pathname.startsWith('/embed')
    },
    ...(isSuperAdmin ? [{
      id: 'superadmin',
      name: 'SuperAdmin Portal',
      badge: 'Platform Ops',
      description: 'Multi-tenant workspaces, DB health, system metrics & security audit',
      href: '/admin',
      icon: ShieldAlert,
      active: pathname.startsWith('/admin')
    }] : [])
  ];

  const currentPortal = portals.find(p => p.active) || portals[0];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-xs font-semibold text-zinc-800 shadow-2xs transition group"
      >
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-zinc-600 group-hover:scale-105 transition-transform" />
          <span className="hidden sm:inline text-zinc-500 font-normal">UI:</span>
          <span>{currentPortal.name}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-80 bg-white border border-zinc-200 rounded-2xl shadow-xl p-2 z-50 space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-indigo-600" /> Switch Main UI Portal
            </span>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full font-semibold">
              {portals.length} UIs Live
            </span>
          </div>

          <div className="space-y-1 pt-1">
            {portals.map((p) => {
              const Icon = p.icon;
              return (
                <Link
                  key={p.id}
                  href={p.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-start gap-3 p-2.5 rounded-xl transition text-left group ${
                    p.active
                      ? 'bg-zinc-50 border border-zinc-300 shadow-2xs'
                      : 'hover:bg-zinc-50 border border-transparent'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                    p.active
                      ? 'bg-zinc-900 text-white border-zinc-900 font-bold'
                      : 'bg-zinc-100 text-zinc-600 border-zinc-200 group-hover:border-zinc-300'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors">
                        {p.name}
                      </p>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 border border-zinc-200 text-zinc-600 font-medium">
                        {p.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-snug line-clamp-1">
                      {p.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
