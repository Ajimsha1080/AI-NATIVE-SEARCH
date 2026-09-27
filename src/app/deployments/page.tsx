'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import { 
  Globe, Code2, Server, Smartphone, Plus, Power, 
  MoreVertical, Check, Copy, RefreshCw, X, Play, 
  Trash2, Key, ShieldCheck, Sparkles, MessageSquare, 
  Palette, FileText, Sliders, ExternalLink, ChevronRight,
  Settings2, Eye, HelpCircle, Layers, CheckCircle2,
  Send, Bot, ShoppingBag, Minimize2, Maximize2, RotateCcw,
  SlidersHorizontal, MessageCircle, Terminal, Crown, HelpCircle as QuestionIcon
} from 'lucide-react';
import { fetchWithCache, getClientCachedData } from '@/lib/client-cache';

type TabType = 'channels' | 'appearance' | 'content' | 'general' | 'embed';
type SnippetType = 'html' | 'react' | 'iframe' | 'rest';
type LauncherShape = 'teardrop' | 'circle' | 'pill' | 'rounded';
type LauncherIcon = 'chat' | 'sparkles' | 'bot' | 'bag' | 'help';
type ThemeMode = 'dark' | 'light' | 'auto';

interface ThemePreset {
  id: string;
  name: string;
  isPremium?: boolean;
  primaryColor: string;
  themeMode: 'light' | 'dark';
  canvasBg: string;
  topBubbleBg: string;
  midBubbleBg: string;
  inputBg: string;
  dotColor: string;
  cardBgHex: string;
  headerBgHex: string;
  borderHex: string;
  description: string;
}

