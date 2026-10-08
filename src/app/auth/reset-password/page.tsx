'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Bot, Lock, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Password reset token is missing from URL.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to reset password.');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Reset token is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-zinc-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-black shadow-xs">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-zinc-900 tracking-tight">ShopMate AaaS</span>
        </Link>
        <h2 className="text-base font-semibold text-zinc-900 pt-2">Set New Password</h2>
        <p className="text-xs text-zinc-500">Enter a secure new password for your account</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white border border-zinc-200 py-8 px-6 shadow-sm rounded-2xl sm:px-10 space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-900">Password Updated</h3>
              <p className="text-xs text-zinc-500">Your password has been reset successfully.</p>
              <div className="pt-2">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-2 text-xs font-semibold bg-zinc-900 text-white px-4 py-2 rounded-xl hover:bg-zinc-800 transition"
                >
                  Sign In <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">New Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full bg-white border border-zinc-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full bg-white border border-zinc-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
