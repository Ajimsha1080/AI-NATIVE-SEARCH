'use client';

import React, { useState, useEffect } from 'react';
import { 
  Code2, 
  Copy, 
  Check, 
  Globe, 
  Sliders, 
  ExternalLink, 
  Play, 
  ShieldCheck, 
  Sparkles,
  Layers,
  Palette
} from 'lucide-react';
import { AIModeDeployment } from '@/ai-mode/types';

export default function AIModeDeploymentPage() {
  const [deployments, setDeployments] = useState<AIModeDeployment[]>([]);
  const [selectedDep, setSelectedDep] = useState<AIModeDeployment | null>(null);
  const [copied, setCopied] = useState(false);
  const [originInput, setOriginInput] = useState('*');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDeployments();
  }, []);

  async function loadDeployments() {
    try {
      const res = await fetch('/api/ai-mode/deployments');
      if (res.ok) {
        const data = await res.json();
        const deps = data.deployments || [];
        setDeployments(deps);
        if (deps.length > 0) {
          setSelectedDep(deps[0]);
          setOriginInput((deps[0].allowed_domains || ['*']).join(', '));
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleUpdateDeployment(updates: Partial<AIModeDeployment>) {
    if (!selectedDep) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ai-mode/deployments/${selectedDep.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedDep(data.deployment);
        setDeployments(prev => prev.map(d => d.id === data.deployment.id ? data.deployment : d));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  function handleCopyEmbed() {
    if (!selectedDep) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const code = `<script src="${origin}/api/ai-mode/widget/${selectedDep.id}/script.js" async defer></script>`;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!selectedDep) {
    return (
      <div className="p-8 text-center text-zinc-500 text-xs">Loading AI Mode deployment configuration...</div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const currentEmbedCode = `<script src="${origin}/api/ai-mode/widget/${selectedDep.id}/script.js" async defer></script>`;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 tracking-tight">AI Mode Storefront Deployment</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Deploy an isolated AI Mode shopping widget directly to your merchant website or Shopify store.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleUpdateDeployment({ status: selectedDep.status === 'LIVE' ? 'PAUSED' : 'LIVE' })}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer ${
              selectedDep.status === 'LIVE'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${selectedDep.status === 'LIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`}></span>
            <span>Status: {selectedDep.status === 'LIVE' ? 'Live & Active' : 'Paused'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Embed Code & Security */}
        <div className="lg:col-span-2 space-y-5">
          {/* Embed Code Card */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-zinc-900">HTML Embed Code</h3>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono">Deployment ID: {selectedDep.id}</span>
            </div>

            <p className="text-xs text-zinc-500">
              Paste this asynchronous script tag into your website's <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono text-[11px] text-zinc-800">&lt;head&gt;</code> or right before the closing <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono text-[11px] text-zinc-800">&lt;/body&gt;</code> tag.
            </p>

            <div className="bg-zinc-900 text-emerald-400 rounded-xl p-4 font-mono text-xs overflow-x-auto border border-zinc-800 relative group">
              <pre>{currentEmbedCode}</pre>
              <button
                onClick={handleCopyEmbed}
                className="absolute right-3 top-3 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-xs transition flex items-center gap-1.5 shadow-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
          </div>

          {/* Domain Security */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-zinc-900">Allowed Domains &amp; CORS Origin Restriction</h3>
            </div>

            <p className="text-xs text-zinc-500">
              Protect your deployment by restricting widget execution to verified domains (e.g. <code className="font-mono text-[11px]">yourstore.com, store.myshopify.com</code>). Enter <code className="font-mono text-[11px]">*</code> to allow all domains.
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={originInput}
                onChange={e => setOriginInput(e.target.value)}
                placeholder="e.g. https://yourstore.com, https://app.yourdomain.com"
                className="flex-1 bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition font-mono"
              />
              <button
                onClick={() => {
                  const domains = originInput.split(',').map(d => d.trim()).filter(Boolean);
                  handleUpdateDeployment({ allowed_domains: domains });
                }}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition shadow-xs"
              >
                Save Origins
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Customization & Branding */}
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
              <Palette className="w-4 h-4 text-violet-600" />
              <h3 className="text-xs font-bold text-zinc-900">Widget Branding &amp; Style</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 mb-1">Widget Title</label>
                <input
                  type="text"
                  value={selectedDep.branding.title}
                  onChange={e => {
                    const branding = { ...selectedDep.branding, title: e.target.value };
                    setSelectedDep({ ...selectedDep, branding });
                    handleUpdateDeployment({ branding });
                  }}
                  className="w-full bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 mb-1">Subtitle</label>
                <input
                  type="text"
                  value={selectedDep.branding.subtitle}
                  onChange={e => {
                    const branding = { ...selectedDep.branding, subtitle: e.target.value };
                    setSelectedDep({ ...selectedDep, branding });
                    handleUpdateDeployment({ branding });
                  }}
                  className="w-full bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 mb-1">Screen Position</label>
                <select
                  value={selectedDep.branding.position}
                  onChange={e => {
                    const branding = { ...selectedDep.branding, position: e.target.value as any };
                    setSelectedDep({ ...selectedDep, branding });
                    handleUpdateDeployment({ branding });
                  }}
                  className="w-full bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
                >
                  <option value="bottom-right">Bottom Right (Default)</option>
                  <option value="bottom-left">Bottom Left</option>
                </select>
              </div>

              <div className="pt-2">
                <a
                  href={`/ai-mode/embed/${selectedDep.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <span>Open Standalone Widget</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