const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'cosmic_chills',
    name: 'Cosmic Chills',
    primaryColor: '#7c3aed',
    themeMode: 'light',
    canvasBg: 'bg-[#f4f5f8]',
    topBubbleBg: 'bg-white',
    midBubbleBg: 'bg-[#ede9fe]',
    inputBg: 'bg-white',
    dotColor: '#7c3aed',
    cardBgHex: '#f4f5f8',
    headerBgHex: '#ede9fe',
    borderHex: '#ddd6fe',
    description: 'Clean modern lavender aesthetic with soft violet accents'
  },
  {
    id: 'cosmic_depth',
    name: 'Cosmic Depth',
    primaryColor: '#8b5cf6',
    themeMode: 'dark',
    canvasBg: 'bg-[#0f172a]',
    topBubbleBg: 'bg-[#1e293b]',
    midBubbleBg: 'bg-[#161e2e]',
    inputBg: 'bg-[#1e293b]',
    dotColor: '#8b5cf6',
    cardBgHex: '#0f172a',
    headerBgHex: '#1e293b',
    borderHex: '#334155',
    description: 'Deep cosmic dark mode with vibrant neon violet accents'
  },
  {
    id: 'sunset_bliss',
    name: 'Sunset Bliss',
    primaryColor: '#f97316',
    themeMode: 'light',
    canvasBg: 'bg-[#fff7ed]',
    topBubbleBg: 'bg-[#ffedd5]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#f97316',
    cardBgHex: '#fff7ed',
    headerBgHex: '#ffedd5',
    borderHex: '#fed7aa',
    description: 'Warm pastel peach & sunset glow with coral accents'
  },
  {
    id: 'stary_night',
    name: 'Stary Night',
    primaryColor: '#2563eb',
    themeMode: 'light',
    canvasBg: 'bg-[#f8fafc]',
    topBubbleBg: 'bg-[#e0e7ff]',
    midBubbleBg: 'bg-[#ede9fe]',
    inputBg: 'bg-white',
    dotColor: '#2563eb',
    cardBgHex: '#f8fafc',
    headerBgHex: '#e0e7ff',
    borderHex: '#c7d2fe',
    description: 'Crisp royal blue and starry starlight indigo'
  },
  {
    id: 'mint_breeze',
    name: 'Mint Breeze',
    primaryColor: '#ec4899',
    themeMode: 'light',
    canvasBg: 'bg-[#ecfdf5]',
    topBubbleBg: 'bg-[#ccfbf1]',
    midBubbleBg: 'bg-[#d1fae5]',
    inputBg: 'bg-[#d1fae5]',
    dotColor: '#ec4899',
    cardBgHex: '#ecfdf5',
    headerBgHex: '#ccfbf1',
    borderHex: '#a7f3d0',
    description: 'Fresh botanical mint green with bold pink button'
  },
  {
    id: 'emerald_luxury',
    name: 'Emerald Luxury',
    primaryColor: '#059669',
    themeMode: 'light',
    canvasBg: 'bg-[#f0fdf4]',
    topBubbleBg: 'bg-[#dcfce7]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#059669',
    cardBgHex: '#f0fdf4',
    headerBgHex: '#dcfce7',
    borderHex: '#bbf7d0',
    description: 'Prestige forest emerald with fresh mint highlights'
  },
  {
    id: 'rose_velvet',
    name: 'Rose Velvet',
    primaryColor: '#e11d48',
    themeMode: 'light',
    canvasBg: 'bg-[#fff1f2]',
    topBubbleBg: 'bg-[#ffe4e6]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#e11d48',
    cardBgHex: '#fff1f2',
    headerBgHex: '#ffe4e6',
    borderHex: '#fecdd3',
    description: 'Romantic champagne rose with rich berry velvet accents'
  },
  {
    id: 'electric_indigo',
    name: 'Electric Indigo',
    primaryColor: '#4f46e5',
    themeMode: 'light',
    canvasBg: 'bg-[#f5f3ff]',
    topBubbleBg: 'bg-[#ede9fe]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#4f46e5',
    cardBgHex: '#f5f3ff',
    headerBgHex: '#ede9fe',
    borderHex: '#ddd6fe',
    description: 'Futuristic vibrant electric indigo with ultra-clean lilac accents'
  },
  {
    id: 'nordic_frost',
    name: 'Nordic Frost',
    primaryColor: '#0ea5e9',
    themeMode: 'light',
    canvasBg: 'bg-[#f0f9ff]',
    topBubbleBg: 'bg-[#e0f2fe]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#0ea5e9',
    cardBgHex: '#f0f9ff',
    headerBgHex: '#e0f2fe',
    borderHex: '#bae6fd',
    description: 'Cool Scandinavian ice blue with crisp minimal styling'
  },
  {
    id: 'amber_glow',
    name: 'Amber Glow',
    primaryColor: '#d97706',
    themeMode: 'light',
    canvasBg: 'bg-[#fffbeb]',
    topBubbleBg: 'bg-[#fef3c7]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#d97706',
    cardBgHex: '#fffbeb',
    headerBgHex: '#fef3c7',
    borderHex: '#fde68a',
    description: 'Warm honey caramel and golden twilight aesthetic'
  },
  {
    id: 'matcha_zen',
    name: 'Matcha Zen',
    primaryColor: '#16a34a',
    themeMode: 'light',
    canvasBg: 'bg-[#f2f9f4]',
    topBubbleBg: 'bg-[#dcfce7]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#16a34a',
    cardBgHex: '#f2f9f4',
    headerBgHex: '#dcfce7',
    borderHex: '#bbf7d0',
    description: 'Organic soothing matcha green with crisp botanical leaf accents'
  },
  {
    id: 'lavender_mist',
    name: 'Lavender Mist',
    primaryColor: '#9333ea',
    themeMode: 'light',
    canvasBg: 'bg-[#faf5ff]',
    topBubbleBg: 'bg-[#f3e8ff]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#9333ea',
    cardBgHex: '#faf5ff',
    headerBgHex: '#f3e8ff',
    borderHex: '#e9d5ff',
    description: 'Delicate wisteria blossom with royal purple accents'
  },
  {
    id: 'oceanic_wave',
    name: 'Oceanic Wave',
    primaryColor: '#0d9488',
    themeMode: 'light',
    canvasBg: 'bg-[#f0fdfa]',
    topBubbleBg: 'bg-[#ccfbf1]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#0d9488',
    cardBgHex: '#f0fdfa',
    headerBgHex: '#ccfbf1',
    borderHex: '#99f6e4',
    description: 'Deep marine navy and soothing seafoam turquoise'
  },
  {
    id: 'monochrome_pro',
    name: 'Monochrome Pro',
    primaryColor: '#18181b',
    themeMode: 'light',
    canvasBg: 'bg-[#f8fafc]',
    topBubbleBg: 'bg-[#f1f5f9]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#18181b',
    cardBgHex: '#f8fafc',
    headerBgHex: '#f1f5f9',
    borderHex: '#e2e8f0',
    description: 'Architectural titanium grayscale for minimalist stores'
  },
  {
    id: 'cherry_blossom',
    name: 'Cherry Blossom',
    primaryColor: '#db2777',
    themeMode: 'light',
    canvasBg: 'bg-[#fdf2f8]',
    topBubbleBg: 'bg-[#fce7f3]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#db2777',
    cardBgHex: '#fdf2f8',
    headerBgHex: '#fce7f3',
    borderHex: '#fbcfe8',
    description: 'Playful Japanese sakura petals with magenta buttons'
  }
];

interface DeploymentItem {
  id: string;
  agent_id: string;
  name?: string;
  channel: 'WEBSITE' | 'MOBILE_SDK' | 'REST_API' | 'CUSTOM' | 'IFRAME';
  environment: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT';
  public_key: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  allowed_domains: string[];
  sessions_count?: number;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  payload?: any;
}

