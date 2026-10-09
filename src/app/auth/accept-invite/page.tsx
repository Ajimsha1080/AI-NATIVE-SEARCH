'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, ArrowRight, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Missing invitation token.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/v1/team/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, name, password: password || undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to accept invitation.');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/ai-mode');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'An error occurred while accepting the invitation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md">
            <Users className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-zinc-950">ShopMate AaaS</span>
        </Link>
        <h2 className="text-2xl font-black tracking-tight text-zinc-900">
          Accept Team Invitation
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Join your store&apos;s team to manage AI search, product catalogs, and policies.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl border border-zinc-200/90 shadow-xl space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Invitation accepted! Redirecting to your dashboard...</span>
            </div>
          )}

          {!token ? (
            <div className="text-center py-6 text-xs text-zinc-500">
              <p>Invalid or missing invite link. Please check the email you received.</p>
              <Link href="/auth/login" className="mt-4 inline-block font-bold text-indigo-600">
                Return to Login &rarr;
              </Link>
            </div>
          ) : (
            <form onSubmit={handleAccept} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Alex Morgan"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Choose a Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters (if new user)"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  Leave blank if you already have an existing verified account.
                </span>
              </div>

              <button
                type="submit"
                disabled={loading || success}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {loading ? 'Joining workspace...' : 'Accept Invitation & Enter Store'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          <div className="pt-4 border-t border-zinc-100 text-center">
            <span className="text-xs text-zinc-500">Already signed in? </span>
            <Link href="/ai-mode" className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
              Open Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-zinc-400">Loading invite...</div>}>
      <AcceptInviteContent />
    </Suspense>
  );
}
