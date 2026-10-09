'use client';

import React, { useState, useEffect } from 'react';
import { 
  CreditCard, CheckCircle2, AlertTriangle, ArrowUpRight, 
  Receipt, ShieldCheck, Clock, Sparkles, RefreshCw, X, Check
} from 'lucide-react';

interface SubscriptionData {
  subscription: {
    id: string;
    workspace_id: string;
    plan_code: string;
    status: string;
    current_period_start: string | null;
    current_period_end: string | null;
    trial_end: string | null;
    days_left_in_trial: number;
    cancel_at_period_end: boolean;
    grace_period_end: string | null;
    provider: string;
    provider_subscription_id: string | null;
  };
  plan: {
    code: string;
    name: string;
    price: number;
    currency: string;
    interval: string;
    limits: {
      search_requests_per_month?: number;
      tokens_per_month?: number;
      products?: number;
      knowledge_docs?: number;
      seats?: number;
      llm_cost_cap_usd?: number;
    };
  } | null;
}

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  invoice_pdf_url: string | null;
  provider_invoice_id: string | null;
  paid_at: string | null;
  created_at: string | null;
}

interface PlanOption {
  code: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  description: string;
  limits: Record<string, any>;
}

export default function BillingDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [availablePlans, setAvailablePlans] = useState<PlanOption[]>([]);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const [subRes, invRes, plansRes] = await Promise.all([
        fetch('/api/v1/billing/subscription', { credentials: 'include' }),
        fetch('/api/v1/billing/invoices', { credentials: 'include' }),
        fetch('/api/v1/billing/plans', { credentials: 'include' }),
      ]);

      if (subRes.ok) {
        const subJson = await subRes.json();
        setData(subJson);
      }
      if (invRes.ok) {
        const invJson = await invRes.json();
        setInvoices(invJson.invoices || []);
      }
      if (plansRes.ok) {
        const plansJson = await plansRes.json();
        setAvailablePlans(plansJson.plans || []);
      }
    } catch (err) {
      console.error('Failed to load billing details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  const handleStartCheckout = async (planCode: string) => {
    try {
      setActionLoading(true);
      const res = await fetch('/api/v1/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan_code: planCode }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.detail || 'Checkout failed');
      }

      if (resData.checkout_url) {
        window.open(resData.checkout_url, '_blank');
        setFeedbackMessage({ text: 'Redirected to Razorpay secure checkout. Complete payment to activate your plan.', type: 'success' });
        setUpgradeModalOpen(false);
      } else {
        setFeedbackMessage({ text: `Subscription updated to ${planCode.toUpperCase()}`, type: 'success' });
        setUpgradeModalOpen(false);
        fetchBillingData();
      }
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || 'Payment initiation failed', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel? Your subscription will remain active until the end of your billing cycle.')) {
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch('/api/v1/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (res.ok) {
        setFeedbackMessage({ text: 'Subscription scheduled for cancellation at period end.', type: 'success' });
        fetchBillingData();
      } else {
        const errJson = await res.json();
        setFeedbackMessage({ text: errJson.detail || 'Cancellation failed', type: 'error' });
      }
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || 'Failed to cancel', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  const sub = data?.subscription;
  const currentPlan = data?.plan;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-950 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600" />
            Billing &amp; Subscriptions
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Manage your workspace subscription tier, quota limits, and billing history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUpgradeModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Upgrade Plan
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {feedbackMessage && (
        <div className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
          feedbackMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <span>{feedbackMessage.text}</span>
          <button onClick={() => setFeedbackMessage(null)} className="cursor-pointer text-zinc-400 hover:text-zinc-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Trial Alert */}
      {sub?.status === 'TRIALING' && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-amber-900 text-xs">
          <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">You are currently on a 14-day Free Trial</p>
            <p className="text-amber-800">
              Your trial ends in <strong>{sub.days_left_in_trial} days</strong> (on {sub.trial_end ? new Date(sub.trial_end).toLocaleDateString() : 'N/A'}).
              Upgrade before your trial concludes to keep your live storefront widget and background synchronization active without interruption.
            </p>
          </div>
        </div>
      )}

      {/* Grace Period Alert */}
      {sub?.status === 'PAST_DUE' && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3 text-rose-900 text-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Payment Overdue — Grace Period Active</p>
            <p className="text-rose-800">
              A recent subscription payment failed. Your workspace is within a grace period until {sub.grace_period_end ? new Date(sub.grace_period_end).toLocaleDateString() : 'soon'}. Please update your payment method to prevent storefront suspension.
            </p>
          </div>
        </div>
      )}

      {/* Current Plan Overview Card */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-100 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-extrabold tracking-wider text-zinc-500">Active Tier</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                sub?.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                sub?.status === 'TRIALING' ? 'bg-amber-100 text-amber-800' :
                sub?.status === 'PAST_DUE' ? 'bg-rose-100 text-rose-800' : 'bg-zinc-100 text-zinc-700'
              }`}>
                {sub?.status || 'UNKNOWN'}
              </span>
              {sub?.cancel_at_period_end && (
                <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-medium">
                  Cancels at period end
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black text-zinc-950 mt-1">{currentPlan?.name || 'Starter Plan'}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {currentPlan?.price === 0 ? 'Free' : `₹${currentPlan?.price?.toLocaleString('en-IN')}`} / {currentPlan?.interval || 'month'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setUpgradeModalOpen(true)}
              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-lg transition cursor-pointer"
            >
              Change Tier
            </button>
            {sub?.status === 'ACTIVE' && !sub?.cancel_at_period_end && (
              <button
                onClick={handleCancelSubscription}
                disabled={actionLoading}
                className="px-3 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Cancel Subscription
              </button>
            )}
          </div>
        </div>

        {/* Quota Limits Snapshot */}
        <div className="mt-6">
          <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-4">Included Plan Allowances</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200/70">
              <span className="text-[10px] text-zinc-500 block">AI Searches</span>
              <span className="text-sm font-bold text-zinc-900">
                {currentPlan?.limits?.search_requests_per_month?.toLocaleString('en-IN') || '10,000'} /mo
              </span>
            </div>
            <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200/70">
              <span className="text-[10px] text-zinc-500 block">LLM Tokens</span>
              <span className="text-sm font-bold text-zinc-900">
                {currentPlan?.limits?.tokens_per_month ? `${(currentPlan.limits.tokens_per_month / 1000000).toFixed(1)}M` : '1.0M'} /mo
              </span>
            </div>
            <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200/70">
              <span className="text-[10px] text-zinc-500 block">Catalog Products</span>
              <span className="text-sm font-bold text-zinc-900">
                {currentPlan?.limits?.products?.toLocaleString('en-IN') || '500'}
              </span>
            </div>
            <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200/70">
              <span className="text-[10px] text-zinc-500 block">Store Policies</span>
              <span className="text-sm font-bold text-zinc-900">
                {currentPlan?.limits?.knowledge_docs || '10'} docs
              </span>
            </div>
            <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200/70">
              <span className="text-[10px] text-zinc-500 block">Team Seats</span>
              <span className="text-sm font-bold text-zinc-900">
                {currentPlan?.limits?.seats || '3'} seats
              </span>
            </div>
            <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200/70">
              <span className="text-[10px] text-zinc-500 block">LLM Cost Cap</span>
              <span className="text-sm font-bold text-zinc-900">
                ${currentPlan?.limits?.llm_cost_cap_usd || '25'} /mo
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice History */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 shadow-xs">
        <h2 className="text-sm font-bold text-zinc-950 flex items-center gap-2 mb-4">
          <Receipt className="w-4 h-4 text-indigo-600" />
          Invoices &amp; Receipts
        </h2>

        {invoices.length === 0 ? (
          <div className="text-center py-8 text-zinc-400 text-xs">
            No invoices generated yet. Invoices appear here once payments are processed.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500 font-semibold border-b border-zinc-200">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Invoice ID</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-zinc-50/50">
                    <td className="py-2.5 px-3 font-medium text-zinc-800">
                      {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-zinc-600">{inv.id}</td>
                    <td className="py-2.5 px-3 font-bold text-zinc-900">
                      ₹{inv.amount.toLocaleString('en-IN')} {inv.currency}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {inv.invoice_pdf_url ? (
                        <a
                          href={inv.invoice_pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 font-bold inline-flex items-center gap-1"
                        >
                          View <ArrowUpRight className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-zinc-400">Paid via Razorpay</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upgrade / Change Plan Modal */}
      {upgradeModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-950">Select a Subscription Tier</h3>
                <p className="text-xs text-zinc-500">Pick the plan that suits your store&apos;s traffic and product volume.</p>
              </div>
              <button
                onClick={() => setUpgradeModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {availablePlans.filter(p => p.code !== 'free').map((plan) => {
                const isCurrent = sub?.plan_code === plan.code;
                return (
                  <div
                    key={plan.code}
                    className={`p-5 rounded-xl border flex flex-col justify-between ${
                      isCurrent ? 'border-indigo-600 bg-indigo-50/20 ring-2 ring-indigo-500/20' : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}
                  >
                    <div>
                      <h4 className="font-bold text-base text-zinc-950">{plan.name}</h4>
                      <p className="text-xs text-zinc-500 mt-1 min-h-[32px]">{plan.description}</p>
                      <div className="my-4">
                        <span className="text-2xl font-black text-zinc-950">₹{plan.price.toLocaleString('en-IN')}</span>
                        <span className="text-xs text-zinc-500"> /mo</span>
                      </div>
                      <div className="space-y-1.5 text-xs text-zinc-600 pt-3 border-t border-zinc-100">
                        <div className="flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{plan.limits?.search_requests_per_month?.toLocaleString('en-IN')} Searches /mo</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{plan.limits?.products?.toLocaleString('en-IN')} Products</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{plan.limits?.seats} Team Seats</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartCheckout(plan.code)}
                      disabled={isCurrent || actionLoading}
                      className={`mt-6 w-full py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                        isCurrent
                          ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                      }`}
                    >
                      {isCurrent ? 'Current Plan' : actionLoading ? 'Processing...' : 'Subscribe'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
