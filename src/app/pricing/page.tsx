'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles, Zap, Shield, ArrowRight, HelpCircle } from 'lucide-react';

interface Plan {
  code: string;
  name: string;
  price: number;
  period: string;
  description: string;
  popular?: boolean;
  features: string[];
  limits: {
    searches: string;
    tokens: string;
    products: string;
    docs: string;
    seats: string;
  };
}

const PLANS: Plan[] = [
  {
    code: 'free',
    name: 'Free Tier',
    price: 0,
    period: '/mo',
    description: 'Perfect for exploring conversational search and hobby storefronts.',
    features: [
      '1,000 AI Searches & Chats / mo',
      '100k LLM Tokens Included',
      'Up to 50 Catalog Products',
      '2 Store Policy Documents',
      '1 Team Seat',
      'Community Support',
    ],
    limits: {
      searches: '1,000 / mo',
      tokens: '100,000 / mo',
      products: '50 products',
      docs: '2 documents',
      seats: '1 seat',
    },
  },
  {
    code: 'starter',
    name: 'Starter',
    price: 1999,
    period: '/mo',
    popular: true,
    description: 'For growing e-commerce merchants ready to increase conversion with AI.',
    features: [
      '10,000 AI Searches & Chats / mo',
      '1,000,000 LLM Tokens Included',
      'Up to 500 Catalog Products',
      '10 Store Policy Documents',
      'Shopify & WooCommerce Auto-Sync',
      '3 Team Seats (Admin & Editor)',
      'Embeddable Storefront Widget',
      'Standard Email & Chat Support',
    ],
    limits: {
      searches: '10,000 / mo',
      tokens: '1,000,000 / mo',
      products: '500 products',
      docs: '10 documents',
      seats: '3 seats',
    },
  },
  {
    code: 'pro',
    name: 'Pro Growth',
    price: 7999,
    period: '/mo',
    description: 'High-volume merchants requiring multi-lingual search and custom models.',
    features: [
      '50,000 AI Searches & Chats / mo',
      '5,000,000 LLM Tokens Included',
      'Up to 2,500 Catalog Products',
      '50 Knowledge Documents',
      'Scheduled Hourly Crawlers',
      '10 Team Seats with RBAC',
      'Custom LLM Instructions & Prompts',
      'Priority Support (24h SLA)',
    ],
    limits: {
      searches: '50,000 / mo',
      tokens: '5,000,000 / mo',
      products: '2,500 products',
      docs: '50 documents',
      seats: '10 seats',
    },
  },
  {
    code: 'enterprise',
    name: 'Enterprise Scale',
    price: 24999,
    period: '/mo',
    description: 'Dedicated infrastructure, custom SLAs, and high token throughput.',
    features: [
      '500,000 AI Searches & Chats / mo',
      '50,000,000 LLM Tokens Included',
      'Up to 25,000 Catalog Products',
      '500 Knowledge Documents',
      'Real-time Webhook Ingestion',
      '50 Team Seats & SSO Integration',
      'Dedicated Account Manager',
      '99.9% Uptime Guarantee',
    ],
    limits: {
      searches: '500,000 / mo',
      tokens: '50,000,000 / mo',
      products: '25,000 products',
      docs: '500 documents',
      seats: '50 seats',
    },
  },
];

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Navigation */}
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-extrabold text-base tracking-tight text-zinc-900">ShopMate AaaS</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold">
              PRICING
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="text-xs font-semibold text-zinc-700 hover:text-zinc-950 transition"
            >
              Log in
            </Link>
            <Link
              href="/auth/signup"
              className="text-xs font-semibold bg-zinc-900 text-white px-4 py-2 rounded-lg hover:bg-zinc-800 transition shadow-xs"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          14-Day Full Feature Free Trial Included
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-zinc-950 tracking-tight leading-tight">
          Transparent, Predictable Pricing for AI-Powered Commerce
        </h1>
        <p className="mt-4 text-base text-zinc-600 max-w-2xl mx-auto">
          Scale from your first AI search query to millions of automated recommendations. No hidden setup fees or surprise overages.
        </p>

        {/* Billing Interval Toggle */}
        <div className="mt-10 flex items-center justify-center gap-3">
          <span className={`text-xs font-medium ${billingCycle === 'monthly' ? 'text-zinc-950 font-bold' : 'text-zinc-500'}`}>
            Monthly Billing
          </span>
          <button
            onClick={() => setBillingCycle(b => (b === 'monthly' ? 'yearly' : 'monthly'))}
            className="w-12 h-6 rounded-full bg-zinc-200 p-0.5 transition flex items-center cursor-pointer"
            aria-label="Toggle annual billing"
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition ${
                billingCycle === 'yearly' ? 'translate-x-6 bg-indigo-600' : 'translate-x-0'
              }`}
            />
          </button>
          <span className={`text-xs font-medium flex items-center gap-1.5 ${billingCycle === 'yearly' ? 'text-zinc-950 font-bold' : 'text-zinc-500'}`}>
            Annual Billing <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">Save 20%</span>
          </span>
        </div>
      </section>

      {/* Pricing Cards Grid */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => {
            const finalPrice = billingCycle === 'yearly' && plan.price > 0 ? Math.round(plan.price * 0.8) : plan.price;
            return (
              <div
                key={plan.code}
                className={`relative rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 ${
                  plan.popular
                    ? 'bg-white border-2 border-indigo-600 shadow-xl shadow-indigo-100/50 ring-4 ring-indigo-50'
                    : 'bg-white border border-zinc-200/90 shadow-xs hover:border-zinc-300'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-xs">
                    Most Popular
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-bold text-zinc-950">{plan.name}</h3>
                  <p className="mt-1 text-xs text-zinc-500 min-h-[36px]">{plan.description}</p>

                  <div className="mt-5 mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-zinc-950">
                        {finalPrice === 0 ? '₹0' : `₹${finalPrice.toLocaleString('en-IN')}`}
                      </span>
                      <span className="text-xs text-zinc-500 font-medium">{plan.period}</span>
                    </div>
                    {billingCycle === 'yearly' && plan.price > 0 && (
                      <p className="text-[11px] text-emerald-600 font-medium mt-1">Billed annually (₹{(finalPrice * 12).toLocaleString('en-IN')}/yr)</p>
                    )}
                  </div>

                  <Link
                    href={`/auth/signup?plan=${plan.code}`}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      plan.popular
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
                        : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
                    }`}
                  >
                    <span>{plan.price === 0 ? 'Get Started' : 'Start 14-Day Trial'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <div className="mt-6 pt-6 border-t border-zinc-100 space-y-3">
                    <p className="text-[11px] font-bold text-zinc-900 uppercase tracking-wider">Features Included:</p>
                    {plan.features.map((feat, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-zinc-600">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-100 text-[11px] text-zinc-500 space-y-1 bg-zinc-50/50 p-3 rounded-lg">
                  <div className="flex justify-between">
                    <span>Products:</span>
                    <span className="font-semibold text-zinc-700">{plan.limits.products}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Token Quota:</span>
                    <span className="font-semibold text-zinc-700">{plan.limits.tokens}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Seats:</span>
                    <span className="font-semibold text-zinc-700">{plan.limits.seats}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Security & FAQ */}
      <section className="bg-white border-t border-zinc-200 py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-zinc-950">Frequently Asked Questions</h2>
            <p className="text-xs text-zinc-500 mt-1">Everything you need to know about billing, payments, and trial terms.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-zinc-600">
            <div className="bg-zinc-50 p-5 rounded-xl border border-zinc-200/80">
              <h4 className="font-bold text-zinc-900 text-sm mb-2">What payment methods are supported?</h4>
              <p>We process payments securely via Razorpay. All major Indian and International Credit/Debit Cards, UPI (Google Pay, PhonePe, Paytm), NetBanking, and recurring mandate subscriptions are supported.</p>
            </div>

            <div className="bg-zinc-50 p-5 rounded-xl border border-zinc-200/80">
              <h4 className="font-bold text-zinc-900 text-sm mb-2">Can I cancel my subscription at any time?</h4>
              <p>Yes. You can cancel with one click in your billing dashboard. Your access will remain active until the end of your prepaid billing period with no penalty fees.</p>
            </div>

            <div className="bg-zinc-50 p-5 rounded-xl border border-zinc-200/80">
              <h4 className="font-bold text-zinc-900 text-sm mb-2">What happens when I hit my monthly search quota?</h4>
              <p>Your search widget will smoothly inform you and allow a grace period or immediate self-serve upgrade. We never unexpectedly shut down customer storefront access.</p>
            </div>

            <div className="bg-zinc-50 p-5 rounded-xl border border-zinc-200/80">
              <h4 className="font-bold text-zinc-900 text-sm mb-2">Is my store data isolated?</h4>
              <p>Completely. ShopMate AaaS uses strict PostgreSQL Row-Level Security (RLS) and cryptographic tenant separation ensuring Tenant A can never read or query Tenant B data.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
