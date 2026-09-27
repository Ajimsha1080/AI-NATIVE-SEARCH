'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import { Users, Plus, Shield, Mail, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Member {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

export default function MembersSettingsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('EDITOR');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = async () => {
    try {
      const res = await fetch('/api/settings/members');
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch (e) {
      console.error('Failed to load members', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    setError(null);
    setInviting(true);

    try {
      const res = await fetch('/api/settings/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to send invite');
      }
      setInviteEmail('');
      loadMembers();
    } catch (err: any) {
      setError(err.message || 'Invitation failed');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      const res = await fetch(`/api/settings/members?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadMembers();
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Failed to remove member');
      }
    } catch (e) {
      alert('Error removing member');
    }
  }

  return (
    <div className="flex h-screen bg-[#f4f5f7] text-zinc-900 font-sans antialiased selection:bg-zinc-200 selection:text-zinc-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2.5">
                <Users className="w-5 h-5 text-zinc-700" />
                Team Members &amp; Access
              </h1>
              <p className="text-xs text-zinc-500 mt-1">
                Collaborate with store operators, developers, and support agents with role-based permissions.
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
              <Link href="/team" className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white text-zinc-900 shadow-2xs border border-zinc-200 whitespace-nowrap">
                Team Members
              </Link>
              <Link href="/security" className="px-3 py-1.5 text-xs font-semibold rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition whitespace-nowrap">
                Security &amp; RBAC
              </Link>
              <Link href="/settings/audit-logs" className="px-3 py-1.5 text-xs font-semibold rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition whitespace-nowrap">
                Audit Logs
              </Link>
            </div>

            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {error}
              </div>
            )}

            {/* Invite Form */}
            <form onSubmit={handleInvite} className="bg-white border border-zinc-200 rounded-2xl p-5 flex items-end gap-3 shadow-2xs">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Invite by Email</label>
                <input
                  type="email"
                  required
                  placeholder="colleague@yourbrand.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-400"
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="EDITOR">EDITOR</option>
                  <option value="VIEWER">VIEWER</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={inviting}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition flex items-center gap-1.5 shrink-0 disabled:opacity-50 shadow-xs cursor-pointer"
              >
                {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Send Invite
              </button>
            </form>

            {/* Member List */}
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden divide-y divide-zinc-100 shadow-2xs">
              {loading ? (
                <div className="p-8 text-center text-xs text-zinc-500 font-mono flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading team members...</span>
                </div>
              ) : members.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500 font-mono">
                  No team members registered.
                </div>
              ) : (
                members.map((m) => (
                  <div key={m.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-800 flex items-center justify-center font-bold text-xs shadow-2xs">
                        {m.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-900">{m.name}</p>
                        <p className="text-[11px] text-zinc-500 font-mono">{m.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-700 font-semibold">
                        {m.role}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-700 font-bold">{m.status}</span>
                      {m.role !== 'OWNER' && (
                        <button
                          onClick={() => handleRemove(m.id)}
                          className="p-1 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-zinc-100 transition"
                          title="Remove member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
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