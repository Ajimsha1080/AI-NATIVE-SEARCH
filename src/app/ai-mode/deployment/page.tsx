'use client';

import React, { useState, useEffect } from 'react';
import { 
  Code2, 
  Copy, 
  Check, 
  Globe, 
  Sliders, 
  ExternalLink, 
  ShieldCheck, 
  Sparkles,
  Palette,
  Terminal,
  Layers,
  Smartphone,
  CheckCircle2
} from 'lucide-react';
import { AIModeDeployment } from '@/ai-mode/types';

export default function AIModeDeploymentPage() {
  const [deployments, setDeployments] = useState<AIModeDeployment[]>([]);
  const [selectedDep, setSelectedDep] = useState<AIModeDeployment | null>(null);
  const [copied, setCopied] = useState(false);
  const [embedType, setEmbedType] = useState<'script' | 'react' | 'api' | 'iframe'>('script');
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
      <div className="p-8 text-center text-zinc-500 text-xs font-mono">Loading deployment configuration...</div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  // 1. Universal HTML / Shopify Liquid Script Tag
  const scriptEmbedCode = `<!-- AI Mode Universal Floating Shopping Widget -->
<script 
  src="${origin}/api/ai-mode/widget/${selectedDep.id}/script.js" 
  async 
  defer
></script>`;

  // 2. React / Next.js Component
  const reactEmbedCode = `// Next.js / React (App Router or Pages Router)
import Script from 'next/script';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      {/* AI Mode Shopping Assistant */}
      <Script 
        src="${origin}/api/ai-mode/widget/${selectedDep.id}/script.js" 
        strategy="lazyOnload" 
      />
    </>
  );
}`;

  // 3. REST API / cURL for Headless, Node.js & Mobile Apps
  const apiEmbedCode = `# Headless REST API Endpoint (Mobile Apps, Backend & Custom Frontends)
curl -X POST ${origin}/api/ai-mode/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Show me red cotton shirts under 2000",
    "deployment_id": "${selectedDep.id}"
  }'`;

  // 4. Responsive Iframe Tag
  const iframeEmbedCode = `<!-- Embedded Responsive Shopping Assistant Frame -->
<iframe 
  src="${origin}/ai-mode/embed/${selectedDep.id}"
  style="width: 100%; max-width: 420px; height: 600px; border: none; border-radius: 16px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);"
  allow="clipboard-write"
></iframe>`;

  const codeMap = {
    script: {
      title: 'HTML / Shopify theme.liquid / WordPress',
      code: scriptEmbedCode,
      desc: "Paste this 1-line script tag into your website's <head> or right before the closing </body> tag.",
      instructions: [
        { label: 'Shopify', desc: 'Online Store > Themes > Edit Code > theme.liquid > paste right before </body>' },
        { label: 'WordPress / WooCommerce', desc: 'Add to your header/footer script manager plugin or functions.php' },
        { label: 'Webflow / Squarespace / Wix', desc: 'Add to Site Settings > Custom Code (Footer Code)' }
      ]
    },
    react: {
      title: 'React.js / Next.js / Remix / Vite',
      code: reactEmbedCode,
      desc: 'Integrate directly into your React application using Next.js Script or standard React hook.',
      instructions: [
        { label: 'Next.js App Router', desc: 'Add <Script> component into your app/layout.tsx file' },
        { label: 'React / Vite SPA', desc: 'Insert into index.html or call in App.tsx useEffect hook' },
        { label: 'Remix / SvelteKit', desc: 'Include script tag inside root document layout' }
      ]
    },
    api: {
      title: 'Headless REST API / Mobile SDK / cURL',
      code: apiEmbedCode,
      desc: 'Connect your custom frontend, Flutter / React Native mobile app, or backend microservices directly to the AI Engine.',
      instructions: [
        { label: 'Flutter / React Native', desc: 'POST JSON payload to /api/ai-mode/chat from your mobile app HTTP client' },
        { label: 'Node.js / Python Backend', desc: 'Call API route with message & conversation_id for multi-turn sessions' },
        { label: 'Custom Checkout Bots', desc: 'Trigger cart additions and inventory checks via programmatic REST calls' }
      ]
    },
    iframe: {
      title: 'Inline Iframe / Landing Page Embed',
      code: iframeEmbedCode,
      desc: 'Embed the shopping assistant directly inside a dedicated container on your landing page, help center, or sidebar.',
      instructions: [
        { label: 'Landing Pages', desc: 'Embed directly inside any <div> or card container on your site' },
        { label: 'Help Centers / Portals', desc: 'Provide customers an interactive assistant inside knowledge bases' },
        { label: 'Modal / Popup Windows', desc: 'Open iframe inside your store custom popup dialogs' }
      ]
    }
  };

  const currentOption = codeMap[embedType];

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 tracking-tight">Multi-Channel Storefront Deployment</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Deploy your AI Shopping Assistant across Shopify, React/Next.js apps, Mobile SDKs, and custom channels.</p>
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
        {/* Left Column: Embed Channels & Security */}
        <div className="lg:col-span-2 space-y-5">
          {/* Main Embed Channel Card */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-zinc-900">Choose Deployment Channel</h3>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono">Deployment ID: {selectedDep.id}</span>
            </div>

            {/* 4 Deployment Channel Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-zinc-100 rounded-xl">
              <button
                type="button"
                onClick={() => setEmbedType('script')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition text-center flex flex-col items-center gap-1 ${
                  embedType === 'script' ? 'bg-white text-zinc-900 shadow-xs border border-zinc-200/60' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <span>HTML / Shopify</span>
                <span className="text-[10px] text-emerald-600 font-normal">Recommended</span>
              </button>
              <button
                type="button"
                onClick={() => setEmbedType('react')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition text-center flex flex-col items-center gap-1 ${
                  embedType === 'react' ? 'bg-white text-zinc-900 shadow-xs border border-zinc-200/60' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <span>React / Next.js</span>
                <span className="text-[10px] text-indigo-600 font-normal">Component</span>
              </button>
              <button
                type="button"
                onClick={() => setEmbedType('api')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition text-center flex flex-col items-center gap-1 ${
                  embedType === 'api' ? 'bg-white text-zinc-900 shadow-xs border border-zinc-200/60' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <span>REST API / SDK</span>
                <span className="text-[10px] text-amber-600 font-normal">Mobile &amp; cURL</span>
              </button>
              <button
                type="button"
                onClick={() => setEmbedType('iframe')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition text-center flex flex-col items-center gap-1 ${
                  embedType === 'iframe' ? 'bg-white text-zinc-900 shadow-xs border border-zinc-200/60' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <span>Iframe Embed</span>
                <span className="text-[10px] text-violet-600 font-normal">Inline Frame</span>
              </button>
            </div>

            <p className="text-xs text-zinc-500 leading-relaxed">
              {currentOption.desc}
            </p>

            {/* Code Box with Header and Copy Button */}
            <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 text-[11px] font-mono text-zinc-400">
                <span className="text-zinc-300 font-semibold">{currentOption.title}</span>
                <button
                  onClick={() => handleCopyEmbed(currentOption.code)}
                  className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition flex items-center gap-1.5 border border-zinc-700 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy Code'}</span>
                </button>
              </div>

              <div className="p-4 text-emerald-400 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all leading-relaxed select-all">
                {currentOption.code}
              </div>
            </div>

            {/* Step-by-Step Installation Guide */}
            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/60 space-y-2">
              <strong className="block text-xs text-zinc-900 font-bold">Integration Guide:</strong>
              <div className="space-y-1.5">
                {currentOption.instructions.map((inst, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] text-zinc-600">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-zinc-800 font-semibold">{inst.label}:</strong> {inst.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Domain Security */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-zinc-900">Allowed Domains &amp; CORS Origin Restriction</h3>
            </div>

            <p className="text-xs text-zinc-500">
              Protect your deployment by restricting widget execution to verified merchant domains (e.g. <code className="font-mono text-[11px]">https://yourstore.com, https://store.myshopify.com</code>). Enter <code className="font-mono text-[11px]">*</code> to allow all domains.
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