export default function DeploymentsWorkspacePage() {
  const cached = getClientCachedData<{ deployments: DeploymentItem[] }>('/api/deployments');
  const [deployments, setDeployments] = useState<DeploymentItem[]>(() => cached?.deployments || []);
  const [loading, setLoading] = useState(!cached);
  const [activeTab, setActiveTab] = useState<TabType>('appearance');
  const [activeSnippet, setActiveSnippet] = useState<SnippetType>('html');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  // Creation form state
  const [newDepName, setNewDepName] = useState('');
  const [newChannel, setNewChannel] = useState<'WEBSITE' | 'MOBILE_SDK' | 'REST_API' | 'IFRAME'>('WEBSITE');
  const [newEnvironment, setNewEnvironment] = useState<'PRODUCTION' | 'STAGING'>('PRODUCTION');
  const [newDomain, setNewDomain] = useState('shopmate.internal');
  const [creating, setCreating] = useState(false);

  // Theme Presets State (from user reference image)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('mint_breeze');

  // Appearance settings state (matching reference image)
  const [primaryColor, setPrimaryColor] = useState('#ec4899');
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [position, setPosition] = useState<'bottom_right' | 'bottom_left'>('bottom_right');
  const [launcherShape, setLauncherShape] = useState<LauncherShape>('teardrop');
  const [launcherIcon, setLauncherIcon] = useState<LauncherIcon>('sparkles');
  const [launcherText, setLauncherText] = useState('Chat with us');
  const [bottomPadding, setBottomPadding] = useState('20');
  const [sidePadding, setSidePadding] = useState('20');

  // Content settings state
  const [assistantName, setAssistantName] = useState('Blue Tyga AI Concierge');
  const [headerTitle, setHeaderTitle] = useState('Blue Tyga Store');
  const [headerSubtitle, setHeaderSubtitle] = useState('We usually reply in a few seconds');
  const [greetingMessage, setGreetingMessage] = useState("Hello! 👋 I'm ShopMate, your AI shopping concierge for Blue Tyga. How can I help you today?");
  const [starterQuestions, setStarterQuestions] = useState<string[]>([
    "Show UPF 50+ Sunscreen Jackets",
    "Track order #10482",
    "What is your 7-day exchange policy?",
    "Do you have Travel Joggers?"
  ]);
  const [newQuestionInput, setNewQuestionInput] = useState('');

  // General settings state
  const [corsDomains, setCorsDomains] = useState("your-store.com, *.myshopify.com, localhost:3000");
  const [showBranding, setShowBranding] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [rateLimit, setRateLimit] = useState("60");

  // Live preview chat state
  const [isWidgetOpen, setIsWidgetOpen] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_greet_0',
      sender: 'agent',
      text: greetingMessage,
      timestamp: 'Just now'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }

    Promise.all([
      fetchWithCache<{ deployments: DeploymentItem[] }>('/api/deployments'),
      fetch('/api/agents/agent_shopmate_01').then(r => r.ok ? r.json() : null).catch(() => null)
    ])
      .then(([d, agentData]) => {
        if (d?.deployments) {
          setDeployments(d.deployments);
        }
        if (agentData?.config) {
          const cfg = agentData.config;
          if (cfg.identity?.name) setAssistantName(cfg.identity.name);
          if (cfg.identity?.brand_name) setHeaderTitle(cfg.identity.brand_name);
          if (cfg.identity?.greeting) setGreetingMessage(cfg.identity.greeting);
          if (cfg.starter_questions && Array.isArray(cfg.starter_questions) && cfg.starter_questions.length > 0) {
            setStarterQuestions(cfg.starter_questions);
          }
          if (cfg.appearance?.primary_color) setPrimaryColor(cfg.appearance.primary_color);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const activeDeployment = deployments[0] || {
    id: 'dep_live_widget_01',
    agent_id: 'agent_shopmate_01',
    name: 'Storefront Live Concierge',
    public_key: 'pk_live_shopmate_98f4e2b10a',
    channel: 'WEBSITE',
    status: 'ACTIVE',
    environment: 'PRODUCTION',
    allowed_domains: ['shopmate.store', 'localhost:3000']
  };

  const agentKey = activeDeployment.public_key || 'pk_live_shopmate_98f4e2b10a';
  const apiUrl = origin || 'https://api.shopmate.ai';

  // Apply theme preset
  const handleSelectThemePreset = (preset: ThemePreset) => {
    setSelectedPresetId(preset.id);
    setPrimaryColor(preset.primaryColor);
    setThemeMode(preset.themeMode);
  };

  // Dynamic code snippets
  const htmlSnippet = `<!-- ShopMate AI Assistant Widget for Your Store -->
<script
  src="${apiUrl}/widget.js"
  data-agent-key="${agentKey}"
  data-api-url="${apiUrl}"
  data-theme-preset="${selectedPresetId}"
  data-position="${position}"
  data-primary-color="${primaryColor}"
  data-theme-mode="${themeMode}"
  data-launcher-text="${launcherText}"
  data-launcher-shape="${launcherShape}"
  data-launcher-icon="${launcherIcon}"
  data-bottom-padding="${bottomPadding}"
  data-side-padding="${sidePadding}"
  data-assistant-name="${assistantName}"
  data-greeting-message="${greetingMessage}"
  data-starter-questions="${starterQuestions.join('||')}"
  defer>
</script>`;

  const reactSnippet = `import { ShopMateChatWidget } from '@shopmate/react-ai';
import '@shopmate/react-ai/dist/styles.css';

export default function App() {
  return (
    <ShopMateChatWidget
      agentKey="${agentKey}"
      apiUrl="${apiUrl}"
      themePreset="${selectedPresetId}"
      position="${position}"
      primaryColor="${primaryColor}"
      themeMode="${themeMode}"
      launcherText="${launcherText}"
      assistantName="${assistantName}"
      greeting="${greetingMessage}"
      starterQuestions={[
        ${starterQuestions.map(q => `"${q}"`).join(',\n        ')}
      ]}
    />
  );
}`;

  const iframeSnippet = `<iframe
  src="${apiUrl}/embed/${activeDeployment.id}?themePreset=${selectedPresetId}&primaryColor=${encodeURIComponent(primaryColor)}&theme=${themeMode}"
  width="420"
  height="680"
  style="border: none; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.15);"
  allow="microphone"
  title="${assistantName}">
</iframe>`;

  const restApiSnippet = `curl -X POST "${apiUrl}/api/v1/agents/${activeDeployment.agent_id || 'agent_shopmate_01'}/chat" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${agentKey}" \\
  -d '{
    "message": "What is your return window for shoes?",
    "customer_identifier": "shopper_anon_881"
  }'`;

  function getActiveSnippetCode() {
    switch (activeSnippet) {
      case 'html': return htmlSnippet;
      case 'react': return reactSnippet;
      case 'iframe': return iframeSnippet;
      case 'rest': return restApiSnippet;
    }
  }

  function handleCopySnippet() {
    navigator.clipboard.writeText(getActiveSnippetCode());
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  }

  async function handleSaveChanges() {
    try {
      const agentId = activeDeployment?.agent_id || 'agent_shopmate_01';
      await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            identity: {
              name: assistantName,
              brand_name: headerTitle,
              greeting: greetingMessage
            },
            appearance: {
              primary_color: primaryColor,
              launcher_icon: launcherIcon,
              position: position === 'bottom_left' ? 'bottom-left' : 'bottom-right',
              widget_title: assistantName,
              show_branding: showBranding
            }
          }
        })
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to save appearance changes:', err);
    }
  }

  function handleAddQuestion() {
    if (newQuestionInput.trim()) {
      setStarterQuestions([...starterQuestions, newQuestionInput.trim()]);
      setNewQuestionInput('');
    }
  }

  function handleRemoveQuestion(idx: number) {
    setStarterQuestions(starterQuestions.filter((_, i) => i !== idx));
  }

  async function handleSendLiveMessage(textToSend?: string) {
    const text = textToSend || chatInput;
    if (!text.trim() || isChatSending) return;

    const userMsg: ChatMessage = {
      id: 'msg_u_' + Date.now(),
      sender: 'user',
      text: text.trim(),
      timestamp: 'Just now'
    };

    setChatMessages(prev => [...prev, userMsg]);
    if (!textToSend) setChatInput('');
    setIsChatSending(true);

    try {
      const res = await fetch(`/api/agents/${activeDeployment.agent_id || 'agent_shopmate_01'}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          deploymentId: activeDeployment.id
        })
      });

      const data = await res.json();
      const botText = data.response || data.message?.content || "I'm checking our catalog inventory right now!";

      setChatMessages(prev => [
        ...prev,
        {
          id: 'msg_a_' + Date.now(),
          sender: 'agent',
          text: botText,
          timestamp: 'Just now',
          payload: data.interactive_payload || data.metadata
        }
      ]);
    } catch {
      setChatMessages(prev => [
        ...prev,
        {
          id: 'msg_a_err_' + Date.now(),
          sender: 'agent',
          text: "I'm online and ready to assist! Let me know if you need help with products or tracking.",
          timestamp: 'Just now'
        }
      ]);
    } finally {
      setIsChatSending(false);
    }
  }

  function handleResetChat() {
    setChatMessages([
      {
        id: 'msg_greet_' + Date.now(),
        sender: 'agent',
        text: greetingMessage,
        timestamp: 'Just now'
      }
    ]);
  }

  const currentPreset = THEME_PRESETS.find(p => p.id === selectedPresetId) || THEME_PRESETS[0];

  return (
    <div className="flex min-h-screen bg-[#f4f5f7] text-zinc-900 antialiased selection:bg-zinc-200 selection:text-zinc-900 font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />

        <main className="flex-1 p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6">
          
          {/* Top Header & Navigation Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
            {/* Tab Navigation */}
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
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
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap relative shadow-2xs ${
                    activeTab === tab.id
                      ? 'text-zinc-900 bg-white border border-zinc-200 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 border border-transparent'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-zinc-900 rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Save Changes Action */}
            <div className="flex items-center gap-3">
              {savedSuccess && (
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Changes saved live
                </span>
              )}
              <button
                onClick={handleSaveChanges}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>

          {/* Main Workspace Split Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Tab Config & Code Snippets (7 Columns) */}
            <div className="xl:col-span-7 space-y-6">
              
              {/* TAB 2: APPEARANCE CONFIGURATION (Exact Match to User Screenshot) */}
              {activeTab === 'appearance' && (
                <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-6 shadow-2xs">
                  
                  {/* AI Agent Appearance Header Section */}
                  <div className="space-y-1 pb-2 border-b border-zinc-100 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-zinc-900 tracking-tight">AI Agent Appearance</h2>
                      <p className="text-xs text-zinc-500">
                        Customize widget themes, brand accent colors, launcher shape, and screen position. All styling syncs in real time.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                      REAL-TIME SYNC
                    </span>
                  </div>

                  {/* 15 Theme Presets */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-1">
                    {THEME_PRESETS.map((preset) => {
                      const isSelected = selectedPresetId === preset.id;
                      return (
                        <div key={preset.id} className="flex flex-col items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectThemePreset(preset)}
                            className={`w-full aspect-[4/4.2] rounded-2xl p-2.5 flex flex-col justify-between transition-all duration-150 cursor-pointer relative overflow-hidden text-left shadow-2xs ${
                              preset.canvasBg
                            } ${
                              isSelected
                                ? 'border-2 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                                : 'border border-zinc-200 hover:border-zinc-300 hover:scale-[1.02]'
                            }`}
                          >
                            {/* Top Bubble */}
                            <div className="flex justify-start w-full pr-6">
                              <div className={`h-4 w-12 rounded-lg ${preset.topBubbleBg} shadow-2xs opacity-90`} />
                            </div>

                            {/* Middle Bubble with Checkmark if Selected */}
                            <div className="flex justify-start w-full">
                              <div className={`h-5 w-16 rounded-xl ${preset.midBubbleBg} flex items-center justify-center text-xs shadow-2xs relative`}>
                                {isSelected && (
                                  <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-bold shadow-xs">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Bottom Input Pill Bar with Dot */}
                            <div className={`h-5 w-full rounded-xl ${preset.inputBg} flex items-center justify-end px-1.5 shadow-2xs border border-zinc-200/40`}>
                              <span 
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: preset.dotColor }}
                              />
                            </div>
                          </button>

                          {/* Theme Label */}
                          <span className={`text-xs font-semibold text-center ${
                            isSelected ? 'text-zinc-900 font-bold' : 'text-zinc-700'
                          }`}>
                            {preset.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Brand Accent Color & Custom Pickers */}
                  <div className="pt-4 border-t border-zinc-100 space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Custom Accent Color</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="color" 
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-10 h-10 rounded-xl cursor-pointer bg-white border border-zinc-200 shadow-2xs"
                        />
                        <input 
                          type="text" 
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-900 font-mono uppercase w-32 focus:outline-none focus:border-zinc-400"
                        />
                        <div className="flex items-center gap-2">
                          {['#7c3aed', '#8b5cf6', '#f97316', '#2563eb', '#ec4899', '#10b981'].map(c => (
                            <button
                              key={c}
                              onClick={() => setPrimaryColor(c)}
                              className={`w-6 h-6 rounded-full border border-zinc-200 transition-transform hover:scale-110 cursor-pointer ${
                                primaryColor === c ? 'ring-2 ring-zinc-900 ring-offset-2' : ''
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Theme Mode */}
                    <div className="space-y-2 pt-2">
                      <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Theme Mode</label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: 'light', label: 'Light Mode' },
                          { id: 'dark', label: 'Dark Mode' },
                          { id: 'auto', label: 'Auto (System)' }
                        ].map(t => (
                          <button
                            key={t.id}
                            onClick={() => setThemeMode(t.id as ThemeMode)}
                            className={`p-3 rounded-xl border text-xs font-semibold transition-all shadow-2xs ${
                              themeMode === t.id
                                ? 'border-zinc-900 bg-zinc-900 text-white'
                                : 'border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Launcher Shape & Icon */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Launcher Shape</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'teardrop', label: 'Teardrop' },
                            { id: 'pill', label: 'Pill Button' },
                            { id: 'circle', label: 'Circle' },
                            { id: 'rounded', label: 'Rounded Square' }
                          ].map(s => (
                            <button
                              key={s.id}
                              onClick={() => setLauncherShape(s.id as LauncherShape)}
                              className={`px-3 py-2 rounded-xl border text-xs font-semibold shadow-2xs ${
                                launcherShape === s.id ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Launcher Icon</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { id: 'sparkles', label: 'Sparkles', icon: Sparkles },
                            { id: 'bot', label: 'Bot', icon: Bot },
                            { id: 'bag', label: 'Store', icon: ShoppingBag },
                            { id: 'help', label: 'Support', icon: HelpCircle }
                          ].map(i => {
                            const IconComp = i.icon;
                            return (
                              <button
                                key={i.id}
                                onClick={() => setLauncherIcon(i.id as LauncherIcon)}
                                className={`p-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 shadow-2xs ${
                                  launcherIcon === i.id ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                                }`}
                              >
                                <IconComp className="w-4 h-4" />
                                <span>{i.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Launcher Text & Position */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Launcher Text</label>
                        <input 
                          type="text" 
                          value={launcherText}
                          onChange={(e) => setLauncherText(e.target.value)}
                          className="w-full px-3.5 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-zinc-400"
                          placeholder="e.g. Chat with us"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Screen Position</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setPosition('bottom_right')}
                            className={`px-3 py-2 rounded-xl border text-xs font-semibold shadow-2xs ${
                              position === 'bottom_right' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                            }`}
                          >
                            Bottom Right
                          </button>
                          <button
                            onClick={() => setPosition('bottom_left')}
                            className={`px-3 py-2 rounded-xl border text-xs font-semibold shadow-2xs ${
                              position === 'bottom_left' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
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

              {/* TAB 1: EMBED CODE */}
              {activeTab === 'embed' && (
                <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xs overflow-hidden">
                  {/* Code Card Header */}
                  <div className="px-6 py-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50">
                    <div className="flex items-center gap-2 text-zinc-900 font-bold text-xs">
                      <Terminal className="w-4 h-4 text-zinc-600" />
                      <span>Embed Installation Snippet</span>
                    </div>

                    {/* Snippet Format Selector */}
                    <div className="flex items-center bg-zinc-200/70 p-1 rounded-xl text-xs">
                      {[
                        { id: 'html', label: 'HTML <script>' },
                        { id: 'react', label: 'React SDK' },
                        { id: 'iframe', label: 'Iframe' },
                        { id: 'rest', label: 'REST API' }
                      ].map(snip => (
                        <button
                          key={snip.id}
                          onClick={() => setActiveSnippet(snip.id as SnippetType)}
                          className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                            activeSnippet === snip.id
                              ? 'bg-white text-zinc-900 shadow-2xs'
                              : 'text-zinc-600 hover:text-zinc-900'
                          }`}
                        >
                          {snip.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Code Content Container */}
                  <div className="p-6 relative font-mono text-xs leading-relaxed overflow-x-auto text-zinc-800 bg-zinc-50/50">
                    <button
                      onClick={handleCopySnippet}
                      className="absolute top-4 right-4 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs z-10 cursor-pointer"
                    >
                      {copiedSnippet ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Copy Snippet</span>
                        </>
                      )}
                    </button>

                    <pre className="text-zinc-800 pr-16 whitespace-pre font-mono selection:bg-zinc-200">
                      <code>{getActiveSnippetCode()}</code>
                    </pre>
                  </div>
                </div>
              )}

              {/* TAB 3: CONTENT & GREETINGS */}
              {activeTab === 'content' && (
                <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-6 shadow-2xs">
                  <div className="border-b border-zinc-100 pb-3">
                    <h3 className="text-sm font-bold text-zinc-900">Content &amp; Suggested Prompts</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">Configure the welcome message, assistant identity, and quick question chips.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-700">Header Main Title</label>
                      <input 
                        type="text" 
                        value={headerTitle}
                        onChange={(e) => setHeaderTitle(e.target.value)}
                        className="w-full px-3.5 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-zinc-400"
                        placeholder="e.g. Customer Support"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-700">Header Subtitle</label>
                      <input 
                        type="text" 
                        value={headerSubtitle}
                        onChange={(e) => setHeaderSubtitle(e.target.value)}
                        className="w-full px-3.5 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-zinc-400"
                        placeholder="e.g. We usually reply in a few seconds"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700">Assistant Name</label>
                    <input 
                      type="text" 
                      value={assistantName}
                      onChange={(e) => setAssistantName(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-zinc-400"
                      placeholder="e.g. ShopMate Assistant"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700">Greeting Welcome Message</label>
                    <textarea 
                      rows={3}
                      value={greetingMessage}
                      onChange={(e) => setGreetingMessage(e.target.value)}
                      className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 resize-none"
                      placeholder="Hello! 👋 How can I help you today?"
                    />
                  </div>

                  {/* Suggested Starter Questions (Chips) */}
                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-semibold text-zinc-700">Suggested Starter Questions</label>
                    
                    <div className="space-y-2">
                      {starterQuestions.map((q, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 shadow-2xs">
                          <span className="flex items-center gap-2">
                            <span>💬</span>
                            {q}
                          </span>
                          <button 
                            onClick={() => handleRemoveQuestion(idx)}
                            className="p-1 text-zinc-400 hover:text-rose-600 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 mt-2">
                      <input 
                        type="text"
                        value={newQuestionInput}
                        onChange={(e) => setNewQuestionInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddQuestion()}
                        placeholder="Add a new suggested question..."
                        className="flex-1 px-3.5 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-zinc-400"
                      />
                      <button
                        onClick={handleAddQuestion}
                        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Question
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: GENERAL & GOVERNANCE */}
              {activeTab === 'general' && (
                <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-6 shadow-2xs">
                  <div className="border-b border-zinc-100 pb-3">
                    <h3 className="text-sm font-bold text-zinc-900">General &amp; Domain Governance</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">Configure allowed origin domains, rate limiting, and widget metadata.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700">Allowed Embedding Domains (CORS)</label>
                    <input 
                      type="text" 
                      value={corsDomains}
                      onChange={(e) => setCorsDomains(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-900 font-mono focus:outline-none focus:border-zinc-400"
                    />
                    <p className="text-[11px] text-zinc-400">Comma-separated list of domains allowed to load this widget token.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center justify-between p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                      <div>
                        <div className="text-xs font-bold text-zinc-900">Show Branding</div>
                        <div className="text-[11px] text-zinc-500">Display "Powered by ShopMate AI"</div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={showBranding}
                        onChange={(e) => setShowBranding(e.target.checked)}
                        className="w-4 h-4 rounded text-zinc-900 bg-white border-zinc-300 focus:ring-zinc-500 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                      <div>
                        <div className="text-xs font-bold text-zinc-900">Sound Effects</div>
                        <div className="text-[11px] text-zinc-500">Play chime on incoming messages</div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={soundEffects}
                        onChange={(e) => setSoundEffects(e.target.checked)}
                        className="w-4 h-4 rounded text-zinc-900 bg-white border-zinc-300 focus:ring-zinc-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: CHANNELS & DEPLOYMENTS LIST */}
              {activeTab === 'channels' && (
                <div className="space-y-4">
                  {deployments.map(dep => (
                    <div 
                      key={dep.id}
                      className="p-5 bg-white rounded-2xl border border-zinc-200 hover:border-zinc-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-900 shadow-2xs">
                          {dep.channel === 'WEBSITE' && <Globe className="w-5 h-5" />}
                          {dep.channel === 'MOBILE_SDK' && <Smartphone className="w-5 h-5" />}
                          {dep.channel === 'REST_API' && <Server className="w-5 h-5" />}
                          {dep.channel === 'IFRAME' && <Code2 className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-900">{dep.name || 'Website Widget'}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {dep.status}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-500 mt-1 flex items-center gap-2 font-mono">
                            <span>Key: {dep.public_key}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setActiveTab('embed');
                          }}
                          className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <Code2 className="w-3.5 h-3.5" /> Embed Code
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: LIVE PREVIEW (Interactive Widget) (5 Columns) */}
            <div className="xl:col-span-5 space-y-3 sticky top-6">
              
              {/* Live Preview Header */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 font-mono">LIVE PREVIEW</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Interactive
                  </span>
                </div>
                <button
                  onClick={handleResetChat}
                  className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Chat
                </button>
              </div>

              {/* Realistic Browser Window Frame */}
              <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden min-h-[620px] flex flex-col relative">
                
                {/* Browser Top Navigation Bar */}
                <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between text-xs text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
                    <span className="ml-2 font-mono text-[11px] text-zinc-600 font-medium">your-store.com</span>
                  </div>
                  <span className="text-[11px] text-zinc-400 hidden sm:inline font-mono">Live Widget Container</span>
                </div>

                {/* Simulated Store Page Content */}
                <div className="flex-1 p-6 bg-[#f4f5f7] relative flex flex-col justify-end">
                  
                  {/* Floating Widget (Rendered with Live Selected Theme Preset) */}
                  {isWidgetOpen ? (
                    <div 
                      className="w-full max-w-[390px] mx-auto rounded-3xl border shadow-xl flex flex-col overflow-hidden animate-fadeIn transition-colors duration-200"
                      style={{
                        backgroundColor: currentPreset.cardBgHex || (currentPreset.themeMode === 'dark' ? '#0f172a' : '#ffffff'),
                        borderColor: currentPreset.borderHex || (currentPreset.themeMode === 'dark' ? '#334155' : '#e4e4e7'),
                        color: currentPreset.themeMode === 'dark' ? '#f8fafc' : '#18181b'
                      }}
                    >
                      
                      {/* Widget Header */}
                      <div 
                        className="p-5 pb-4 border-b relative transition-colors duration-200"
                        style={{
                          backgroundColor: currentPreset.headerBgHex || (currentPreset.themeMode === 'dark' ? '#1e293b' : '#f4f4f5'),
                          borderColor: currentPreset.borderHex || (currentPreset.themeMode === 'dark' ? '#334155' : '#e4e4e7')
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          {/* Brand Pill Badge */}
                          <div 
                            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold shadow-2xs border"
                            style={{
                              backgroundColor: currentPreset.themeMode === 'dark' ? '#1e293b' : '#ffffff',
                              borderColor: currentPreset.borderHex || '#e4e4e7',
                              color: currentPreset.themeMode === 'dark' ? '#ffffff' : '#18181b'
                            }}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                            <span>ShopMate Concierge</span>
                          </div>

                          <button 
                            onClick={() => setIsWidgetOpen(false)}
                            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 transition-colors cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Title & Subtitle */}
                        <h2 className="text-base font-bold tracking-tight" style={{ color: primaryColor }}>
                          {headerTitle}
                        </h2>
                        <p className={`text-xs mt-0.5 ${currentPreset.themeMode === 'dark' ? 'text-slate-400' : 'text-zinc-500'}`}>
                          {headerSubtitle}
                        </p>
                      </div>

                      {/* Chat Messages Thread */}
                      <div className="p-4 space-y-3 max-h-[280px] overflow-y-auto no-scrollbar">
                        {chatMessages.map(msg => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className="max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-2xs border"
                              style={
                                msg.sender === 'user'
                                  ? {
                                      backgroundColor: primaryColor,
                                      borderColor: primaryColor,
                                      color: '#ffffff',
                                      borderTopRightRadius: '4px'
                                    }
                                  : {
                                      backgroundColor: currentPreset.themeMode === 'dark' ? '#1e293b' : '#ffffff',
                                      borderColor: currentPreset.borderHex || '#e4e4e7',
                                      color: currentPreset.themeMode === 'dark' ? '#f1f5f9' : '#18181b',
                                      borderTopLeftRadius: '4px'
                                    }
                              }
                            >
                              {msg.text}

                              {/* Render interactive product payload */}
                              {msg.payload?.data && Array.isArray(msg.payload.data) && (
                                <div className="mt-2 space-y-1.5 pt-1.5 border-t border-zinc-200/40">
                                  {msg.payload.data.slice(0, 2).map((item: any, i: number) => (
                                    <div key={i} className="p-1.5 bg-white/80 rounded-lg border border-zinc-200 text-[11px] flex justify-between shadow-2xs text-zinc-900">
                                      <span className="font-semibold">{item.title}</span>
                                      <span className="font-mono font-bold" style={{ color: primaryColor }}>${item.price}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {isChatSending && (
                          <div className="flex justify-start">
                            <div 
                              className="border rounded-2xl px-4 py-2.5 text-xs flex items-center gap-1.5 shadow-2xs"
                              style={{
                                backgroundColor: currentPreset.themeMode === 'dark' ? '#1e293b' : '#ffffff',
                                borderColor: currentPreset.borderHex || '#e4e4e7',
                                color: currentPreset.themeMode === 'dark' ? '#94a3b8' : '#71717a'
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: primaryColor }} />
                              <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0.2s]" style={{ backgroundColor: primaryColor }} />
                              <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0.4s]" style={{ backgroundColor: primaryColor }} />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Suggested Questions (Chips) */}
                      {chatMessages.length <= 2 && starterQuestions.length > 0 && (
                        <div className="px-4 pb-2 space-y-1.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                            currentPreset.themeMode === 'dark' ? 'text-slate-400' : 'text-zinc-500'
                          }`}>
                            SUGGESTED QUESTIONS:
                          </span>
                          <div className="space-y-1.5">
                            {starterQuestions.map((q, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSendLiveMessage(q)}
                                className="w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-center gap-2 group shadow-2xs hover:scale-[1.01] cursor-pointer"
                                style={{
                                  backgroundColor: currentPreset.themeMode === 'dark' ? '#1e293b' : '#ffffff',
                                  borderColor: currentPreset.borderHex || '#e4e4e7',
                                  color: currentPreset.themeMode === 'dark' ? '#f1f5f9' : '#18181b'
                                }}
                              >
                                <span style={{ color: primaryColor }}>💬</span>
                                <span className="flex-1 truncate">{q}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Chat Input Box */}
                      <div 
                        className="p-3 border-t flex items-center gap-2 transition-colors duration-200"
                        style={{
                          backgroundColor: currentPreset.themeMode === 'dark' ? '#090d16' : (currentPreset.cardBgHex || '#ffffff'),
                          borderColor: currentPreset.borderHex || (currentPreset.themeMode === 'dark' ? '#334155' : '#e4e4e7')
                        }}
                      >
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendLiveMessage()}
                          placeholder="Type your message..."
                          className="flex-1 px-3.5 py-2 rounded-xl text-xs focus:outline-none transition border"
                          style={{
                            backgroundColor: currentPreset.themeMode === 'dark' ? '#1e293b' : '#ffffff',
                            borderColor: currentPreset.borderHex || '#e4e4e7',
                            color: currentPreset.themeMode === 'dark' ? '#ffffff' : '#18181b'
                          }}
                        />
                        <button
                          onClick={() => handleSendLiveMessage()}
                          disabled={!chatInput.trim() || isChatSending}
                          className="p-2 rounded-xl text-white disabled:opacity-40 transition-all shadow-xs cursor-pointer hover:scale-105 active:scale-95"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Optional Branding */}
                      {showBranding && (
                        <div 
                          className="py-1 text-center text-[10px] border-t"
                          style={{
                            backgroundColor: currentPreset.themeMode === 'dark' ? '#090d16' : (currentPreset.cardBgHex || '#f4f4f5'),
                            borderColor: currentPreset.borderHex || (currentPreset.themeMode === 'dark' ? '#1e293b' : '#f4f4f5'),
                            color: currentPreset.themeMode === 'dark' ? '#64748b' : '#a1a1aa'
                          }}
                        >
                          Powered by <span className="font-semibold" style={{ color: currentPreset.themeMode === 'dark' ? '#94a3b8' : '#52525b' }}>ShopMate AI</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Floating Launcher Button Preview */
                    <div className="flex justify-end p-2">
                      <button
                        onClick={() => setIsWidgetOpen(true)}
                        className={`shadow-xl flex items-center gap-2 text-white font-semibold transition-all active:scale-95 cursor-pointer ${
                          launcherShape === 'circle' ? 'w-14 h-14 rounded-full justify-center p-0' :
                          launcherShape === 'pill' ? 'px-5 py-3 rounded-full' :
                          launcherShape === 'rounded' ? 'px-4 py-3 rounded-2xl' :
                          'px-5 py-3 rounded-2xl rounded-br-sm'
                        }`}
                        style={{ backgroundColor: primaryColor }}
                      >
                        {launcherIcon === 'chat' && <MessageSquare className="w-5 h-5" />}
                        {launcherIcon === 'sparkles' && <Sparkles className="w-5 h-5" />}
                        {launcherIcon === 'bot' && <Bot className="w-5 h-5" />}
                        {launcherIcon === 'bag' && <ShoppingBag className="w-5 h-5" />}
                        {launcherIcon === 'help' && <HelpCircle className="w-5 h-5" />}
                        
                        {launcherShape !== 'circle' && (
                          <span className="text-xs">{launcherText}</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}