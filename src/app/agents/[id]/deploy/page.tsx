'use client';

import React, { useEffect, useState, use } from 'react';
import Navbar from '@/components/layout/Navbar';
import StudioSidebar from '@/components/layout/StudioSidebar';
import { 
  Globe, Code2, Server, Smartphone, Plus, Power, 
  MoreVertical, Check, Copy, RefreshCw, X, Play, 
  Trash2, Key, ShieldCheck, Sparkles, MessageSquare, 
  Palette, FileText, Sliders, ExternalLink, ChevronRight,
  Settings2, Eye, HelpCircle, Layers, CheckCircle2,
  Send, Bot, ShoppingBag, RotateCcw, Terminal
} from 'lucide-react';
import { fetchWithCache, getClientCachedData } from '@/lib/client-cache';

type TabType = 'channels' | 'appearance' | 'content' | 'general' | 'embed';
type SnippetType = 'html' | 'react' | 'iframe' | 'rest';
type LauncherShape = 'teardrop' | 'circle' | 'pill' | 'rounded';
type LauncherIcon = 'chat' | 'sparkles' | 'bot' | 'bag' | 'help';
type ThemeMode = 'dark' | 'light' | 'auto';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  payload?: any;
}

export default function AgentDeployPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const agentId = resolvedParams.id;
  const [deployments, setDeployments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('embed');
  const [activeSnippet, setActiveSnippet] = useState<SnippetType>('html');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  // Appearance settings state (matching reference image)
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [position, setPosition] = useState<'bottom_right' | 'bottom_left'>('bottom_right');
  const [launcherShape, setLauncherShape] = useState<LauncherShape>('teardrop');
  const [launcherIcon, setLauncherIcon] = useState<LauncherIcon>('chat');
  const [launcherText, setLauncherText] = useState('Chat with us');
  const [bottomPadding, setBottomPadding] = useState('20');
  const [sidePadding, setSidePadding] = useState('20');

  // Content settings state (matching reference image)
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
    loadDeployments();
  }, [agentId]);

  useEffect(() => {
    setChatMessages([
      {
        id: 'msg_greet_' + Date.now(),
        sender: 'agent',
        text: greetingMessage,
        timestamp: 'Just now'
      }
    ]);
  }, [greetingMessage]);

  async function loadDeployments() {
    try {
      const [data, agentRes] = await Promise.all([
        fetchWithCache<{ deployments: any[] }>('/api/deployments'),
        fetch(`/api/agents/${agentId}`).then(r => r.json()).catch(() => null)
      ]);
      const list = (data?.deployments || []).filter((dep: any) => dep.agent_id === agentId);
      if (list.length > 0) {
        setDeployments(list);
      } else {
        setDeployments([
          {
            id: `dep_${agentId}_prod`,
            agent_id: agentId,
            name: 'Production Storefront Widget',
            channel: 'WEBSITE',
            environment: 'PRODUCTION',
            public_key: `aas_live_comp_${agentId.replace(/[^a-z0-9]/gi, '')}_9941`,
            status: 'ACTIVE',
            allowed_domains: ['*']
          }
        ]);
      }

      if (agentRes?.agent || agentRes?.config) {
        if (agentRes.agent?.name) setAssistantName(agentRes.agent.name);
        if (agentRes.config?.identity?.name) setAssistantName(agentRes.config.identity.name);
        if (agentRes.config?.identity?.brand_name) setHeaderTitle(agentRes.config.identity.brand_name);
        if (agentRes.config?.identity?.description) setHeaderSubtitle(agentRes.config.identity.description);
        if (agentRes.config?.identity?.greeting) setGreetingMessage(agentRes.config.identity.greeting);
        if (agentRes.config?.starter_questions && Array.isArray(agentRes.config.starter_questions) && agentRes.config.starter_questions.length > 0) {
          setStarterQuestions(agentRes.config.starter_questions);
        }
        if (agentRes.config?.appearance?.primary_color) setPrimaryColor(agentRes.config.appearance.primary_color);
        if (agentRes.config?.appearance?.show_branding !== undefined) setShowBranding(agentRes.config.appearance.show_branding);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const activeDeployment = deployments[0] || {
    id: `dep_${agentId}_prod`,
    public_key: `aas_live_comp_${agentId.replace(/[^a-z0-9]/gi, '')}_9941`
  };

  const agentKey = activeDeployment.public_key || `aas_live_comp_${agentId}_9941`;
  const apiUrl = origin || 'http://localhost:3000';

  const htmlSnippet = `<!-- ShopMate AI Assistant Widget for Your Store -->
<script
  src="${apiUrl}/widget.js"
  data-agent-key="${agentKey}"
  data-api-url="${apiUrl}"
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
  src="${apiUrl}/embed/${activeDeployment.id}?primaryColor=${encodeURIComponent(primaryColor)}&theme=${themeMode}"
  width="420"
  height="680"
  style="border: none; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.25);"
  allow="microphone"
  title="${assistantName}">
</iframe>`;

  const restApiSnippet = `curl -X POST "${apiUrl}/api/v1/agents/${agentId}/chat" \\
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
      await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            identity: {
              name: assistantName,
              brand_name: headerTitle,
              description: headerSubtitle,
              greeting: greetingMessage
            },
            appearance: {
              primary_color: primaryColor,
              launcher_icon: launcherIcon,
              position: position === 'bottom_left' ? 'bottom-left' : 'bottom-right',
              widget_title: assistantName,
              show_branding: showBranding
            },
            starter_questions: starterQuestions
          }
        })
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to save appearance:', err);
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
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim() })
      });

      const data = await res.json();
      const agentMsg: ChatMessage = {
        id: 'msg_a_' + Date.now(),
        sender: 'agent',
        text: data.response || "I'm online to assist you with products and orders!",
        timestamp: 'Just now',
        payload: data.interactive_payload
      };
      setChatMessages(prev => [...prev, agentMsg]);
    } catch {
      setChatMessages(prev => [
        ...prev,
        {
          id: 'msg_a_err_' + Date.now(),
          sender: 'agent',
          text: "I'm ready to help you with store inquiries!",
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

  return (
    <div className="flex min-h-screen bg-[#070b14] text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
      <StudioSidebar agentId={agentId} />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />

        <main className="flex-1 p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6">
          
          {/* Header & Tab Navigation Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
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
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap relative ${
                    activeTab === tab.id
                      ? 'text-white bg-slate-800/90 shadow-sm border border-slate-700/80'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-indigo-500 rounded-full" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {savedSuccess && (
                <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5 animate-fadeIn">
                  <Check className="w-3.5 h-3.5" /> Changes saved live
                </span>
              )}
              <button
                onClick={handleSaveChanges}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-all active:scale-[0.98]"
              >
                <CheckCircle2 className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>

          {/* Main Workspace Split Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Tab Config & Code Snippets */}
            <div className="xl:col-span-7 space-y-6">
              
              {activeTab === 'embed' && (
                <div className="bg-[#0B132B] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0c1633]">
                    <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                      <Terminal className="w-4 h-4 text-indigo-400" />
                      <span>Embed Installation Snippet</span>
                    </div>

                    <div className="flex items-center bg-[#070e24] p-1 rounded-lg border border-slate-800 text-xs">
                      {[
                        { id: 'html', label: 'HTML <script>' },
                        { id: 'react', label: 'React SDK' },
                        { id: 'iframe', label: 'Iframe' },
                        { id: 'rest', label: 'REST API' }
                      ].map(snip => (
                        <button
                          key={snip.id}
                          onClick={() => setActiveSnippet(snip.id as SnippetType)}
                          className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                            activeSnippet === snip.id
                              ? 'bg-slate-700/80 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {snip.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 relative font-mono text-[13px] leading-relaxed overflow-x-auto text-slate-300">
                    <button
                      onClick={handleCopySnippet}
                      className="absolute top-4 right-4 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm z-10"
                    >
                      {copiedSnippet ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    <pre className="text-slate-300 pr-16 whitespace-pre font-mono selection:bg-indigo-900/60">
                      {activeSnippet === 'html' && (
                        <code>
                          <span className="text-slate-500">&lt;!-- ShopMate AI Assistant Widget for Your Store --&gt;</span>{'\n'}
                          <span className="text-pink-400">&lt;script</span>{'\n'}
                          {'  '}<span className="text-sky-300">src</span>=<span className="text-amber-300">"{apiUrl}/widget.js"</span>{'\n'}
                          {'  '}<span className="text-sky-300">data-agent-key</span>=<span className="text-amber-300">"{agentKey}"</span>{'\n'}
                          {'  '}<span className="text-sky-300">data-api-url</span>=<span className="text-amber-300">"{apiUrl}"</span>{'\n'}
                          {'  '}<span className="text-sky-300">data-position</span>=<span className="text-amber-300">"{position}"</span>{'\n'}
                          {'  '}<span className="text-sky-300">data-primary-color</span>=<span className="text-amber-300">"{primaryColor}"</span>{'\n'}
                          {'  '}<span className="text-sky-300">data-theme-mode</span>=<span className="text-amber-300">"{themeMode}"</span>{'\n'}
                          {'  '}<span className="text-sky-300">data-launcher-text</span>=<span className="text-amber-300">"{launcherText}"</span>{'\n'}
                          {'  '}<span className="text-sky-300">data-launcher-shape</span>=<span className="text-amber-300">"{launcherShape}"</span>{'\n'}
                          {'  '}<span className="text-sky-300">data-launcher-icon</span>=<span className="text-amber-300">"{launcherIcon}"</span>{'\n'}
                          {'  '}<span className="text-sky-300">data-bottom-padding</span>=<span className="text-amber-300">"{bottomPadding}"</span>{'\n'}
                          {'  '}<span className="text-sky-300">data-side-padding</span>=<span className="text-amber-300">"{sidePadding}"</span>{'\n'}
                          {'  '}<span className="text-sky-300">data-assistant-name</span>=<span className="text-amber-300">"{assistantName}"</span>{'\n'}
                          {'  '}<span className="text-sky-300">data-greeting-message</span>=<span className="text-amber-300">"{greetingMessage}"</span>{'\n'}
                          {'  '}<span className="text-sky-300">data-starter-questions</span>=<span className="text-amber-300">"{starterQuestions.join('||')}"</span>{'\n'}
                          {'  '}<span className="text-purple-400">defer</span><span className="text-pink-400">&gt;</span>{'\n'}
                          <span className="text-pink-400">&lt;/script&gt;</span>
                        </code>
                      )}

                      {activeSnippet === 'react' && (
                        <code>
                          <span className="text-purple-400">import</span> {'{'} <span className="text-sky-300">ShopMateChatWidget</span> {'}'} <span className="text-purple-400">from</span> <span className="text-amber-300">'@shopmate/react-ai'</span>;{'\n'}
                          <span className="text-purple-400">import</span> <span className="text-amber-300">'@shopmate/react-ai/dist/styles.css'</span>;{'\n\n'}
                          <span className="text-purple-400">export default function</span> <span className="text-yellow-300">App</span>() {'{'}{'\n'}
                          {'  '}<span className="text-purple-400">return</span> ({'\n'}
                          {'    '}<span className="text-pink-400">&lt;ShopMateChatWidget</span>{'\n'}
                          {'      '}<span className="text-sky-300">agentKey</span>=<span className="text-amber-300">"{agentKey}"</span>{'\n'}
                          {'      '}<span className="text-sky-300">apiUrl</span>=<span className="text-amber-300">"{apiUrl}"</span>{'\n'}
                          {'      '}<span className="text-sky-300">primaryColor</span>=<span className="text-amber-300">"{primaryColor}"</span>{'\n'}
                          {'      '}<span className="text-sky-300">themeMode</span>=<span className="text-amber-300">"{themeMode}"</span>{'\n'}
                          {'      '}<span className="text-sky-300">launcherText</span>=<span className="text-amber-300">"{launcherText}"</span>{'\n'}
                          {'      '}<span className="text-sky-300">assistantName</span>=<span className="text-amber-300">"{assistantName}"</span>{'\n'}
                          {'      '}<span className="text-sky-300">greeting</span>=<span className="text-amber-300">"{greetingMessage}"</span>{'\n'}
                          {'      '}<span className="text-sky-300">starterQuestions</span>={'{\n'}
                          {'        '}[{starterQuestions.map(q => `"${q}"`).join(', ')}]{'\n'}
                          {'      }'}{'\n'}
                          {'    '}<span className="text-pink-400">/&gt;</span>{'\n'}
                          {'  '});{'\n'}
                          {'}'}
                        </code>
                      )}

                      {activeSnippet === 'iframe' && (
                        <code>
                          <span className="text-pink-400">&lt;iframe</span>{'\n'}
                          {'  '}<span className="text-sky-300">src</span>=<span className="text-amber-300">"{apiUrl}/embed/{activeDeployment.id}?primaryColor={encodeURIComponent(primaryColor)}&amp;theme={themeMode}"</span>{'\n'}
                          {'  '}<span className="text-sky-300">width</span>=<span className="text-amber-300">"420"</span>{'\n'}
                          {'  '}<span className="text-sky-300">height</span>=<span className="text-amber-300">"680"</span>{'\n'}
                          {'  '}<span className="text-sky-300">style</span>=<span className="text-amber-300">"border: none; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.25);"</span>{'\n'}
                          {'  '}<span className="text-sky-300">title</span>=<span className="text-amber-300">"{assistantName}"</span><span className="text-pink-400">&gt;</span>{'\n'}
                          <span className="text-pink-400">&lt;/iframe&gt;</span>
                        </code>
                      )}

                      {activeSnippet === 'rest' && (
                        <code>
                          <span className="text-emerald-400">curl</span> -X POST <span className="text-amber-300">"{apiUrl}/api/v1/agents/{agentId}/chat"</span> \{'\n'}
                          {'  '}-H <span className="text-amber-300">"Content-Type: application/json"</span> \{'\n'}
                          {'  '}-H <span className="text-amber-300">"Authorization: Bearer {agentKey}"</span> \{'\n'}
                          {'  '}-d <span className="text-yellow-200">'{'{'}
  "message": "What is your return window for shoes?",
  "customer_identifier": "shopper_anon_881"
{'}'}'</span>
                        </code>
                      )}
                    </pre>
                  </div>
                </div>
              )}

              {activeTab === 'appearance' && (
                <div className="bg-[#0B132B] rounded-2xl border border-slate-800 p-6 space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <h3 className="text-base font-semibold text-white">Widget Appearance & Styling</h3>
                    <p className="text-xs text-slate-400 mt-1">Customize the visual presentation, theme colors, and floating launcher.</p>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Brand Accent Color</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-slate-700"
                      />
                      <input 
                        type="text" 
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white font-mono uppercase w-32 focus:outline-none focus:border-indigo-500"
                      />
                      <div className="flex items-center gap-2">
                        {['#4f46e5', '#8b5cf6', '#10b981', '#3b82f6', '#f59e0b', '#ec4899'].map(c => (
                          <button
                            key={c}
                            onClick={() => setPrimaryColor(c)}
                            className="w-6 h-6 rounded-full border border-white/20 transition-transform hover:scale-110"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Theme Mode</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'dark', label: 'Dark Mode' },
                        { id: 'light', label: 'Light Mode' },
                        { id: 'auto', label: 'Auto (System)' }
                      ].map(t => (
                        <button
                          key={t.id}
                          onClick={() => setThemeMode(t.id as ThemeMode)}
                          className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                            themeMode === t.id
                              ? 'border-indigo-500 bg-indigo-500/10 text-white'
                              : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Launcher Shape</label>
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
                            className={`px-3 py-2 rounded-lg border text-xs font-medium ${
                              launcherShape === s.id ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-slate-800 bg-slate-900/60 text-slate-400'
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Launcher Icon</label>
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
                              className={`p-2 rounded-lg border text-xs font-medium flex flex-col items-center gap-1 ${
                                launcherIcon === i.id ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-slate-800 bg-slate-900/60 text-slate-400'
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Launcher Text</label>
                      <input 
                        type="text" 
                        value={launcherText}
                        onChange={(e) => setLauncherText(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Screen Position</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setPosition('bottom_right')}
                          className={`px-3 py-2 rounded-lg border text-xs font-medium ${
                            position === 'bottom_right' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-slate-800 bg-slate-900/60 text-slate-400'
                          }`}
                        >
                          Bottom Right
                        </button>
                        <button
                          onClick={() => setPosition('bottom_left')}
                          className={`px-3 py-2 rounded-lg border text-xs font-medium ${
                            position === 'bottom_left' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-slate-800 bg-slate-900/60 text-slate-400'
                          }`}
                        >
                          Bottom Left
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'content' && (
                <div className="bg-[#0B132B] rounded-2xl border border-slate-800 p-6 space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <h3 className="text-base font-semibold text-white">Content & Suggested Prompts</h3>
                    <p className="text-xs text-slate-400 mt-1">Configure the welcome message, assistant identity, and quick question chips.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Header Main Title</label>
                      <input 
                        type="text" 
                        value={headerTitle}
                        onChange={(e) => setHeaderTitle(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Header Subtitle</label>
                      <input 
                        type="text" 
                        value={headerSubtitle}
                        onChange={(e) => setHeaderSubtitle(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Assistant Name</label>
                    <input 
                      type="text" 
                      value={assistantName}
                      onChange={(e) => setAssistantName(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Greeting Welcome Message</label>
                    <textarea 
                      rows={3}
                      value={greetingMessage}
                      onChange={(e) => setGreetingMessage(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Suggested Starter Questions</label>
                    
                    <div className="space-y-2">
                      {starterQuestions.map((q, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200">
                          <span className="flex items-center gap-2">
                            <span className="text-indigo-400">💬</span>
                            {q}
                          </span>
                          <button 
                            onClick={() => handleRemoveQuestion(idx)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
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
                        className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={handleAddQuestion}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Question
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'general' && (
                <div className="bg-[#0B132B] rounded-2xl border border-slate-800 p-6 space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <h3 className="text-base font-semibold text-white">General & Domain Governance</h3>
                    <p className="text-xs text-slate-400 mt-1">Configure allowed origin domains, rate limiting, and widget metadata.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Allowed Embedding Domains (CORS)</label>
                    <input 
                      type="text" 
                      value={corsDomains}
                      onChange={(e) => setCorsDomains(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                    <p className="text-[11px] text-slate-500">Comma-separated list of domains allowed to load this widget token.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center justify-between p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl">
                      <div>
                        <div className="text-sm font-medium text-white">Show Branding</div>
                        <div className="text-xs text-slate-500">Display "Powered by ShopMate AI"</div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={showBranding}
                        onChange={(e) => setShowBranding(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl">
                      <div>
                        <div className="text-sm font-medium text-white">Sound Effects</div>
                        <div className="text-xs text-slate-500">Play chime on incoming messages</div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={soundEffects}
                        onChange={(e) => setSoundEffects(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'channels' && (
                <div className="space-y-4">
                  {deployments.map(dep => (
                    <div 
                      key={dep.id}
                      className="p-5 bg-[#0B132B] rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                          {dep.channel === 'WEBSITE' && <Globe className="w-5 h-5" />}
                          {dep.channel === 'MOBILE_SDK' && <Smartphone className="w-5 h-5" />}
                          {dep.channel === 'REST_API' && <Server className="w-5 h-5" />}
                          {dep.channel === 'IFRAME' && <Code2 className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{dep.name || 'Website Widget'}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {dep.status || 'ACTIVE'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1 flex items-center gap-2 font-mono">
                            <span>Key: {dep.public_key}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setActiveTab('embed')}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 border border-slate-700"
                        >
                          <Code2 className="w-3.5 h-3.5" /> Embed
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: LIVE PREVIEW (Exact Match to Screenshot) */}
            <div className="xl:col-span-5 space-y-3 sticky top-6">
              
              {/* Live Preview Header */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">LIVE PREVIEW</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Interactive
                  </span>
                </div>
                <button
                  onClick={handleResetChat}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Chat
                </button>
              </div>

              {/* Realistic Browser Window Frame */}
              <div className="bg-[#0f172a] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden min-h-[640px] flex flex-col relative">
                
                {/* Browser Top Navigation Bar */}
                <div className="px-4 py-3 bg-[#090d16] border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 font-mono text-[11px] text-slate-400">your-website.com</span>
                  </div>
                  <span className="text-[11px] text-slate-500 hidden sm:inline">Click launcher or chevron to minimize</span>
                </div>

                {/* Simulated Store Page Content */}
                <div className="flex-1 p-6 bg-gradient-to-b from-slate-900/40 to-[#070b14] relative flex flex-col justify-end">
                  
                  {/* Floating Widget (Rendered in State) */}
                  {isWidgetOpen ? (
                    <div className="w-full max-w-[390px] mx-auto bg-[#0B132B] rounded-2xl border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
                      
                      {/* Widget Header (Matching screenshot banner) */}
                      <div className="p-5 pb-4 bg-[#0c1633] border-b border-slate-800/80 relative">
                        <div className="flex items-center justify-between mb-3">
                          {/* Brand Pill Badge */}
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-xs font-semibold text-white shadow-sm">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                            <span>ShopMate Platform</span>
                          </div>

                          <button 
                            onClick={() => setIsWidgetOpen(false)}
                            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Title & Subtitle */}
                        <h2 className="text-xl font-bold text-white tracking-tight" style={{ color: primaryColor === '#4f46e5' ? '#818cf8' : primaryColor }}>
                          {headerTitle}
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">{headerSubtitle}</p>
                      </div>

                      {/* Chat Messages Thread */}
                      <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto no-scrollbar">
                        {chatMessages.map(msg => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                                msg.sender === 'user'
                                  ? 'bg-indigo-600 text-white rounded-br-none shadow-md'
                                  : 'bg-slate-800/90 text-slate-200 rounded-bl-none border border-slate-700/60'
                              }`}
                            >
                              {msg.text}

                              {msg.payload?.data && Array.isArray(msg.payload.data) && (
                                <div className="mt-2 space-y-1.5 pt-1.5 border-t border-slate-700/60">
                                  {msg.payload.data.slice(0, 2).map((item: any, i: number) => (
                                    <div key={i} className="p-1.5 bg-slate-900/80 rounded border border-slate-700/40 text-[11px] flex justify-between">
                                      <span className="font-medium text-white">{item.title}</span>
                                      <span className="text-emerald-400 font-mono">${item.price}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {isChatSending && (
                          <div className="flex justify-start">
                            <div className="bg-slate-800/90 rounded-2xl px-4 py-2.5 text-xs text-slate-400 flex items-center gap-1.5 border border-slate-700/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Suggested Questions (Chips from Screenshot) */}
                      {chatMessages.length <= 2 && starterQuestions.length > 0 && (
                        <div className="px-4 pb-2 space-y-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            SUGGESTED QUESTIONS:
                          </span>
                          <div className="space-y-1.5">
                            {starterQuestions.map((q, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSendLiveMessage(q)}
                                className="w-full text-left p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/70 text-xs text-slate-200 transition-all flex items-center gap-2 group hover:border-indigo-500/50"
                              >
                                <span className="text-indigo-400 text-xs">💬</span>
                                <span className="flex-1 truncate group-hover:text-white">{q}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Chat Input Box */}
                      <div className="p-3 bg-[#0c1633] border-t border-slate-800/80 flex items-center gap-2">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendLiveMessage()}
                          placeholder="Type your message..."
                          className="flex-1 px-3 py-2 bg-slate-900/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={() => handleSendLiveMessage()}
                          disabled={!chatInput.trim() || isChatSending}
                          className="p-2 rounded-xl text-white disabled:opacity-40 transition-all"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {showBranding && (
                        <div className="py-1 text-center bg-[#070e24] text-[10px] text-slate-500 border-t border-slate-800/60">
                          Powered by <span className="text-slate-400 font-semibold">ShopMate AI</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex justify-end p-2">
                      <button
                        onClick={() => setIsWidgetOpen(true)}
                        className={`shadow-2xl flex items-center gap-2 text-white font-medium transition-all active:scale-95 ${
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
                          <span className="text-xs font-semibold">{launcherText}</span>
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
