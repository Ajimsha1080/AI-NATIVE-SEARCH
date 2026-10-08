'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Bot, Mail, ArrowRight, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch (err) {
      console.error('Password reset request error:', err);
    }
    setSubmitted(true);
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
        <h2 className="text-base font-semibold text-zinc-900 pt-2">Reset your password</h2>
        <p className="text-xs text-zinc-500">Enter your email and we will send you a reset link</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white border border-zinc-200 py-8 px-6 shadow-sm rounded-2xl sm:px-10 space-y-6">
          {submitted ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-900">Reset Link Dispatched</h3>
              <p className="text-xs text-zinc-500">
                If an account exists for <strong className="text-zinc-800">{email}</strong>, you will receive password reset instructions shortly.
              </p>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700 hover:text-zinc-900 pt-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                Send Reset Link <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="text-center pt-2">
                <Link href="/auth/login" className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center justify-center gap-1 font-medium">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
