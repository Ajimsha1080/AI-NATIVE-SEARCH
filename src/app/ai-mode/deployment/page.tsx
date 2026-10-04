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
  CheckCircle2,
  Server,
  X,
  Plus,
  Search,
  ShoppingBag,
  RotateCcw,
  RefreshCw,
  Zap,
  Tag,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { AIModeDeployment, AIModeProduct } from '@/ai-mode/types';

type TabType = 'channels' | 'appearance' | 'content' | 'general' | 'embed';
type SnippetType = 'script' | 'react' | 'api' | 'iframe';
type LauncherShape = 'teardrop' | 'circle' | 'pill' | 'squircle';
type LauncherIcon = 'sparkles' | 'bot' | 'bag' | 'chat';

const THEME_PRESETS = [
  { id: 'cosmic', name: 'Cosmic Chills', primary: '#4f46e5', bg: '#f8fafc', header: '#4338ca' },
  { id: 'emerald', name: 'Emerald Mint', primary: '#10b981', bg: '#f0fdf4', header: '#047857' },
  { id: 'sunset', name: 'Sunset Bliss', primary: '#f97316', bg: '#fff7ed', header: '#c2410c' },
  { id: 'starry', name: 'Starry Night', primary: '#2563eb', bg: '#eff6ff', header: '#1d4ed8' },
  { id: 'mint', name: 'Mint Breeze', primary: '#059669', bg: '#ecfdf5', header: '#065f46' },
  { id: 'rose', name: 'Rose Petal', primary: '#ec4899', bg: '#fdf2f8', header: '#be185d' },
  { id: 'purple', name: 'Royal Purple', primary: '#8b5cf6', bg: '#faf5ff', header: '#6d28d9' },
  { id: 'obsidian', name: 'Midnight Obsidian', primary: '#0f172a', bg: '#f8fafc', header: '#020617' },
];

