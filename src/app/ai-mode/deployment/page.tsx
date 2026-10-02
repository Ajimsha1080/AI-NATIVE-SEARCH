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
  Palette,
  Layout
} from 'lucide-react';
import { AIModeDeployment } from '@/ai-mode/types';

export default function AIModeDeploymentPage() {
  const [deployments, setDeployments] = useState<AIModeDeployment[]>([]);
  const [selectedDep, setSelectedDep] = useState<AIModeDeployment | null>(null);
  const [copied, setCopied] = useState(false);
  const [embedType, setEmbedType] = useState<'script' | 'iframe'>('script');
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

  function handleCopyEmbed(textToCopy: string) {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!selectedDep) {
    return (
      <div className="p-8 text-center text-zinc-500 text-xs">Loading AI Mode deployment configuration...</div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const scriptEmbedCode = `<script src="${origin}/api/ai-mode/widget/${selectedDep.id}/script.js" async defer></script>`;
  const iframeEmbedCode = `<iframe 
  src="${origin}/ai-mode/embed/${selectedDep.id}"
  style="width: 380px; height: 600px; border: none; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);"
  allow="clipboard-write"
></iframe>`;

  const activeCode = embedType === 'script' ? scriptEmbedCode : iframeEmbedCode;

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

            {/* Type selector tabs */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center p-1 bg-zinc-100 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setEmbedType('script')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    embedType === 'script' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  &lt;script&gt; Tag (Recommended)
                </button>
                <button
                  type="button"
                  onClick={() => setEmbedType('iframe')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    embedType === 'iframe' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  &lt;iframe&gt; Embed
                </button>
              </div>

              <span className="text-[11px] text-zinc-500">
                {embedType === 'script' ? 'Floating store widget' : 'Inline embedded frame'}
              </span>
            </div>

            <p className="text-xs text-zinc-500">
              {embedType === 'script'
                ? "Paste this asynchronous script tag into your website's <head> or right before the closing </body> tag."
                : "Paste this iframe tag into any page, blog post, or modal container where you want the shopping assistant displayed."}
            </p>

            {/* Code container with top header (no overlap) */}
            <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
              {/* Header bar with clean Copy button */}
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-[11px] font-mono text-zinc-400">
                <span>{embedType === 'script' ? 'HTML / Shopify theme.liquid' : 'HTML / Component'}</span>
                <button
                  onClick={() => handleCopyEmbed(activeCode)}
                  className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition flex items-center gap-1.5 border border-zinc-700"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy Code'}</span>
                </button>
              </div>

              {/* Code text block */}
              <div className="p-4 text-emerald-400 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all leading-relaxed select-all">
                {activeCode}
              </div>
            </div>

            {/* Quick guide */}
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/60 text-[11px] text-zinc-600 space-y-1">
              <strong className="block text-zinc-800 font-semibold">How to install:</strong>
              <ul className="list-disc list-inside space-y-0.5 text-zinc-600">
                <li><strong>Shopify:</strong> Go to Online Store &gt; Themes &gt; Edit Code &gt; open <code className="font-mono bg-zinc-200/60 px-1 py-0.2 rounded">theme.liquid</code> &gt; paste right before <code className="font-mono bg-zinc-200/60 px-1 py-0.2 rounded">&lt;/body&gt;</code>.</li>
                <li><strong>WordPress / WooCommerce:</strong> Add to your header/footer script manager plugin.</li>
                <li><strong>Custom HTML / React / Next.js:</strong> Add to your root HTML document.</li>
              </ul>
            </div>
          </div>

          {/* Domain Security */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-zinc-900">Allowed Domains &amp; CORS Origin Restriction</h3>
            </div>

            <p className="text-xs text-zinc-500">
              Protect your deployment by restricting widget execution to verified domains (e.g. <code className="font-mono text-[11px]">https://yourstore.com, https://store.myshopify.com</code>). Enter <code className="font-mono text-[11px]">*</code> to allow all domains.
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
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
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
