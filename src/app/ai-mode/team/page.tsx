'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Shield, ShieldCheck, Mail, Trash2, 
  RefreshCw, CheckCircle2, AlertCircle, X, ArrowRight, UserCheck
} from 'lucide-react';

interface Member {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  joined_at: string | null;
  is_current_user: boolean;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  is_expired: boolean;
}

export default function TeamManagementPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedTargetUser, setSelectedTargetUser] = useState('');
  
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'EDITOR' | 'VIEWER'>('EDITOR');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      const [membersRes, invitesRes] = await Promise.all([
        fetch('/api/v1/team/members', { credentials: 'include' }),
        fetch('/api/v1/team/invites', { credentials: 'include' }),
      ]);

      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members || []);
      }
      if (invitesRes.ok) {
        const data = await invitesRes.json();
        setInvites(data.invites || []);
      }
    } catch (err) {
      console.error('Failed to load team data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, []);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await fetch('/api/v1/team/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail?.message || data.detail || 'Failed to send invite');
      }

      setFeedback({ text: `Invitation sent to ${inviteEmail}`, type: 'success' });
      setInviteEmail('');
      setInviteModalOpen(false);
      fetchTeamData();
    } catch (err: any) {
      setFeedback({ text: err.message || 'Invitation failed', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm('Revoke this invitation? The recipient will not be able to use the link.')) return;
    try {
      const res = await fetch(`/api/v1/team/invites/${inviteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setFeedback({ text: 'Invitation revoked.', type: 'success' });
        fetchTeamData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/v1/team/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update role');
      }
      setFeedback({ text: 'Member role updated.', type: 'success' });
      fetchTeamData();
    } catch (err: any) {
      setFeedback({ text: err.message || 'Failed to update role', type: 'error' });
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this workspace?`)) return;
    try {
      const res = await fetch(`/api/v1/team/members/${memberId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to remove member');
      }
      setFeedback({ text: 'Member removed from workspace.', type: 'success' });
      fetchTeamData();
    } catch (err: any) {
      setFeedback({ text: err.message || 'Failed to remove member', type: 'error' });
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedTargetUser) return;
    if (!confirm('Transfer primary ownership of this workspace? You will be demoted to Admin.')) return;
    try {
      setActionLoading(true);
      const res = await fetch('/api/v1/team/transfer-ownership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ target_user_id: selectedTargetUser }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to transfer ownership');
      }
      setFeedback({ text: 'Workspace ownership transferred successfully.', type: 'success' });
      setTransferModalOpen(false);
      fetchTeamData();
    } catch (err: any) {
      setFeedback({ text: err.message || 'Ownership transfer failed', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const currentUser = members.find(m => m.is_current_user);
  const isOwner = currentUser?.role === 'OWNER';
  const isAdminOrOwner = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-950 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Team &amp; Access Controls
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Manage teammates, granular RBAC permissions, and workspace ownership.
          </p>
        </div>

        {isAdminOrOwner && (
          <div className="flex items-center gap-2">
            {isOwner && (
              <button
                onClick={() => setTransferModalOpen(true)}
                className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Transfer Ownership
              </button>
            )}
            <button
              onClick={() => setInviteModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Invite Teammate
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      {feedback && (
        <div className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="cursor-pointer text-zinc-400 hover:text-zinc-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Members Table */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
            Workspace Members ({members.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-500 font-semibold border-b border-zinc-200">
              <tr>
                <th className="py-2.5 px-4">Member</th>
                <th className="py-2.5 px-4">Email</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Joined</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-zinc-50/50">
                  <td className="py-3 px-4 font-bold text-zinc-900 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <span>{m.name}</span>
                    {m.is_current_user && (
                      <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.2 rounded font-mono">You</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-zinc-600 font-mono text-[11px]">{m.email}</td>
                  <td className="py-3 px-4">
                    {isAdminOrOwner && !m.is_current_user && m.role !== 'OWNER' ? (
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value)}
                        className="px-2 py-1 text-[11px] font-bold rounded-md border border-zinc-200 bg-white"
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="EDITOR">EDITOR</option>
                        <option value="VIEWER">VIEWER</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        m.role === 'OWNER' ? 'bg-amber-100 text-amber-800' :
                        m.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-800' :
                        m.role === 'EDITOR' ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-700'
                      }`}>
                        {m.role}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-zinc-500">
                    {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {isAdminOrOwner && !m.is_current_user && m.role !== 'OWNER' && (
                      <button
                        onClick={() => handleRemoveMember(m.id, m.name)}
                        className="p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invitations Section */}
      {invites.length > 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100">
            <h2 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
              Pending Invitations ({invites.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500 font-semibold border-b border-zinc-200">
                <tr>
                  <th className="py-2.5 px-4">Invited Email</th>
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4">Expires</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {invites.map((inv) => (
                  <tr key={inv.id} className="hover:bg-zinc-50/50">
                    <td className="py-3 px-4 font-mono text-[11px] text-zinc-800">{inv.email}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-700">
                        {inv.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-500">
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleRevokeInvite(inv.id)}
                        className="text-xs text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                Invite Team Member
              </h3>
              <button onClick={() => setInviteModalOpen(false)} className="cursor-pointer text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Role &amp; Permissions
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 bg-white"
                >
                  <option value="VIEWER">VIEWER (Read-only search, catalog &amp; orders)</option>
                  <option value="EDITOR">EDITOR (Add/update products and store knowledge)</option>
                  <option value="ADMIN">ADMIN (Full access + billing &amp; teammate invites)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
                >
                  {actionLoading ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {transferModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                Transfer Workspace Ownership
              </h3>
              <button onClick={() => setTransferModalOpen(false)} className="cursor-pointer text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-600">
              Select an existing teammate to become the new primary owner. You will retain Admin access to this workspace.
            </p>

            <div className="space-y-3">
              <select
                value={selectedTargetUser}
                onChange={(e) => setSelectedTargetUser(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 bg-white"
              >
                <option value="">Select a teammate...</option>
                {members.filter(m => !m.is_current_user).map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name} ({m.email}) — {m.role}
                  </option>
                ))}
              </select>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setTransferModalOpen(false)}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransferOwnership}
                  disabled={!selectedTargetUser || actionLoading}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Transferring...' : 'Confirm Ownership Transfer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