export default function AIModeDeploymentPage() {
  const [deployments, setDeployments] = useState<AIModeDeployment[]>([]);
  const [selectedDep, setSelectedDep] = useState<AIModeDeployment | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('appearance');
  const [activeSnippet, setActiveSnippet] = useState<SnippetType>('script');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  // Appearance State
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [launcherShape, setLauncherShape] = useState<LauncherShape>('teardrop');
  const [launcherIcon, setLauncherIcon] = useState<LauncherIcon>('sparkles');
  const [position, setPosition] = useState<'bottom-right' | 'bottom-left'>('bottom-right');

  // Content State
  const [widgetTitle, setWidgetTitle] = useState('Storefront AI Concierge');
  const [widgetSubtitle, setWidgetSubtitle] = useState('Personalized Discovery & Search Assistant');
  const [welcomeMessage, setWelcomeMessage] = useState('Ask me to find products, discover outfits, or search by price.');
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([
    'women products',
    'sarees for women',
    'cotton shirts under 2000',
    'couple combos'
  ]);
  const [newPromptInput, setNewPromptInput] = useState('');

  // General State
  const [corsDomains, setCorsDomains] = useState('*');
  const [showBranding, setShowBranding] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);

  // Live Interactive Search Preview State (Matching reference Image 1)
  const [previewQuery, setPreviewQuery] = useState('women products');
  const [previewProducts, setPreviewProducts] = useState<AIModeProduct[]>([]);
  const [previewTotalMatches, setPreviewTotalMatches] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    loadDeployments();
  }, []);

  async function loadDeployments() {
    try {
      const res = await fetch('/api/ai-mode/deployments');
      if (res.ok) {
        const data = await res.json();
        const deps: AIModeDeployment[] = data.deployments || [];
        setDeployments(deps);
        if (deps.length > 0) {
          const dep = deps[0];
          setSelectedDep(dep);
          setPrimaryColor(dep.theme?.primary_color || '#4f46e5');
          setPosition(dep.branding?.position || 'bottom-right');
          setWidgetTitle(dep.branding?.title || 'Storefront AI Concierge');
          setWidgetSubtitle(dep.branding?.subtitle || 'Personalized Discovery & Search Assistant');
          setWelcomeMessage(dep.branding?.welcome_message || 'Ask me to find products, discover outfits, or search by price.');
          if (dep.branding?.suggested_prompts && dep.branding.suggested_prompts.length > 0) {
            setSuggestedPrompts(dep.branding.suggested_prompts);
          }
          setCorsDomains((dep.allowed_domains || ['*']).join(', '));
        }
      }
      // Load initial preview products
      executePreviewSearch('women products');
    } catch (e) {
      console.error(e);
    }
  }

  async function executePreviewSearch(queryToSearch: string) {
    if (!queryToSearch.trim()) return;
    setPreviewLoading(true);
    setPreviewQuery(queryToSearch);
    try {
      const res = await fetch('/api/ai-mode/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryToSearch,
          page: 1,
          page_size: 12
        })
      });

      if (res.ok) {
        const data = await res.json();
        setPreviewProducts(data.products || []);
        setPreviewTotalMatches(data.total_matches || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSaveChanges() {
    if (!selectedDep) return;
    setSaving(true);
    try {
      const updates: Partial<AIModeDeployment> = {
        allowed_domains: corsDomains.split(',').map(d => d.trim()).filter(Boolean),
        theme: {
          ...(selectedDep.theme || {}),
          primary_color: primaryColor,
          background_color: '#ffffff',
          text_color: '#09090b',
          border_radius: 'lg',
          font_family: 'Inter, sans-serif'
        },
        branding: {
          title: widgetTitle,
          subtitle: widgetSubtitle,
          welcome_message: welcomeMessage,
          suggested_prompts: suggestedPrompts,
          position: position
        }
      };

      const res = await fetch(`/api/ai-mode/deployments/${selectedDep.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedDep(data.deployment);
        setDeployments(prev => prev.map(d => d.id === data.deployment.id ? data.deployment : d));
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  function handleCopySnippet(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleAddPrompt() {
    if (newPromptInput.trim()) {
      setSuggestedPrompts([...suggestedPrompts, newPromptInput.trim()]);
      setNewPromptInput('');
    }
  }

  function handleRemovePrompt(idx: number) {
    setSuggestedPrompts(suggestedPrompts.filter((_, i) => i !== idx));
  }

  if (!selectedDep) {
    return (
      <div className="p-8 text-center text-zinc-500 text-xs font-mono">Loading AI Mode deployment studio...</div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const scriptSnippet = `<!-- AI Mode Universal Storefront Search Widget -->
<script 
  src="${origin}/api/ai-mode/widget/${selectedDep.id}/script.js" 
  async 
  defer
></script>`;

  const reactSnippet = `// Next.js / React (App Router or Pages Router)
import Script from 'next/script';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      {/* AI Mode Shopping & Search Widget */}
      <Script 
        src="${origin}/api/ai-mode/widget/${selectedDep.id}/script.js" 
        strategy="lazyOnload" 
      />
    </>
  );
}`;

  const apiSnippet = `# Headless REST API Endpoint (Mobile Apps & Custom Frontends)
curl -X POST ${origin}/api/ai-mode/search \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "women products",
    "deployment_id": "${selectedDep.id}"
  }'`;

  const iframeSnippet = `<!-- Embedded Responsive Storefront AI Search Frame -->
<iframe 
  src="${origin}/ai-mode/embed/${selectedDep.id}"
  style="width: 100%; max-width: 540px; height: 650px; border: none; border-radius: 16px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);"
  allow="clipboard-write"
></iframe>`;

  const snippetMap = {
    script: { title: 'HTML / Shopify theme.liquid / WordPress', code: scriptSnippet },
    react: { title: 'React.js / Next.js / Remix Component', code: reactSnippet },
    api: { title: 'Headless REST API / Mobile SDK / cURL', code: apiSnippet },
    iframe: { title: 'Inline Responsive Iframe Frame', code: iframeSnippet }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Studio Top Header & Sub-Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'channels', label: 'Channels & Deployments' },
            { id: 'appearance', label: 'Appearance' },
            { id: 'content', label: 'Content' },
            { id: 'general', label: 'General' },
            { id: 'embed', label: 'Embed Code' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Save Changes Button & Live Status */}
        <div className="flex items-center gap-3">
          {savedToast && (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <Check className="w-3.5 h-3.5" /> Changes saved live
            </span>
          )}

          <button
            onClick={() => handleSaveChanges()}
            disabled={saving}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Main Split Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Tab Config Panels */}
        <div className="lg:col-span-7 space-y-6">

          {/* ============================================================= */}
          {/* TAB 1: APPEARANCE */}
          {/* ============================================================= */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Card Header */}
              <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-2xs flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">AI Search Appearance</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Customize search themes and brand accent colors.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold text-white shadow-2xs" style={{ backgroundColor: primaryColor }}>
                    {primaryColor}
                  </span>
                </div>
              </div>

              {/* WIDGET THEME & BRAND COLORS */}
              <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-2xs space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Widget Theme &amp; Brand Colors</h4>
                    <p className="text-[11px] text-zinc-500">Select a curated theme template and fine-tune your accent and background styling.</p>
                  </div>
                </div>

                {/* Curated Theme Templates Grid */}
                <div>
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <span className="font-semibold text-zinc-700">Curated Theme Templates</span>
                    <button 
                      onClick={() => setPrimaryColor('#4f46e5')}
                      className="text-zinc-400 hover:text-zinc-600 text-[11px] font-medium flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Defaults</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {THEME_PRESETS.map(preset => {
                      const isSelected = primaryColor === preset.primary;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setPrimaryColor(preset.primary)}
                          className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between h-28 ${
                            isSelected 
                              ? 'border-indigo-600 ring-2 ring-indigo-600/20 bg-white shadow-xs' 
                              : 'border-zinc-200/80 bg-zinc-50/50 hover:bg-zinc-50'
                          }`}
                        >
                          <div className="w-full h-10 rounded-xl overflow-hidden border border-zinc-200/60 p-1 flex flex-col justify-between" style={{ backgroundColor: preset.bg }}>
                            <div className="h-2 w-8 rounded-full" style={{ backgroundColor: preset.header }} />
                            <div className="flex justify-end">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.primary }} />
                            </div>
                          </div>
                          <span className="text-xs font-bold text-zinc-800 line-clamp-1">{preset.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Color Picker */}
                <div className="pt-3 border-t border-zinc-100 flex items-center gap-3">
                  <span className="text-xs font-semibold text-zinc-700">Custom Accent Color:</span>
                  <input 
                    type="color" 
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="w-8 h-8 rounded-xl cursor-pointer border border-zinc-200 p-0.5"
                  />
                  <input 
                    type="text" 
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="w-24 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono uppercase text-zinc-900 font-bold focus:outline-none focus:border-zinc-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 2: CONTENT & SUGGESTED SEARCHES */}
          {/* ============================================================= */}
          {activeTab === 'content' && (
            <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-2xs space-y-5">
              <div className="border-b border-zinc-100 pb-3">
                <h3 className="text-sm font-bold text-zinc-900">Search Content &amp; Suggested Queries</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Configure the search header, placeholder text, and quick suggestion pills.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Header Main Title</label>
                  <input
                    type="text"
                    value={widgetTitle}
                    onChange={e => setWidgetTitle(e.target.value)}
                    className="w-full bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Header Subtitle</label>
                  <input
                    type="text"
                    value={widgetSubtitle}
                    onChange={e => setWidgetSubtitle(e.target.value)}
                    className="w-full bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Search Bar Placeholder</label>
                <input
                  type="text"
                  value={welcomeMessage}
                  onChange={e => setWelcomeMessage(e.target.value)}
                  className="w-full bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
                />
              </div>

              {/* Starter Search Chips */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-semibold text-zinc-700">Quick Suggestion Search Pills</label>
                
                <div className="space-y-2">
                  {suggestedPrompts.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800">
                      <span className="flex items-center gap-2">
                        <Search className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{p}</span>
                      </span>
                      <button
                        onClick={() => handleRemovePrompt(idx)}
                        className="text-zinc-400 hover:text-rose-600 p-1 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Add a new suggested search (e.g. 'linen shirts under 1500')..."
                    value={newPromptInput}
                    onChange={e => setNewPromptInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddPrompt()}
                    className="flex-1 bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
                  />
                  <button
                    type="button"
                    onClick={handleAddPrompt}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 3: GENERAL & SECURITY */}
          {/* ============================================================= */}
          {activeTab === 'general' && (
            <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-2xs space-y-5">
              <div className="border-b border-zinc-100 pb-3">
                <h3 className="text-sm font-bold text-zinc-900">General &amp; Domain Governance</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Configure allowed origin domains and search metadata.</p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-700">Allowed Origin Domains (CORS Restriction)</label>
                <input
                  type="text"
                  value={corsDomains}
                  onChange={e => setCorsDomains(e.target.value)}
                  placeholder="e.g. https://yourstore.com, https://store.myshopify.com, *"
                  className="w-full bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 font-mono focus:outline-none focus:border-zinc-900 transition"
                />
                <p className="text-[11px] text-zinc-500">Comma-separated list of domains allowed to load this widget token. Enter * to allow all.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="flex items-center justify-between p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <div>
                    <div className="text-xs font-bold text-zinc-900">Show Branding</div>
                    <div className="text-[10px] text-zinc-500">Display "Powered by AI Mode"</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showBranding}
                    onChange={e => setShowBranding(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <div>
                    <div className="text-xs font-bold text-zinc-900">Sound Effects</div>
                    <div className="text-[10px] text-zinc-500">Play chime on search completion</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={soundEffects}
                    onChange={e => setSoundEffects(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 4: CHANNELS & DEPLOYMENTS */}
          {/* ============================================================= */}
          {activeTab === 'channels' && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-2xs flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Active Deployment Channels</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Toggle channel availability and view public tokens.</p>
                </div>
                <button
                  onClick={() => handleSaveChanges()}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <span>Sync Channels</span>
                </button>
              </div>

              {[
                { channel: 'Storefront Search Script', icon: Globe, status: selectedDep.status, id: selectedDep.id, desc: 'Universal 1-line script tag for Shopify, WordPress, Webflow, and HTML stores.' },
                { channel: 'React & Next.js SDK', icon: Layers, status: selectedDep.status, id: `sdk_${selectedDep.id}`, desc: 'Native TypeScript component integration for Next.js App Router and React frontends.' },
                { channel: 'Headless Search REST API', icon: Server, status: selectedDep.status, id: `api_${selectedDep.id}`, desc: 'Programmatic JSON endpoint for Flutter, iOS, Android, and backend microservices.' },
                { channel: 'Responsive Iframe Frame', icon: Code2, status: selectedDep.status, id: `iframe_${selectedDep.id}`, desc: 'Embedded container for landing page cards, help portals, and blog embeds.' },
              ].map((ch, idx) => {
                const IconComp = ch.icon;
                return (
                  <div key={idx} className="p-4 bg-white rounded-2xl border border-zinc-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-zinc-900">{ch.channel}</h4>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {ch.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{ch.desc}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTab('embed')}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition self-start sm:self-auto shrink-0"
                    >
                      Get Snippet →
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 5: EMBED CODE */}
          {/* ============================================================= */}
          {activeTab === 'embed' && (
            <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-zinc-900">Multi-Channel Installation Code</h3>
                </div>
                <span className="text-[11px] text-zinc-400 font-mono">Deployment ID: {selectedDep.id}</span>
              </div>

              {/* Snippet Switcher Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-zinc-100 rounded-xl">
                {[
                  { id: 'script', label: 'HTML / Shopify' },
                  { id: 'react', label: 'React / Next.js' },
                  { id: 'api', label: 'REST API / cURL' },
                  { id: 'iframe', label: 'Iframe Embed' }
                ].map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSnippet(s.id as SnippetType)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition text-center ${
                      activeSnippet === s.id ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Code Display Card with Beautiful IDE Syntax Highlighting */}
              <div className="bg-[#0b0f17] rounded-2xl border border-zinc-800/90 shadow-xl overflow-hidden">
                {/* Editor Header Bar */}
                <div className="flex items-center justify-between px-4 py-3 bg-[#111622] border-b border-zinc-800/80 text-[11px] font-mono">
                  <div className="flex items-center gap-3">
                    {/* Mac Window Control Dots */}
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/50 inline-block" />
                      <span className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/50 inline-block" />
                      <span className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]/50 inline-block" />
                    </div>

                    <div className="flex items-center gap-2 pl-2 border-l border-zinc-700/60">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {activeSnippet === 'script' ? 'HTML / LIQUID' : activeSnippet === 'react' ? 'TYPESCRIPT / NEXT.JS' : activeSnippet === 'api' ? 'CURL / BASH' : 'IFRAME'}
                      </span>
                      <span className="text-zinc-300 font-medium text-xs">{snippetMap[activeSnippet].title}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopySnippet(snippetMap[activeSnippet].code)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition flex items-center gap-1.5 border border-zinc-700/80 hover:border-zinc-600 shadow-xs cursor-pointer active:scale-95"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Syntax-Highlighted Code Lines */}
                <div className="p-4 font-mono text-xs space-y-0.5 select-all overflow-x-auto bg-[#0b0f17]">
                  {activeSnippet === 'script' && (
                    <>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">1</span><span className="text-zinc-500 italic">&lt;!-- AI Mode Universal Storefront Search Widget --&gt;</span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">2</span><span className="text-pink-400 font-bold">&lt;script</span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">3</span><span>  <span className="text-sky-300">src</span>=<span className="text-emerald-300 font-semibold">"{origin}/api/ai-mode/widget/{selectedDep.id}/script.js"</span></span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">4</span><span>  <span className="text-amber-300 font-semibold">async</span></span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">5</span><span>  <span className="text-amber-300 font-semibold">defer</span></span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">6</span><span className="text-pink-400 font-bold">&gt;&lt;/script&gt;</span></div>
                    </>
                  )}

                  {activeSnippet === 'react' && (
                    <>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">1</span><span className="text-zinc-500 italic">// Next.js / React (App Router or Pages Router)</span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">2</span><span><span className="text-purple-400 font-bold">import </span><span className="text-cyan-300 font-bold">Script </span><span className="text-purple-400 font-bold">from </span><span className="text-emerald-300 font-semibold">'next/script'</span>;</span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">3</span><span></span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">4</span><span><span className="text-purple-400 font-bold">export default function </span><span className="text-amber-300 font-bold">StoreLayout</span>({`{ children }: { children: `}<span className="text-cyan-300 font-bold">React</span>.<span className="text-cyan-300 font-bold">ReactNode</span>{` }`}) {`{`}</span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">5</span><span>  <span className="text-purple-400 font-bold">return</span> (</span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">6</span><span>    <span className="text-pink-400 font-bold">&lt;&gt;</span></span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">7</span><span>      {`{children}`}</span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">8</span><span className="text-zinc-500 italic">      {`{/* AI Mode Shopping & Search Widget */}`}</span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">9</span><span>      <span className="text-pink-400 font-bold">&lt;Script</span></span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">10</span><span>        <span className="text-sky-300">src</span>=<span className="text-emerald-300 font-semibold">"{origin}/api/ai-mode/widget/{selectedDep.id}/script.js"</span></span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">11</span><span>        <span className="text-sky-300">strategy</span>=<span className="text-emerald-300 font-semibold">"lazyOnload"</span></span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">12</span><span>      <span className="text-pink-400 font-bold">/&gt;</span></span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">13</span><span>    <span className="text-pink-400 font-bold">&lt;/&gt;</span></span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">14</span><span>  );</span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">15</span><span>{`}`}</span></div>
                    </>
                  )}

                  {activeSnippet === 'api' && (
                    <>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">1</span><span className="text-zinc-500 italic"># Headless REST API Endpoint (Mobile Apps &amp; Custom Frontends)</span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">2</span><span><span className="text-pink-400 font-bold">curl </span><span className="text-amber-400 font-semibold">-X </span><span className="text-purple-400 font-bold">POST </span><span className="text-sky-300 font-medium">{origin}/api/ai-mode/search</span> \</span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">3</span><span>  <span className="text-amber-400 font-semibold">-H </span><span className="text-emerald-300 font-semibold">"Content-Type: application/json"</span> \</span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">4</span><span>  <span className="text-amber-400 font-semibold">-d </span><span className="text-amber-300 font-bold">'</span>{`{`}</span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">5</span><span>    <span className="text-cyan-300">"query"</span>: <span className="text-emerald-300 font-medium">"women products"</span>,</span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">6</span><span>    <span className="text-cyan-300">"deployment_id"</span>: <span className="text-emerald-300 font-medium">"{selectedDep.id}"</span></span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">7</span><span>  {`}`}<span className="text-amber-300 font-bold">'</span></span></div>
                    </>
                  )}

                  {activeSnippet === 'iframe' && (
                    <>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">1</span><span className="text-zinc-500 italic">&lt;!-- Embedded Responsive Storefront AI Search Frame --&gt;</span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">2</span><span className="text-pink-400 font-bold">&lt;iframe</span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">3</span><span>  <span className="text-sky-300">src</span>=<span className="text-emerald-300 font-semibold">"{origin}/ai-mode/embed/{selectedDep.id}"</span></span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">4</span><span>  <span className="text-sky-300">style</span>=<span className="text-emerald-300 font-semibold">"width: 100%; max-width: 540px; height: 650px; border: none; border-radius: 16px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);"</span></span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">5</span><span>  <span className="text-sky-300">allow</span>=<span className="text-emerald-300 font-semibold">"clipboard-write"</span></span></div>
                      <div className="flex items-start gap-3"><span className="w-5 text-right text-zinc-600 select-none text-[11px]">6</span><span className="text-pink-400 font-bold">&gt;&lt;/iframe&gt;</span></div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: STOREFRONT AI SEARCH LIVE PREVIEW (MATCHING IMAGE 1) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: primaryColor }} />
              <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider font-mono">Live Storefront Search Preview</span>
            </div>
            <a
              href={`/ai-mode/search`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <span>Full Screen</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Storefront Search Preview Container */}
          <div className="bg-white rounded-3xl border border-zinc-200/90 shadow-lg overflow-hidden flex flex-col h-[650px]">
            {/* AI Search Bar Box */}
            <div className="p-4 bg-white border-b border-zinc-100 space-y-3">
              <form 
                onSubmit={e => { e.preventDefault(); executePreviewSearch(previewQuery); }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder={welcomeMessage || "Search products with AI..."}
                    value={previewQuery}
                    onChange={e => setPreviewQuery(e.target.value)}
                    className="w-full bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition font-medium"
                  />
                  {previewQuery && (
                    <button
                      type="button"
                      onClick={() => setPreviewQuery('')}
                      className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={previewLoading || !previewQuery.trim()}
                  className="px-4 py-2.5 rounded-xl text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
                  style={{ backgroundColor: primaryColor }}
                >
                  {previewLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5 text-white" />}
                  <span>Search</span>
                </button>
              </form>

              {/* Quick Search Chips */}
              {suggestedPrompts.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto text-[10px] pb-1">
                  <span className="text-zinc-400 font-medium shrink-0">Try:</span>
                  {suggestedPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => executePreviewSearch(prompt)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200/80 font-medium shrink-0 transition"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Live Search Products Grid */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fafafa]">
              <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium">
                <span>Results for <strong className="text-zinc-800">"{previewQuery}"</strong></span>
                <span className="font-mono text-zinc-700 font-semibold">{previewTotalMatches} Products Found</span>
              </div>

              {previewLoading ? (
                <div className="flex flex-col items-center justify-center h-48 text-xs text-zinc-400 space-y-2">
                  <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
                  <span>Searching full catalog with AI...</span>
                </div>
              ) : previewProducts.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 text-xs space-y-1">
                  <ShoppingBag className="w-8 h-8 mx-auto text-zinc-300" />
                  <p>No products found matching "{previewQuery}"</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {previewProducts.map((p, idx) => (
                    <DeploymentPreviewProductCard key={p.id || idx} product={p} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeploymentPreviewProductCard({ product }: { product: AIModeProduct }) {
  const images = (product.images && product.images.length > 0) ? product.images : [];
  const [activeImgIdx, setActiveImgIdx] = useState(0);

  const handlePrevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (images.length <= 1) return;
    setActiveImgIdx((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (images.length <= 1) return;
    setActiveImgIdx((prev) => (prev + 1) % images.length);
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 p-2.5 shadow-2xs space-y-2 flex flex-col justify-between hover:border-zinc-300 transition group">
      <div className="space-y-1.5">
        <div className="aspect-[3/4] w-full rounded-xl bg-zinc-100 overflow-hidden relative border border-zinc-100 select-none group/img">
          {product.source_url ? (
            <a
              href={product.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full h-full cursor-pointer"
            >
              {images.length > 0 ? (
                <img 
                  src={images[activeImgIdx] || images[0]} 
                  alt={`${product.title} - View ${activeImgIdx + 1}`} 
                  className="w-full h-full object-cover object-top transition duration-300 group-hover/img:scale-105" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-400">
                  <ShoppingBag className="w-6 h-6" />
                </div>
              )}
            </a>
          ) : images.length > 0 ? (
            <img 
              src={images[activeImgIdx] || images[0]} 
              alt={`${product.title} - View ${activeImgIdx + 1}`} 
              className="w-full h-full object-cover object-top transition duration-300" 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-400">
              <ShoppingBag className="w-6 h-6" />
            </div>
          )}

          <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase bg-white/90 text-zinc-800 backdrop-blur-xs border border-zinc-200/60 z-10 pointer-events-none">
            {product.category || 'Apparel'}
          </span>

          {images.length > 1 && (
            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-zinc-900/80 text-white backdrop-blur-xs shadow-xs border border-white/20 z-10 pointer-events-none">
              {activeImgIdx + 1}/{images.length}
            </span>
          )}

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevImage}
                title="Previous photo"
                className="absolute left-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/90 hover:bg-white text-zinc-800 shadow flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity z-10 cursor-pointer"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={handleNextImage}
                title="Next photo"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/90 hover:bg-white text-zinc-800 shadow flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity z-10 cursor-pointer"
              >
                <ChevronRight className="w-3 h-3" />
              </button>

              <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 z-10 bg-black/30 backdrop-blur-xs px-1 py-0.5 rounded-full">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActiveImgIdx(i);
                    }}
                    className={`rounded-full transition-all cursor-pointer ${
                      activeImgIdx === i 
                        ? 'w-1.5 h-1.5 bg-white' 
                        : 'w-1 h-1 bg-white/50 hover:bg-white/80'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          {product.source_url ? (
            <a href={product.source_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
              <h5 className="text-[11px] font-bold text-zinc-900 line-clamp-1">{product.title}</h5>
            </a>
          ) : (
            <h5 className="text-[11px] font-bold text-zinc-900 line-clamp-1">{product.title}</h5>
          )}
          <p className="text-[10px] text-zinc-500 line-clamp-1">{product.description || 'Catalog item'}</p>
        </div>
      </div>

      <div className="pt-1.5 border-t border-zinc-100 flex items-center justify-between">
        <span className="text-xs font-black text-zinc-900">₹{product.price.toLocaleString('en-IN')}</span>
        <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
          In Stock
        </span>
      </div>
    </div>
  );
}
