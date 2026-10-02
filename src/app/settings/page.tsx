'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import { 
  Settings, Users, Shield, FileText, Save, CheckCircle2, RefreshCw 
} from 'lucide-react';
import Link from 'next/link';
import { fetchWithCache, getClientCachedData } from '@/lib/client-cache';

export default function SettingsWorkspacePage() {
  const cachedSettings = getClientCachedData('/api/settings');
  const [workspaceName, setWorkspaceName] = useState(() => cachedSettings?.workspace?.name || 'Ajimsha M');
  const [defaultCurrency, setDefaultCurrency] = useState(() => cachedSettings?.workspace?.currency || 'INR');
  const [timezone, setTimezone] = useState(() => cachedSettings?.workspace?.timezone || 'Asia/Kolkata');
  const [loading, setLoading] = useState(!cachedSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await fetchWithCache('/api/settings');
        if (data?.workspace) {
          setWorkspaceName(data.workspace.name || 'Ajimsha M');
          setDefaultCurrency(data.workspace.currency || 'INR');
          setTimezone(data.workspace.timezone || 'Asia/Kolkata');
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workspaceName,
          currency: defaultCurrency,
          timezone: timezone
        })
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-screen bg-[#f4f5f7] text-zinc-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f4f5f7]">
        <Navbar />

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="border-b border-zinc-200 pb-4">
              <h1 className="text-lg font-bold tracking-tight text-zinc-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-zinc-700" />
                Workspace Settings
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                Configure tenant metadata, team member roles, security policies, and audit logs.
              </p>
            </div>


            {saved && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 font-mono shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Workspace configuration saved and persisted successfully.
              </div>
            )}

            <form onSubmit={handleSave} className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-xs">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Workspace Name</label>
                <input
                  type="text"
                  required
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Default Currency</label>
                  <select
                    value={defaultCurrency}
                    onChange={(e) => setDefaultCurrency(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:bg-white"
                  >
                    <option value="INR">INR (₹) - Indian Rupee</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="AUD">AUD ($)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Store Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:bg-white"
                  >
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                    <option value="America/Chicago">America/Chicago (CST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Europe/Paris">Europe/Paris (CET)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-[#18181b] hover:bg-[#27272a] text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
}