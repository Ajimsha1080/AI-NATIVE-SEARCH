'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showDemoCredentials = process.env.NEXT_PUBLIC_SHOW_DEMO_CREDS === 'true' || process.env.NODE_ENV !== 'production';

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.error || 'Invalid credentials');
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  const selectDemoAccount = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-zinc-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-black shadow-xs">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-zinc-900 tracking-tight">ShopMate AaaS</span>
        </Link>
        <h2 className="text-base font-semibold text-zinc-900 pt-2">Sign in to your store workspace</h2>
        <p className="text-xs text-zinc-500">Manage autonomous AI e-commerce agents and live catalogs</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white border border-zinc-200 py-8 px-6 shadow-sm rounded-2xl sm:px-10 space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="merchant@yourstore.com"
                  className="w-full bg-white border border-zinc-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-zinc-700">Password</label>
                <Link href="/auth/forgot-password" className="text-xs text-zinc-500 hover:text-zinc-900 transition font-medium">
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-white border border-zinc-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              {loading ? 'Authenticating...' : 'Sign In'} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Dev-Only Demo Logins */}
          {showDemoCredentials && (
            <div className="pt-4 border-t border-zinc-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">1-Click Quick Fill:</span>
                <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded font-semibold">Instant Access</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => selectDemoAccount('merchant@shopmate.com', 'password123')}
                  className={`p-3 rounded-xl border text-left transition ${
                    email === 'merchant@shopmate.com'
                      ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-400 shadow-2xs'
                      : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-xs text-zinc-900">Store Merchant</p>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  </div>
                  <p className="text-zinc-500 text-[10px] font-mono mt-0.5 truncate">merchant@shopmate.com</p>
                  <p className="text-[9px] text-zinc-400 font-mono mt-0.5">Role: Store Owner</p>
                </button>
                <button
                  type="button"
                  onClick={() => selectDemoAccount('admin@aaas-platform.com', 'admin123')}
                  className={`p-3 rounded-xl border text-left transition ${
                    email === 'admin@aaas-platform.com'
                      ? 'bg-red-50/70 border-red-300 ring-1 ring-red-400 shadow-2xs'
                      : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-xs text-zinc-900">SuperAdmin</p>
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  </div>
                  <p className="text-zinc-500 text-[10px] font-mono mt-0.5 truncate">admin@aaas-platform.com</p>
                  <p className="text-[9px] text-red-500 font-mono mt-0.5">Role: Root Admin</p>
                </button>
              </div>
            </div>
          )}

          <div className="text-center text-xs text-zinc-500">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-zinc-900 font-semibold hover:underline">
              Create a workspace
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
