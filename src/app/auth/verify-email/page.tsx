'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Bot, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Verification token is missing from the URL.');
      setLoading(false);
      return;
    }

    async function verify() {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || data.message || 'Verification failed');
        }

        setSuccess(true);
      } catch (err: any) {
        setError(err.message || 'Verification link is invalid or expired.');
      } finally {
        setLoading(false);
      }
    }

    verify();
  }, [token]);

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-zinc-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-black shadow-xs">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-zinc-900 tracking-tight">ShopMate AaaS</span>
        </Link>
        <h2 className="text-base font-semibold text-zinc-900 pt-2">Email Verification</h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white border border-zinc-200 py-8 px-6 shadow-sm rounded-2xl sm:px-10 text-center space-y-4">
          {loading && (
            <div className="py-6 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
              <p className="text-xs text-zinc-500">Verifying your email address...</p>
            </div>
          )}

          {!loading && success && (
            <div className="py-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-900">Email Verified!</h3>
              <p className="text-xs text-zinc-500">
                Your email has been verified. Your merchant account is fully active.
              </p>
              <div className="pt-2">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-2 text-xs font-semibold bg-zinc-900 text-white px-4 py-2 rounded-xl hover:bg-zinc-800 transition"
                >
                  Proceed to Sign In <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="py-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-900">Verification Failed</h3>
              <p className="text-xs text-rose-600">{error}</p>
              <div className="pt-2">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 hover:text-zinc-900"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
