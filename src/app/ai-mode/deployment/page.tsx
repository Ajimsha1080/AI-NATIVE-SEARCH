'use client';

import React, { useState, useEffect } from 'react';
import { 
  Globe, Code2, Copy, Check, ExternalLink, 
  ShieldCheck, Palette, Sparkles, RefreshCw, 
  Power, Save, Sliders, Eye
} from 'lucide-react';
import { AiModeDeployment } from '@/ai-mode/types';

export default function AiModeDeploymentPage() {
  const [deployments, setDeployments] = useState<AiModeDeployment[]>([]);
  const [activeDeployment, setActiveDeployment] = useState<AiModeDeployment | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedIframe, setCopiedIframe] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function fetchDeployments() {
      try {
        const res = await fetch('/api/ai-mode/deployments');
        if (res.ok) {
          const data = await res.json();
          setDeployments(data.deployments || []);
          if (data.deployments && data.deployments.length > 0) {
            setActiveDeployment(data.deployments[0]);
          }
        }
      } catch (e) {
        console.error('Failed to load deployments:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchDeployments();
  }, []);

  const handleSave = async () => {
    if (!activeDeployment || isSaving) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/ai-mode/deployments/${activeDeployment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeDeployment)
      });
      if (res.ok) {
        const data = await res.json();
        setActiveDeployment(data.deployment);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error('Save error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string, type: 'script' | 'iframe') => {
    navigator.clipboard.writeText(text);
    if (type === 'script') {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } else {
      setCopiedIframe(true);
      setTimeout(() => setCopiedIframe(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!activeDeployment) {
    return <div className="text-center p-8 text-zinc-500">No active deployment found.</div>;
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const scriptSnippet = `<!-- ShopMate AI Mode Standalone Widget -->\n<script\n  src="${origin}/api/ai-mode/widget/${activeDeployment.id}/script.js"\n  data-deployment-id="${activeDeployment.id}"\n  async\n></script>`;
  const iframeSnippet = `<iframe\n  src="${origin}/ai-mode/embed/${activeDeployment.id}"\n  width="420"\n  height="640"\n  frameborder="0"\n  style="border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);"\n></iframe>`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">AI Mode Widget Deployment</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Embed the dedicated AI-native shopping widget on your storefront without modifying existing apps.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Saved changes
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Customization & Security Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Status & Security */}
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <Power className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-xs text-zinc-900 uppercase tracking-wider">Deployment Status & Domain Security</h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                activeDeployment.status === 'LIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-zinc-100 text-zinc-600'
              }`}>
                {activeDeployment.status === 'LIVE' ? '● Live' : 'Paused'}
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-zinc-900 block">Widget Active State</span>
                  <span className="text-[11px] text-zinc-500">Allow customers to interact with AI Mode on your store</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDeployment({
                    ...activeDeployment,
                    status: activeDeployment.status === 'LIVE' ? 'PAUSED' : 'LIVE'
                  })}
                  className={`w-11 h-6 rounded-full transition p-0.5 cursor-pointer ${
                    activeDeployment.status === 'LIVE' ? 'bg-indigo-600' : 'bg-zinc-300'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition transform ${
                    activeDeployment.status === 'LIVE' ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div>
                <label className="block font-semibold text-zinc-900 mb-1">Allowed Domains / Origins</label>
                <input
                  type="text"
                  value={activeDeployment.allowed_domains.join(', ')}
                  onChange={(e) => setActiveDeployment({
                    ...activeDeployment,
                    allowed_domains: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  })}
                  placeholder="* (all domains) or store.com, mydomain.com"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs font-mono text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-zinc-400 mt-1">
                  Specify allowed website origins to prevent unauthorized widget embeds. Use <code className="text-indigo-600">*</code> for all origins.
                </p>
              </div>
            </div>
          </div>

          {/* Theme & Branding Customization */}
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
              <Palette className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-xs text-zinc-900 uppercase tracking-wider">Widget Customization & Styling</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activeDeployment.theme.primary_color}
                    onChange={(e) => setActiveDeployment({
                      ...activeDeployment,
                      theme: { ...activeDeployment.theme, primary_color: e.target.value }
                    })}
                    className="w-8 h-8 rounded-lg border border-zinc-200 p-0.5 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={activeDeployment.theme.primary_color}
                    onChange={(e) => setActiveDeployment({
                      ...activeDeployment,
                      theme: { ...activeDeployment.theme, primary_color: e.target.value }
                    })}
                    className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5 font-mono text-xs text-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Position</label>
                <select
                  value={activeDeployment.theme.position}
                  onChange={(e) => setActiveDeployment({
                    ...activeDeployment,
                    theme: { ...activeDeployment.theme, position: e.target.value as any }
                  })}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-hidden"
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-zinc-700 mb-1">Widget Title</label>
                <input
                  type="text"
                  value={activeDeployment.theme.widget_title}
                  onChange={(e) => setActiveDeployment({
                    ...activeDeployment,
                    theme: { ...activeDeployment.theme, widget_title: e.target.value }
                  })}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-zinc-700 mb-1">Launcher Button Text</label>
                <input
                  type="text"
                  value={activeDeployment.theme.launcher_text}
                  onChange={(e) => setActiveDeployment({
                    ...activeDeployment,
                    theme: { ...activeDeployment.theme, launcher_text: e.target.value }
                  })}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-zinc-700 mb-1">Welcome Message</label>
                <textarea
                  rows={2}
                  value={activeDeployment.theme.welcome_message}
                  onChange={(e) => setActiveDeployment({
                    ...activeDeployment,
                    theme: { ...activeDeployment.theme, welcome_message: e.target.value }
                  })}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs text-zinc-900 font-sans"
                />
              </div>
            </div>
          </div>

          {/* Embed Code Snippet */}
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
              <Code2 className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-xs text-zinc-900 uppercase tracking-wider">Embed Code</h3>
            </div>

            {/* Script Tag */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-700">HTML Script Embed (Recommended)</span>
                <button
                  onClick={() => copyToClipboard(scriptSnippet, 'script')}
                  className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                >
                  {copiedScript ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedScript ? 'Copied!' : 'Copy Script'}</span>
                </button>
              </div>
              <pre className="p-3 bg-zinc-900 text-zinc-200 rounded-2xl font-mono text-[11px] overflow-x-auto">
                {scriptSnippet}
              </pre>
            </div>

            {/* iFrame Tag */}
            <div className="space-y-2 pt-2 border-t border-zinc-100">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-700">iFrame Embed</span>
                <button
                  onClick={() => copyToClipboard(iframeSnippet, 'iframe')}
                  className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                >
                  {copiedIframe ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedIframe ? 'Copied!' : 'Copy iFrame'}</span>
                </button>
              </div>
              <pre className="p-3 bg-zinc-900 text-zinc-200 rounded-2xl font-mono text-[11px] overflow-x-auto">
                {iframeSnippet}
              </pre>
            </div>
          </div>
        </div>

        {/* Right Col: Live Widget Iframe Frame (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-indigo-600" /> Live Widget Preview
            </span>
            <a
              href={`/ai-mode/embed/${activeDeployment.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
            >
              <span>Open in new tab</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="bg-zinc-100 rounded-3xl p-3 border border-zinc-200 shadow-inner flex items-center justify-center min-h-[640px]">
            <iframe
              src={`/ai-mode/embed/${activeDeployment.id}`}
              className="w-full h-[620px] rounded-2xl bg-white shadow-lg border border-zinc-200"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
