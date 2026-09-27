'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import { FileText, Shield, Clock, Search, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

interface AuditLogItem {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  actor_email?: string;
  ip_address?: string;
  created_at: string;
}

export default function AuditLogsSettingsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    async function loadLogs() {
      try {
        const res = await fetch('/api/audit-logs');
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
        }
      } catch (e) {
        console.error('Failed to load audit logs', e);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, []);

  const filteredLogs = logs.filter(l => 
    !filter || 
    l.action.toLowerCase().includes(filter.toLowerCase()) || 
    l.resource_type.toLowerCase().includes(filter.toLowerCase()) ||
    (l.actor_email && l.actor_email.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="flex h-screen bg-[#f4f5f7] text-zinc-900 font-sans antialiased selection:bg-zinc-200 selection:text-zinc-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-zinc-700" />
                Immutable Audit Trails
              </h1>
              <p className="text-xs text-zinc-500 mt-1">
                Full compliance record of administrative actions, config changes, and role assignments.
              </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 border-b border-zinc-200 pb-2 overflow-x-auto">
              <Link href="/settings" className="px-3 py-1.5 text-xs font-semibold rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition whitespace-nowrap">
                General
              </Link>
              <Link href="/billing" className="px-3 py-1.5 text-xs font-semibold rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition whitespace-nowrap">
                Billing &amp; Quotas
              </Link>
              <Link href="/api-keys" className="px-3 py-1.5 text-xs font-semibold rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition whitespace-nowrap">
                API Keys
              </Link>
              <Link href="/team" className="px-3 py-1.5 text-xs font-semibold rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition whitespace-nowrap">
                Team Members
              </Link>
              <Link href="/security" className="px-3 py-1.5 text-xs font-semibold rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition whitespace-nowrap">
                Security &amp; RBAC
              </Link>
              <Link href="/settings/audit-logs" className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white text-zinc-900 shadow-2xs border border-zinc-200 whitespace-nowrap">
                Audit Logs
              </Link>
            </div>

            {/* Search / Filter */}
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                placeholder="Filter by action, resource, or actor..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded-xl pl-10 pr-4 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 font-mono shadow-2xs"
              />
            </div>

            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden divide-y divide-zinc-100 shadow-2xs">
              <div className="p-3.5 bg-zinc-50 text-[11px] font-mono text-zinc-500 font-semibold grid grid-cols-12">
                <span className="col-span-3">ACTION</span>
                <span className="col-span-4">TARGET RESOURCE</span>
                <span className="col-span-3">INITIATED BY</span>
                <span className="col-span-2 text-right">TIMESTAMP</span>
              </div>

              {loading ? (
                <div className="p-8 text-center text-xs text-zinc-500 font-mono flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading audit trail...</span>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500 font-mono">
                  No audit log records found for this workspace.
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.id} className="p-3.5 text-xs grid grid-cols-12 items-center hover:bg-zinc-50 transition">
                    <span className="col-span-3 font-mono font-bold text-zinc-900 text-[11px]">{log.action}</span>
                    <span className="col-span-4 text-zinc-700 font-medium truncate">{log.resource_type}: {log.resource_id}</span>
                    <span className="col-span-3 text-zinc-500 font-mono text-[11px] truncate">{log.actor_email || 'System'}</span>
                    <span className="col-span-2 text-right text-zinc-400 font-mono text-[11px]">{formatDate(log.created_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}