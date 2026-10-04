'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Sliders, 
  Sparkles, 
  Check, 
  RefreshCw, 
  ShieldCheck,
  Bot
} from 'lucide-react';
import { AIModeConfig } from '@/ai-mode/types';

export default function AIModeSettingsPage() {
  const [config, setConfig] = useState<AIModeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/ai-mode/config')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.config) setConfig(data.config);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    setSavedSuccess(false);

    try {
      const res = await fetch('/api/ai-mode/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !config) {
    return (
      <div className="p-8 text-center text-zinc-500 text-xs">Loading AI Mode settings...</div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 tracking-tight">AI Mode Engine Settings</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Configure model provider, temperature parameters, and conversational capability toggles.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Capability Toggles */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
            <h3 className="text-xs font-bold text-zinc-900">Conversational Capabilities</h3>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100/80 transition cursor-pointer">
              <div>
                <span className="text-xs font-bold text-zinc-900 block">AI Product Recommendations</span>
                <span className="text-[11px] text-zinc-500 block">Allow AI Mode to dynamically recommend top picks for vague queries</span>
              </div>
              <input
                type="checkbox"
                checked={config.enable_recommendations}
                onChange={e => setConfig({ ...config, enable_recommendations: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100/80 transition cursor-pointer">
              <div>
                <span className="text-xs font-bold text-zinc-900 block">Side-by-Side Product Comparisons</span>
                <span className="text-[11px] text-zinc-500 block">Enable automatic price and feature comparison cards when customer asks "which is better"</span>
              </div>
              <input
                type="checkbox"
                checked={config.enable_comparisons}
                onChange={e => setConfig({ ...config, enable_comparisons: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100/80 transition cursor-pointer">
              <div>
                <span className="text-xs font-bold text-zinc-900 block">Shopping Bag Actions</span>
                <span className="text-[11px] text-zinc-500 block">Allow AI to directly add products to cart when customer asks "add the second one"</span>
              </div>
              <input
                type="checkbox"
                checked={config.enable_cart_actions}
                onChange={e => setConfig({ ...config, enable_cart_actions: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Model Tuning */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
            <Sliders className="w-4 h-4 text-violet-600" />
            <h3 className="text-xs font-bold text-zinc-900">Retrieval &amp; Model Parameters</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">LLM Provider</label>
              <select
                value={config.model_provider}
                onChange={e => setConfig({ ...config, model_provider: e.target.value as any })}
                className="w-full bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
              >
                <option value="sarvam">Sarvam AI (105B Conversations)</option>
                <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                <option value="ollama">Ollama (Local LLM)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                {config.model_provider === 'sarvam' ? 'Sarvam AI Subscription Key' :
                 config.model_provider === 'openai' ? 'OpenAI API Key' :
                 config.model_provider === 'anthropic' ? 'Anthropic API Key' : 'API Key / Secret'}
              </label>
              <input
                type="password"
                placeholder={config.model_provider === 'sarvam' ? 'sk_... or paste Sarvam API Key' : 'Paste API Key'}
                value={config.api_key || ''}
                onChange={e => setConfig({ ...config, api_key: e.target.value })}
                className="w-full bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">Results Per Page ({config.max_search_results})</label>
              <input
                type="number"
                min={2}
                max={20}
                value={config.max_search_results}
                onChange={e => setConfig({ ...config, max_search_results: parseInt(e.target.value) || 6 })}
                className="w-full bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3">
          {savedSuccess && (
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <Check className="w-4 h-4" /> Settings Saved!
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-[0.98]"
          >
            {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
}
