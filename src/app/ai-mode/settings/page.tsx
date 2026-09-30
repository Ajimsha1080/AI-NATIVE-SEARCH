'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, Save, RefreshCw, Check, 
  Sparkles, Sliders, ShieldCheck, Database, Bot
} from 'lucide-react';
import { AiModeConfig } from '@/ai-mode/types';

export default function AiModeSettingsPage() {
  const [config, setConfig] = useState<AiModeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch('/api/ai-mode/config');
        if (res.ok) {
          const data = await res.json();
          setConfig(data.config);
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config || isSaving) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/ai-mode/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error('Save error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!config) {
    return <div className="text-center p-8 text-zinc-500">Failed to load AI Mode configuration.</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">AI Mode Settings</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Configure feature flags, reasoning models, search confidence thresholds, and system prompts.
          </p>
        </div>

        {saveSuccess && (
          <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Settings saved
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Feature Flag */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-zinc-900">AI Mode Global Master Switch</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Enable or disable AI Mode for your store. When disabled, existing search and features continue running normally.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfig({ ...config, enabled: !config.enabled })}
              className={`w-12 h-6 rounded-full transition p-0.5 cursor-pointer ${
                config.enabled ? 'bg-indigo-600' : 'bg-zinc-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition transform ${
                config.enabled ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>

        {/* Model & Search Hyperparameters */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
            <Bot className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-xs text-zinc-900 uppercase tracking-wider">Model & Reasoning Parameters</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Reasoning Model</label>
              <select
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="gemini-1.5-pro">Google Gemini 1.5 Pro (Enterprise)</option>
                <option value="gemini-1.5-flash">Google Gemini 1.5 Flash (Ultra-Fast)</option>
                <option value="gpt-4o">OpenAI GPT-4o (Omni)</option>
                <option value="claude-3-5-sonnet">Anthropic Claude 3.5 Sonnet</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">
                Temperature ({config.temperature})
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.temperature}
                onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                className="w-full mt-2 accent-indigo-600"
              />
              <span className="text-[10px] text-zinc-400">Lower values produce more deterministic responses</span>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-zinc-700 mb-1">
                Retrieval Confidence Threshold ({Math.round(config.confidence_threshold * 100)}%)
              </label>
              <input
                type="range"
                min="0.3"
                max="0.95"
                step="0.05"
                value={config.confidence_threshold}
                onChange={(e) => setConfig({ ...config, confidence_threshold: parseFloat(e.target.value) })}
                className="w-full mt-2 accent-indigo-600"
              />
              <span className="text-[10px] text-zinc-400">
                Minimum hybrid score required before candidate validation and zero-result fallback triggers
              </span>
            </div>
          </div>
        </div>

        {/* Feature Capabilities */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-xs text-zinc-900 uppercase tracking-wider">AI Mode Capabilities</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-zinc-900 block">Product Comparison Engine</span>
                <span className="text-[11px] text-zinc-500">Allow AI Mode to generate side-by-side spec comparisons without hallucination</span>
              </div>
              <input
                type="checkbox"
                checked={config.enable_comparisons}
                onChange={(e) => setConfig({ ...config, enable_comparisons: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-zinc-900 block">Dynamic Recommendations</span>
                <span className="text-[11px] text-zinc-500">Suggest contextually complementary items based on conversation state</span>
              </div>
              <input
                type="checkbox"
                checked={config.enable_recommendations}
                onChange={(e) => setConfig({ ...config, enable_recommendations: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-zinc-900 block">Cart & Checkout Integration</span>
                <span className="text-[11px] text-zinc-500">Allow customers to add items to their shopping cart via conversational prompts</span>
              </div>
              <input
                type="checkbox"
                checked={config.enable_cart_actions}
                onChange={(e) => setConfig({ ...config, enable_cart_actions: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* System Prompt Customization */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-xs text-zinc-900 uppercase tracking-wider">Custom System Instructions</h3>
          </div>

          <div className="text-xs space-y-2">
            <textarea
              rows={4}
              value={config.system_instructions || ''}
              onChange={(e) => setConfig({ ...config, system_instructions: e.target.value })}
              placeholder="e.g. Always be friendly, highlight eco-friendly materials, and offer gift recommendations during holidays..."
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs text-zinc-900 font-sans focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-zinc-400">
              Custom instructions will guide the tone, persona, and shopping recommendations of AI Mode.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save AI Mode Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
}
