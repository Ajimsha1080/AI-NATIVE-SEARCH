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
  Send,
  ShoppingBag,
  Bot,
  HelpCircle,
  RotateCcw,
  Layout,
  MessageSquare,
  Maximize2
} from 'lucide-react';
import { AIModeDeployment, AIModeMessage } from '@/ai-mode/types';

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
  const [widgetSubtitle, setWidgetSubtitle] = useState('Personalized Discovery & Styling Assistant');
  const [welcomeMessage, setWelcomeMessage] = useState('Hello! 👋 I am your AI Shopping Concierge. Ask me to discover products, find sizes, or compare styles.');
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([
    'Show me women sarees & drapes',
    'Find trending shirts under 2000',
    'Compare top sellers side-by-side',
    'What is your return & exchange policy?'
  ]);
  const [newPromptInput, setNewPromptInput] = useState('');

  // General State
  const [corsDomains, setCorsDomains] = useState('*');
  const [showBranding, setShowBranding] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);

  // Live Interactive Preview State
  const [previewMessages, setPreviewMessages] = useState<AIModeMessage[]>([
    {
      id: 'prev_welcome',
      role: 'assistant',
      content: 'Hello! 👋 I am your AI Shopping Concierge. Ask me to discover products, find sizes, or compare styles.',
      created_at: new Date().toISOString()
    }
  ]);
  const [previewInput, setPreviewInput] = useState('');
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
          setWidgetSubtitle(dep.branding?.subtitle || 'Personalized Discovery & Styling Assistant');
          setWelcomeMessage(dep.branding?.welcome_message || 'Hello! 👋 I am your AI Shopping Concierge. Ask me to discover products, find sizes, or compare styles.');
          if (dep.branding?.suggested_prompts && dep.branding.suggested_prompts.length > 0) {
            setSuggestedPrompts(dep.branding.suggested_prompts);
          }
          setCorsDomains((dep.allowed_domains || ['*']).join(', '));
          
          setPreviewMessages([
            {
              id: 'prev_welcome',
              role: 'assistant',
              content: dep.branding?.welcome_message || 'Hello! 👋 I am your AI Shopping Concierge. Ask me to discover products, find sizes, or compare styles.',
              created_at: new Date().toISOString()
            }
          ]);
        }
      }
    } catch (e) {
      console.error(e);
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

  async function handleSendPreviewMessage(textToSend?: string) {
    const text = textToSend || previewInput;
    if (!text.trim() || previewLoading) return;

    const userMsg: AIModeMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    };

    setPreviewMessages(prev => [...prev, userMsg]);
    setPreviewInput('');
    setPreviewLoading(true);

    try {
      const res = await fetch('/api/ai-mode/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.responseMessage) {
          setPreviewMessages(prev => [...prev, data.responseMessage]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPreviewLoading(false);
    }
  }

  if (!selectedDep) {
    return (
      <div className="p-8 text-center text-zinc-500 text-xs font-mono">Loading AI Mode deployment studio...</div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const scriptSnippet = `<!-- AI Mode Universal Floating Shopping Widget -->
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
      {/* AI Mode Shopping Assistant */}
      <Script 
        src="${origin}/api/ai-mode/widget/${selectedDep.id}/script.js" 
        strategy="lazyOnload" 
      />
    </>
  );
}`;

  const apiSnippet = `# Headless REST API Endpoint (Mobile Apps & Custom Frontends)
curl -X POST ${origin}/api/ai-mode/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Show me women products under 3000",
    "deployment_id": "${selectedDep.id}"
  }'`;

  const iframeSnippet = `<!-- Embedded Responsive Shopping Assistant Frame -->
<iframe 
  src="${origin}/ai-mode/embed/${selectedDep.id}"
  style="width: 100%; max-width: 420px; height: 600px; border: none; border-radius: 16px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);"
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
        {/* Navigation Tabs (matching reference image) */}
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
          {/* TAB 1: APPEARANCE (Matching reference image) */}
          {/* ============================================================= */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Card Header */}
              <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-2xs flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">AI Agent Appearance</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Customize widget themes, brand accent colors, launcher shape, and screen position.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold text-white shadow-2xs" style={{ backgroundColor: primaryColor }}>
                    {primaryColor}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200 capitalize">
                    {launcherShape}
                  </span>
                </div>
              </div>

              {/* 1. WIDGET THEME & BRAND COLORS */}
              <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-2xs space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">1. Widget Theme &amp; Brand Colors</h4>
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

              {/* 2. LAUNCHER SHAPE & SCREEN POSITION */}
              <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-2xs space-y-5">
                <div className="border-b border-zinc-100 pb-3">
                  <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">2. Launcher Shape &amp; Position</h4>
                  <p className="text-[11px] text-zinc-500">Choose how the floating trigger bubble looks and where it appears on the screen.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-2">Launcher Shape</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'teardrop', label: 'Teardrop' },
                        { id: 'pill', label: 'Pill Button' },
                        { id: 'circle', label: 'Circle' },
                        { id: 'squircle', label: 'Squircle' }
                      ].map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setLauncherShape(s.id as LauncherShape)}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                            launcherShape === s.id
                              ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                              : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200/80'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-2">Screen Position</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPosition('bottom-right')}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                          position === 'bottom-right'
                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                            : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200/80'
                        }`}
                      >
                        Bottom Right (Default)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPosition('bottom-left')}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                          position === 'bottom-left'
                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                            : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200/80'
                        }`}
                      >
                        Bottom Left
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 2: CONTENT & PROMPTS */}
          {/* ============================================================= */}
          {activeTab === 'content' && (
            <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-2xs space-y-5">
              <div className="border-b border-zinc-100 pb-3">
                <h3 className="text-sm font-bold text-zinc-900">Content &amp; Suggested Prompts</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Configure the assistant greeting, titles, and starter question chips.</p>
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
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Greeting Welcome Message</label>
                <textarea
                  rows={3}
                  value={welcomeMessage}
                  onChange={e => setWelcomeMessage(e.target.value)}
                  className="w-full bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl p-3 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition resize-none leading-relaxed"
                />
              </div>

              {/* Starter Questions Chips */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-semibold text-zinc-700">Suggested Starter Questions</label>
                
                <div className="space-y-2">
                  {suggestedPrompts.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800">
                      <span className="flex items-center gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
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
                    placeholder="Add a new suggested question..."
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
                <p className="text-xs text-zinc-500 mt-0.5">Configure allowed origin domains, rate limiting, and widget metadata.</p>
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
                    <div className="text-[10px] text-zinc-500">Play chime on incoming messages</div>
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
                { channel: 'Storefront Website Script', icon: Globe, status: selectedDep.status, id: selectedDep.id, desc: 'Universal 1-line script tag for Shopify, WordPress, Webflow, and HTML stores.' },
                { channel: 'React & Next.js SDK', icon: Layers, status: selectedDep.status, id: `sdk_${selectedDep.id}`, desc: 'Native TypeScript component integration for Next.js App Router and React frontends.' },
                { channel: 'Headless REST API', icon: Server, status: selectedDep.status, id: `api_${selectedDep.id}`, desc: 'Programmatic JSON endpoint for Flutter, iOS, Android, and backend microservices.' },
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

              {/* Code Display Card */}
              <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 text-[11px] font-mono text-zinc-400">
                  <span className="text-zinc-300 font-semibold">{snippetMap[activeSnippet].title}</span>
                  <button
                    onClick={() => handleCopySnippet(snippetMap[activeSnippet].code)}
                    className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition flex items-center gap-1.5 border border-zinc-700 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>

                <div className="p-4 text-emerald-400 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all leading-relaxed select-all">
                  {snippetMap[activeSnippet].code}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Real-Time Live Widget Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: primaryColor }} />
              <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider font-mono">Live Interactive Preview</span>
            </div>
            <a
              href={`/ai-mode/embed/${selectedDep.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <span>Full Screen</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Interactive Widget Box */}
          <div className="bg-white rounded-3xl border border-zinc-200/90 shadow-lg overflow-hidden flex flex-col h-[600px]">
            {/* Widget Top Bar with Custom Primary Color */}
            <div 
              className="p-4 text-white flex items-center justify-between shadow-xs transition-colors duration-300"
              style={{ backgroundColor: primaryColor }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white line-clamp-1">{widgetTitle}</h4>
                  <p className="text-[10px] text-white/80 line-clamp-1">{widgetSubtitle}</p>
                </div>
              </div>
              <button 
                onClick={() => setPreviewMessages([{ id: 'prev_w', role: 'assistant', content: welcomeMessage, created_at: new Date().toISOString() }])}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                title="Reset conversation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fafafa]">
              {previewMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-1`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'text-white font-medium'
                        : 'bg-white text-zinc-900 border border-zinc-200/80 shadow-2xs'
                    }`}
                    style={msg.role === 'user' ? { backgroundColor: primaryColor } : {}}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>

                  {/* Attached Products */}
                  {msg.products && msg.products.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 w-full pt-1">
                      {msg.products.slice(0, 2).map(p => (
                        <div key={p.id} className="bg-white rounded-xl border border-zinc-200 p-2 shadow-2xs space-y-1">
                          <div className="h-20 rounded-lg bg-zinc-100 overflow-hidden">
                            {p.images?.[0] ? (
                              <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-400">
                                <ShoppingBag className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <h5 className="text-[10px] font-bold text-zinc-900 line-clamp-1">{p.title}</h5>
                          <span className="text-[11px] font-black text-zinc-900 block">₹{p.price.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {previewLoading && (
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <Sparkles className="w-3 h-3 text-indigo-500 animate-spin" />
                  <span>AI assistant is thinking...</span>
                </div>
              )}
            </div>

            {/* Suggested Starter Questions Chips */}
            {suggestedPrompts.length > 0 && (
              <div className="px-3 py-2 bg-white border-t border-zinc-100 flex items-center gap-1.5 overflow-x-auto text-[10px]">
                {suggestedPrompts.slice(0, 3).map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendPreviewMessage(prompt)}
                    className="px-2.5 py-1 rounded-lg bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200 font-medium shrink-0 transition"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Chat Input */}
            <form onSubmit={e => { e.preventDefault(); handleSendPreviewMessage(); }} className="p-3 bg-white border-t border-zinc-200/80 flex items-center gap-2">
              <input
                type="text"
                placeholder="Ask anything..."
                value={previewInput}
                onChange={e => setPreviewInput(e.target.value)}
                className="flex-1 bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
              />
              <button
                type="submit"
                disabled={!previewInput.trim() || previewLoading}
                className="p-2 rounded-xl text-white disabled:opacity-50 transition shadow-xs cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
