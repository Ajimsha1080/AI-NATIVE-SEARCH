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
  SlidersHorizontal, MessageCircle, Terminal, Crown, HelpCircle as QuestionIcon,
  Image as ImageIcon, Upload, Droplet
} from 'lucide-react';
import { fetchWithCache, getClientCachedData, invalidateClientCache } from '@/lib/client-cache';

type TabType = 'channels' | 'appearance' | 'content' | 'general' | 'embed';
type SnippetType = 'html' | 'react' | 'iframe' | 'rest';
type LauncherShape = 'teardrop' | 'circle' | 'pill';
type LauncherIcon = 'chat' | 'sparkles' | 'bot' | 'bag' | 'help' | 'logo';
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
    id: 'emerald_mint',
    name: 'Emerald Mint',
    primaryColor: '#10b981',
    themeMode: 'light',
    canvasBg: 'bg-[#f0fdf4]',
    topBubbleBg: 'bg-[#dcfce7]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#10b981',
    cardBgHex: '#f0fdf4',
    headerBgHex: '#dcfce7',
    borderHex: '#bbf7d0',
    description: 'Fresh botanic emerald with revitalizing crisp mint accents'
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
    id: 'nordic_slate',
    name: 'Nordic Slate',
    primaryColor: '#475569',
    themeMode: 'light',
    canvasBg: 'bg-[#f8fafc]',
    topBubbleBg: 'bg-[#e2e8f0]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#475569',
    cardBgHex: '#f8fafc',
    headerBgHex: '#e2e8f0',
    borderHex: '#cbd5e1',
    description: 'Cool Scandinavian slate with clean neutral architectural tones'
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
  },
  {
    id: 'sunset_coral',
    name: 'Sunset Coral',
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
    description: 'Radiant warm sunrise coral and golden amber tones'
  },
  {
    id: 'emerald_mint',
    name: 'Emerald Mint',
    primaryColor: '#10b981',
    themeMode: 'light',
    canvasBg: 'bg-[#f0fdf4]',
    topBubbleBg: 'bg-[#dcfce7]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#10b981',
    cardBgHex: '#f0fdf4',
    headerBgHex: '#dcfce7',
    borderHex: '#bbf7d0',
    description: 'Fresh botanic emerald with revitalizing crisp mint accents'
  },
  {
    id: 'terracotta_clay',
    name: 'Terracotta Clay',
    primaryColor: '#ea580c',
    themeMode: 'light',
    canvasBg: 'bg-[#faf5f0]',
    topBubbleBg: 'bg-[#fed7aa]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#ea580c',
    cardBgHex: '#faf5f0',
    headerBgHex: '#ffedd5',
    borderHex: '#fdba74',
    description: 'Earthy artisan terracotta with warm Tuscan pottery tones'
  },
  {
    id: 'arctic_glacier',
    name: 'Arctic Glacier',
    primaryColor: '#06b6d4',
    themeMode: 'light',
    canvasBg: 'bg-[#f0fdff]',
    topBubbleBg: 'bg-[#cffafe]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#06b6d4',
    cardBgHex: '#f0fdff',
    headerBgHex: '#cffafe',
    borderHex: '#a5f3fc',
    description: 'Polar glacial cyan with ultra-crisp alpine ice tones'
  },
  {
    id: 'royal_amethyst',
    name: 'Royal Amethyst',
    primaryColor: '#a855f7',
    themeMode: 'light',
    canvasBg: 'bg-[#faf5ff]',
    topBubbleBg: 'bg-[#f3e8ff]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#a855f7',
    cardBgHex: '#faf5ff',
    headerBgHex: '#f3e8ff',
    borderHex: '#d8b4fe',
    description: 'Regal imperial amethyst purple with sparkling violet accents'
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
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoBackground, setLogoBackground] = useState<'transparent' | 'filled'>('transparent');
  const [bottomPadding, setBottomPadding] = useState('20');
  const [sidePadding, setSidePadding] = useState('20');
  const [appearanceSection, setAppearanceSection] = useState<'all' | 'themes' | 'colors' | 'logo' | 'launcher' | 'position'>('all');
  const [colorSelectionMode, setColorSelectionMode] = useState<'preset' | 'custom'>('preset');
  const [customCardBg, setCustomCardBg] = useState('');
  const [customHeaderBg, setCustomHeaderBg] = useState('');
  const [customBorderColor, setCustomBorderColor] = useState('');
  const [showAdvancedPalette, setShowAdvancedPalette] = useState(false);
  const [showAllThemes, setShowAllThemes] = useState(false);
  const logoInputRef = React.useRef<HTMLInputElement>(null);

  const PRESET_LOGOS = [
    { id: 'shoes', name: 'Sneakers & Sports', url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=120&auto=format&fit=crop&q=80' },
    { id: 'fashion', name: 'Fashion & Apparel', url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=120&auto=format&fit=crop&q=80' },
    { id: 'watch', name: 'Luxury Watches', url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=120&auto=format&fit=crop&q=80' },
    { id: 'tech', name: 'Tech & Gadgets', url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=120&auto=format&fit=crop&q=80' }
  ];

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setLogoUrl(reader.result);
          setLauncherIcon('logo');
          setIsWidgetOpen(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Content settings state
  const [assistantName, setAssistantName] = useState('Blue Tyga AI Concierge');
  const [headerTitle, setHeaderTitle] = useState('Blue Tyga Store');
  const [headerSubtitle, setHeaderSubtitle] = useState('We usually reply in a few seconds');
  const [greetingMessage, setGreetingMessage] = useState("Hello! 👋 I'm ShopMate, your AI shopping concierge for Blue Tyga. How can I help you today?");
  const [starterQuestions, setStarterQuestions] = useState<string[]>([
    "Explore latest collection",
    "Track order #10482",
    "What is your 7-day exchange policy?",
    "Recommend trending styles"
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
          if (cfg.identity?.description) setHeaderSubtitle(cfg.identity.description);
          if (cfg.identity?.greeting) {
            setGreetingMessage(cfg.identity.greeting);
            setChatMessages([
              {
                id: 'msg_greet_0',
                sender: 'agent',
                text: cfg.identity.greeting,
                timestamp: 'Just now'
              }
            ]);
          }
          if (cfg.identity?.avatar_url) setLogoUrl(cfg.identity.avatar_url);
          else if (cfg.appearance?.logo_url) setLogoUrl(cfg.appearance.logo_url);
          if (cfg.starter_questions && Array.isArray(cfg.starter_questions) && cfg.starter_questions.length > 0) {
            setStarterQuestions(cfg.starter_questions);
          }
          if (cfg.appearance?.theme_preset) setSelectedPresetId(cfg.appearance.theme_preset);
          if (cfg.appearance?.theme_mode) setThemeMode(cfg.appearance.theme_mode);
          if (cfg.appearance?.primary_color) setPrimaryColor(cfg.appearance.primary_color);
          if (cfg.appearance?.background_color) setCustomCardBg(cfg.appearance.background_color);
          if (cfg.appearance?.header_background) setCustomHeaderBg(cfg.appearance.header_background);
          if (cfg.appearance?.border_color) setCustomBorderColor(cfg.appearance.border_color);
          if (cfg.appearance?.launcher_icon) setLauncherIcon(cfg.appearance.launcher_icon);
          if (cfg.appearance?.launcher_shape) setLauncherShape(cfg.appearance.launcher_shape);
          if (cfg.appearance?.launcher_text !== undefined) setLauncherText(cfg.appearance.launcher_text);
          if (cfg.appearance?.logo_background) setLogoBackground(cfg.appearance.logo_background);
          if (cfg.appearance?.bottom_padding) setBottomPadding(cfg.appearance.bottom_padding);
          if (cfg.appearance?.side_padding) setSidePadding(cfg.appearance.side_padding);
          if (cfg.appearance?.position) setPosition(cfg.appearance.position === 'bottom-left' || cfg.appearance.position === 'bottom_left' ? 'bottom_left' : 'bottom_right');
          if (cfg.appearance?.show_branding !== undefined) setShowBranding(cfg.appearance.show_branding);
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

  const agentKey = activeDeployment?.public_key || (deployments.length > 0 ? deployments[0].public_key : '');
  const apiUrl = origin || 'https://api.shopmate.ai';

  const currentPreset = THEME_PRESETS.find(p => p.id === selectedPresetId) || THEME_PRESETS[0];
  const activeCardBg = themeMode === 'dark' ? '#0f172a' : (customCardBg || currentPreset.cardBgHex || '#ffffff');
  const activeHeaderBg = themeMode === 'dark' ? '#1e293b' : (customHeaderBg || currentPreset.headerBgHex || '#f4f4f5');
  const activeBorderColor = themeMode === 'dark' ? '#334155' : (customBorderColor || currentPreset.borderHex || '#e4e4e7');

  // Apply theme preset
  const handleSelectThemePreset = (preset: ThemePreset) => {
    setSelectedPresetId(preset.id);
    setPrimaryColor(preset.primaryColor);
    setThemeMode(preset.themeMode);
    setCustomCardBg(preset.cardBgHex);
    setCustomHeaderBg(preset.headerBgHex);
    setCustomBorderColor(preset.borderHex);
  };

  // Reset to original preset template defaults
  const handleResetThemePreset = () => {
    const preset = THEME_PRESETS.find(p => p.id === selectedPresetId) || THEME_PRESETS[0];
    setPrimaryColor(preset.primaryColor);
    setThemeMode(preset.themeMode);
    setCustomCardBg(preset.cardBgHex);
    setCustomHeaderBg(preset.headerBgHex);
    setCustomBorderColor(preset.borderHex);
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
  data-background-color="${customCardBg || currentPreset.cardBgHex || ''}"
  data-header-background="${customHeaderBg || currentPreset.headerBgHex || ''}"
  data-border-color="${customBorderColor || currentPreset.borderHex || ''}"
  data-logo-url="${logoUrl}"
  data-logo-background="${logoBackground}"
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
      backgroundColor="${customCardBg || currentPreset.cardBgHex || ''}"
      headerBackground="${customHeaderBg || currentPreset.headerBgHex || ''}"
      borderColor="${customBorderColor || currentPreset.borderHex || ''}"
      logoUrl="${logoUrl}"
      logoBackground="${logoBackground}"
      launcherText="${launcherText}"
      launcherShape="${launcherShape}"
      launcherIcon="${launcherIcon}"
      assistantName="${assistantName}"
      greeting="${greetingMessage}"
      starterQuestions={[
        ${starterQuestions.map(q => `"${q}"`).join(',\n        ')}
      ]}
    />
  );
}`;

  const iframeSnippet = `<iframe
  src="${apiUrl}/embed/${activeDeployment.id}?themePreset=${selectedPresetId}&primaryColor=${encodeURIComponent(primaryColor)}&theme=${themeMode}${customCardBg ? `&bgColor=${encodeURIComponent(customCardBg)}` : ''}${customHeaderBg ? `&headerBg=${encodeURIComponent(customHeaderBg)}` : ''}${customBorderColor ? `&borderColor=${encodeURIComponent(customBorderColor)}` : ''}${logoUrl ? `&logoUrl=${encodeURIComponent(logoUrl)}` : ''}${logoBackground ? `&logoBg=${logoBackground}` : ''}"
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
              description: headerSubtitle,
              greeting: greetingMessage,
              avatar_url: logoUrl
            },
            appearance: {
              theme_preset: selectedPresetId,
              theme_mode: themeMode,
              primary_color: primaryColor,
              background_color: customCardBg,
              header_background: customHeaderBg,
              border_color: customBorderColor,
              launcher_icon: launcherIcon,
              launcher_shape: launcherShape,
              launcher_text: launcherText,
              logo_url: logoUrl,
              logo_background: logoBackground,
              bottom_padding: bottomPadding,
              side_padding: sidePadding,
              position: position === 'bottom_left' ? 'bottom-left' : 'bottom-right',
              widget_title: assistantName,
              show_branding: showBranding
            },
            starter_questions: starterQuestions
          }
        })
      });
      invalidateClientCache();
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
              
              {/* TAB 2: APPEARANCE CONFIGURATION (Structured List of Sections) */}
              {activeTab === 'appearance' && (
                <div className="space-y-5">
                  
                  {/* AI Agent Appearance Header Section */}
                  <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-bold text-zinc-900 tracking-tight">
                          AI Agent Appearance
                        </h2>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Customize widget themes, brand accent colors, launcher shape, and screen position. All styling syncs in real time.
                        </p>
                      </div>

                      {/* Active Configuration Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-semibold px-2 py-1 rounded-lg text-white font-mono flex items-center gap-1" style={{ backgroundColor: primaryColor }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          {primaryColor}
                        </span>
                        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-700 capitalize font-mono">
                          {launcherShape}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 1: WIDGET THEME & BRAND COLORS */}
                  <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-5 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                      <div>
                        <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                          1. Widget Theme &amp; Brand Colors
                        </h3>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          Select a curated theme template and fine-tune your accent, background, header, and border colors.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAllThemes(!showAllThemes)}
                          className="text-xs font-semibold text-zinc-900 hover:text-zinc-700 bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-xl border border-zinc-200 transition-all cursor-pointer shrink-0 self-start sm:self-auto"
                        >
                          {showAllThemes ? 'Show Less (8)' : 'View All (20) Presets'}
                        </button>
                      </div>
                    </div>

                    {/* Curated Theme Presets Grid */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-zinc-700">Curated Theme Templates</label>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-zinc-500 font-mono">
                            Selected: <span className="font-bold text-zinc-900">{currentPreset.name}</span>
                          </span>
                          <button
                            type="button"
                            onClick={handleResetThemePreset}
                            title="Reset all colors to this template's original design"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 transition-all cursor-pointer"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            Reset Defaults
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {(showAllThemes ? THEME_PRESETS : THEME_PRESETS.slice(0, 8)).map((preset) => {
                          const isSelected = selectedPresetId === preset.id;
                          return (
                            <div key={preset.id} className="flex flex-col items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSelectThemePreset(preset)}
                                className={`w-full aspect-[4/3.6] rounded-xl p-2 flex flex-col justify-between transition-all duration-150 cursor-pointer relative overflow-hidden text-left shadow-2xs ${
                                  preset.canvasBg
                                } ${
                                  isSelected
                                    ? 'border-2 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                                    : 'border border-zinc-200 hover:border-zinc-300 hover:scale-[1.02]'
                                }`}
                              >
                                {/* Top Bubble */}
                                <div className="flex justify-start w-full pr-4">
                                  <div className={`h-3.5 w-10 rounded-md ${preset.topBubbleBg} shadow-2xs opacity-90`} />
                                </div>

                                {/* Middle Bubble with Checkmark if Selected */}
                                <div className="flex justify-start w-full">
                                  <div className={`h-4.5 w-14 rounded-lg ${preset.midBubbleBg} flex items-center justify-center text-xs shadow-2xs relative`}>
                                    {isSelected && (
                                      <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px] font-bold shadow-xs">
                                        <Check className="w-2 h-2 stroke-[3]" />
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Bottom Input Pill Bar with Dot */}
                                <div className={`h-4 w-full rounded-lg ${preset.inputBg} flex items-center justify-end px-1 shadow-2xs border border-zinc-200/40`}>
                                  <span 
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: preset.dotColor }}
                                  />
                                </div>
                              </button>

                              {/* Theme Label */}
                              <span className={`text-[11px] font-semibold text-center truncate w-full ${
                                isSelected ? 'text-zinc-900 font-bold' : 'text-zinc-600'
                              }`}>
                                {preset.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Customize Brand Accent & Mode */}
                    <div className="pt-3 border-t border-zinc-100 grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Primary Accent Color */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-zinc-700">Brand Accent Color</label>
                          <span className="text-[10px] font-mono text-zinc-400">Buttons, bubbles &amp; highlights</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <input 
                            type="color" 
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="w-9 h-9 rounded-xl cursor-pointer bg-white border border-zinc-200 shadow-2xs shrink-0"
                          />
                          <input 
                            type="text" 
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 font-mono uppercase w-28 focus:outline-none focus:border-zinc-400"
                          />
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {['#ec4899', '#7c3aed', '#2563eb', '#10b981', '#f97316', '#0f172a'].map(c => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setPrimaryColor(c)}
                                className={`w-5 h-5 rounded-full border border-zinc-200 transition-transform hover:scale-110 cursor-pointer ${
                                  primaryColor === c ? 'ring-2 ring-zinc-900 ring-offset-2' : ''
                                }`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Theme Mode */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-zinc-700">Theme Mode</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'light', label: 'Light' },
                            { id: 'dark', label: 'Dark' },
                            { id: 'auto', label: 'Auto' }
                          ].map(t => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setThemeMode(t.id as ThemeMode)}
                              className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all shadow-2xs cursor-pointer ${
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
                    </div>

                    {/* ADVANCED TEMPLATE CUSTOMIZATION ACCORDION */}
                    <div className="pt-3 border-t border-zinc-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setShowAdvancedPalette(!showAdvancedPalette)}
                          className="flex items-center gap-2 text-xs font-bold text-zinc-900 hover:text-zinc-700 transition-colors cursor-pointer"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-600" />
                          <span>Advanced Template Palette Customization</span>
                          <span className="text-[10px] font-normal text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200">
                            {showAdvancedPalette ? 'Hide Details' : 'Customize Canvas, Header & Border'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={handleResetThemePreset}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 transition-all cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset to Template Defaults
                        </button>
                      </div>

                      {showAdvancedPalette && (
                        <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-4 animate-fadeIn">
                          <p className="text-[11px] text-zinc-500">
                            Fine-tune the individual background, header, and border colors for the <strong className="text-zinc-800">{currentPreset.name}</strong> template.
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* 1. Chat Window Background Color */}
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-zinc-700">Chat Window Background</label>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="color" 
                                  value={customCardBg || currentPreset.cardBgHex || '#ffffff'}
                                  onChange={(e) => setCustomCardBg(e.target.value)}
                                  className="w-8 h-8 rounded-lg cursor-pointer bg-white border border-zinc-200 shadow-2xs shrink-0"
                                />
                                <input 
                                  type="text" 
                                  value={customCardBg || currentPreset.cardBgHex || '#ffffff'}
                                  onChange={(e) => setCustomCardBg(e.target.value)}
                                  className="flex-1 px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono uppercase text-zinc-900 focus:outline-none focus:border-zinc-400"
                                />
                              </div>
                              <div className="flex items-center gap-1 pt-1 flex-wrap">
                                {['#ffffff', '#f4f5f8', '#f0fdf4', '#fdf2f8', '#faf5ff', '#fffbeb'].map(c => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => setCustomCardBg(c)}
                                    className={`w-4 h-4 rounded-full border border-zinc-300 transition-transform hover:scale-110 cursor-pointer ${
                                      (customCardBg || currentPreset.cardBgHex) === c ? 'ring-2 ring-zinc-900' : ''
                                    }`}
                                    style={{ backgroundColor: c }}
                                    title={c}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* 2. Header Background Color */}
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-zinc-700">Header Background</label>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="color" 
                                  value={customHeaderBg || currentPreset.headerBgHex || '#f4f4f5'}
                                  onChange={(e) => setCustomHeaderBg(e.target.value)}
                                  className="w-8 h-8 rounded-lg cursor-pointer bg-white border border-zinc-200 shadow-2xs shrink-0"
                                />
                                <input 
                                  type="text" 
                                  value={customHeaderBg || currentPreset.headerBgHex || '#f4f4f5'}
                                  onChange={(e) => setCustomHeaderBg(e.target.value)}
                                  className="flex-1 px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono uppercase text-zinc-900 focus:outline-none focus:border-zinc-400"
                                />
                              </div>
                              <div className="flex items-center gap-1 pt-1 flex-wrap">
                                {['#f4f4f5', '#ede9fe', '#dcfce7', '#fce7f3', '#e0f2fe', '#fef3c7'].map(c => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => setCustomHeaderBg(c)}
                                    className={`w-4 h-4 rounded-full border border-zinc-300 transition-transform hover:scale-110 cursor-pointer ${
                                      (customHeaderBg || currentPreset.headerBgHex) === c ? 'ring-2 ring-zinc-900' : ''
                                    }`}
                                    style={{ backgroundColor: c }}
                                    title={c}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* 3. Border & Divider Color */}
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-zinc-700">Border &amp; Dividers</label>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="color" 
                                  value={customBorderColor || currentPreset.borderHex || '#e4e4e7'}
                                  onChange={(e) => setCustomBorderColor(e.target.value)}
                                  className="w-8 h-8 rounded-lg cursor-pointer bg-white border border-zinc-200 shadow-2xs shrink-0"
                                />
                                <input 
                                  type="text" 
                                  value={customBorderColor || currentPreset.borderHex || '#e4e4e7'}
                                  onChange={(e) => setCustomBorderColor(e.target.value)}
                                  className="flex-1 px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono uppercase text-zinc-900 focus:outline-none focus:border-zinc-400"
                                />
                              </div>
                              <div className="flex items-center gap-1 pt-1 flex-wrap">
                                {['#e4e4e7', '#ddd6fe', '#bbf7d0', '#fbcfe8', '#bae6fd', '#cbd5e1'].map(c => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => setCustomBorderColor(c)}
                                    className={`w-4 h-4 rounded-full border border-zinc-300 transition-transform hover:scale-110 cursor-pointer ${
                                      (customBorderColor || currentPreset.borderHex) === c ? 'ring-2 ring-zinc-900' : ''
                                    }`}
                                    style={{ backgroundColor: c }}
                                    title={c}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SECTION 2: STOREFRONT LOGO & AVATAR */}
                  <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                      <div>
                        <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                          2. Storefront Logo / Brand Avatar
                        </h3>
                        <p className="text-[11px] text-zinc-500 mt-0.5">Upload brand logo to display on the header and floating launcher button.</p>
                      </div>
                      {logoUrl && (
                        <button
                          type="button"
                          onClick={() => setLogoUrl('')}
                          className="text-xs text-rose-500 hover:text-rose-700 font-semibold cursor-pointer"
                        >
                          Remove Logo
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-1">
                      {/* Logo Thumbnail Preview */}
                      <div className="w-14 h-14 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0 overflow-hidden relative shadow-2xs">
                        {logoUrl ? (
                          <img src={logoUrl} alt="Store Logo" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-zinc-400" />
                        )}
                      </div>

                      {/* File Upload Button & URL Input */}
                      <div className="flex-1 w-full space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="file"
                            ref={logoInputRef}
                            onChange={handleLogoFileUpload}
                            accept="image/*"
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => logoInputRef.current?.click()}
                            className="px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer shrink-0"
                          >
                            <Upload className="w-3.5 h-3.5" /> Upload Image
                          </button>
                          <input
                            type="text"
                            value={logoUrl}
                            onChange={(e) => setLogoUrl(e.target.value)}
                            placeholder="Or paste image URL (e.g. https://.../logo.png)"
                            className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-zinc-400"
                          />
                        </div>

                        {/* Quick Presets */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono text-zinc-400">Presets:</span>
                          {PRESET_LOGOS.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setLogoUrl(p.url);
                                setLauncherIcon('logo');
                                setIsWidgetOpen(false);
                              }}
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                                logoUrl === p.url
                                    ? 'bg-zinc-900 text-white border-zinc-900'
                                    : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border-zinc-200'
                              }`}
                            >
                              {p.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: LAUNCHER BUTTON & SHAPE */}
                  <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4 shadow-2xs">
                    <div className="border-b border-zinc-100 pb-3">
                      <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">3. Floating Launcher Button &amp; Icon</h3>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Configure how the floating widget trigger button appears on your store.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                      {/* Launcher Shape */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-zinc-700">Launcher Shape</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'teardrop', label: 'Teardrop', icon: MessageSquare },
                            { id: 'circle', label: 'Circle' },
                            { id: 'pill', label: 'Pill Button' }
                          ].map(s => {
                            const ShapeIcon = s.icon;
                            return (
                              <button
                                key={s.id}
                                onClick={() => {
                                  setLauncherShape(s.id as LauncherShape);
                                  setIsWidgetOpen(false);
                                }}
                                className={`px-2.5 py-2 rounded-xl border text-xs font-semibold shadow-2xs cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                                  launcherShape === s.id ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                                }`}
                              >
                                {ShapeIcon && <ShapeIcon className="w-3.5 h-3.5" />}
                                <span>{s.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Launcher Icon */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-zinc-700">Launcher Icon</label>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                          {[
                            { id: 'logo', label: 'Logo', icon: ImageIcon },
                            { id: 'chat', label: 'Chat', icon: MessageCircle },
                            { id: 'sparkles', label: 'Sparkles', icon: Sparkles },
                            { id: 'bot', label: 'Bot', icon: Bot },
                            { id: 'bag', label: 'Store', icon: ShoppingBag },
                            { id: 'help', label: 'Support', icon: HelpCircle }
                          ].map(i => {
                            const IconComp = i.icon;
                            return (
                              <button
                                key={i.id}
                                onClick={() => {
                                  setLauncherIcon(i.id as LauncherIcon);
                                  setIsWidgetOpen(false);
                                }}
                                className={`p-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 shadow-2xs cursor-pointer transition-all ${
                                  launcherIcon === i.id ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                                }`}
                              >
                                {i.id === 'logo' && logoUrl ? (
                                  <img src={logoUrl} alt="Logo" className="w-3.5 h-3.5 rounded-full object-cover" />
                                ) : (
                                  <IconComp className="w-3.5 h-3.5" />
                                )}
                                <span className="text-[10px] truncate w-full text-center">{i.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Launcher Text */}
                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-semibold text-zinc-700">Launcher Text Label</label>
                      <input 
                        type="text" 
                        value={launcherText}
                        onChange={(e) => {
                          setLauncherText(e.target.value);
                          setIsWidgetOpen(false);
                        }}
                        className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-zinc-400"
                        placeholder="e.g. Chat with us"
                      />
                    </div>
                  </div>

                  {/* SECTION 4: POSITION & OFFSETS */}
                  <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4 shadow-2xs">
                    <div className="border-b border-zinc-100 pb-3">
                      <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">4. Screen Position &amp; Edge Spacing</h3>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Control where the widget anchors and set pixel distance from screen edges.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                      {/* Position */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-zinc-700">Screen Corner Anchor</label>
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

                      {/* Edge Offsets */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-700">Bottom Offset (px)</label>
                          <input
                            type="number"
                            value={bottomPadding}
                            onChange={(e) => setBottomPadding(e.target.value)}
                            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 font-mono focus:outline-none focus:border-zinc-400"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-700">Side Offset (px)</label>
                          <input
                            type="number"
                            value={sidePadding}
                            onChange={(e) => setSidePadding(e.target.value)}
                            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 font-mono focus:outline-none focus:border-zinc-400"
                          />
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
                    <label className="text-xs font-semibold text-zinc-700">Greeting Welcome Message</label>
                    <textarea 
                      rows={3}
                      value={greetingMessage}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGreetingMessage(val);
                        setChatMessages(prev => {
                          if (prev.length > 0 && prev[0].id.startsWith('msg_greet')) {
                            return [{ ...prev[0], text: val }, ...prev.slice(1)];
                          }
                          return prev;
                        });
                      }}
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 font-mono">LIVE PREVIEW</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Interactive
                  </span>
                </div>

                {/* View Switcher: Chat Window vs Launcher Button */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-zinc-100 p-0.5 rounded-xl border border-zinc-200">
                    <button
                      onClick={() => setIsWidgetOpen(true)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                        isWidgetOpen ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      <MessageSquare className="w-3 h-3" /> Chat Window
                    </button>
                    <button
                      onClick={() => setIsWidgetOpen(false)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                        !isWidgetOpen ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      <Sparkles className="w-3 h-3" /> Launcher Button
                    </button>
                  </div>

                  {isWidgetOpen && (
                    <button
                      onClick={handleResetChat}
                      className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Reset chat history"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
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
                  <span className="text-[11px] text-zinc-400 hidden sm:inline font-mono">
                    {isWidgetOpen ? 'Open Chat Window State' : 'Floating Launcher State'}
                  </span>
                </div>

                {/* Simulated Store Page Content */}
                <div className="flex-1 p-6 bg-[#f4f5f7] relative flex flex-col justify-end">
                  
                  {/* Floating Widget (Rendered with Live Selected Theme Preset) */}
                  {isWidgetOpen ? (
                    <div 
                      className={`w-full max-w-[390px] h-[580px] rounded-3xl border shadow-xl flex flex-col overflow-hidden animate-fadeIn transition-all duration-200 ${
                        position === 'bottom_left' ? 'self-start' : 'self-end'
                      }`}
                      style={{
                        backgroundColor: activeCardBg,
                        borderColor: activeBorderColor,
                        color: themeMode === 'dark' ? '#f8fafc' : '#18181b'
                      }}
                    >
                      
                      {/* Widget Header */}
                      <div 
                        className="p-5 pb-4 border-b relative transition-colors duration-200 shrink-0"
                        style={{
                          backgroundColor: activeHeaderBg,
                          borderColor: activeBorderColor
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          {/* Assistant Status Badge */}
                          <div 
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-2xs border"
                            style={{
                              backgroundColor: themeMode === 'dark' ? '#1e293b' : '#ffffff',
                              borderColor: activeBorderColor,
                              color: themeMode === 'dark' ? '#ffffff' : '#18181b'
                            }}
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>{assistantName || 'ShopMate AI'}</span>
                          </div>

                          <button 
                            onClick={() => setIsWidgetOpen(false)}
                            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 transition-colors cursor-pointer"
                            title="Minimize to floating button"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Title & Subtitle with Logo Avatar */}
                        <div className="flex items-center gap-3">
                          {logoUrl && (
                            <div className="w-9 h-9 rounded-xl overflow-hidden border border-zinc-200/60 shrink-0 shadow-2xs bg-white">
                              <img src={logoUrl} alt={headerTitle} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h2 className="text-base font-bold tracking-tight truncate" style={{ color: primaryColor }}>
                              {headerTitle}
                            </h2>
                            <p className={`text-xs mt-0.5 truncate ${themeMode === 'dark' ? 'text-slate-400' : 'text-zinc-500'}`}>
                              {headerSubtitle}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Chat Messages Thread */}
                      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 no-scrollbar">
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
                                      backgroundColor: themeMode === 'dark' ? '#1e293b' : '#ffffff',
                                      borderColor: activeBorderColor,
                                      color: themeMode === 'dark' ? '#f1f5f9' : '#18181b',
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
                                backgroundColor: themeMode === 'dark' ? '#1e293b' : '#ffffff',
                                borderColor: activeBorderColor,
                                color: themeMode === 'dark' ? '#94a3b8' : '#71717a'
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
                        <div className="px-4 pb-2 space-y-1.5 shrink-0 max-h-[180px] overflow-y-auto">
                          <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                            themeMode === 'dark' ? 'text-slate-400' : 'text-zinc-500'
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
                                  backgroundColor: themeMode === 'dark' ? '#1e293b' : '#ffffff',
                                  borderColor: activeBorderColor,
                                  color: themeMode === 'dark' ? '#f1f5f9' : '#18181b'
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
                        className="p-3 border-t flex items-center gap-2 transition-colors duration-200 shrink-0"
                        style={{
                          backgroundColor: themeMode === 'dark' ? '#090d16' : activeCardBg,
                          borderColor: activeBorderColor
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
                            backgroundColor: themeMode === 'dark' ? '#1e293b' : '#ffffff',
                            borderColor: themeMode === 'dark' ? '#334155' : activeBorderColor,
                            color: themeMode === 'dark' ? '#ffffff' : '#18181b'
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
                          className="py-1 text-center text-[10px] border-t shrink-0"
                          style={{
                            backgroundColor: themeMode === 'dark' ? '#090d16' : activeCardBg,
                            borderColor: themeMode === 'dark' ? '#1e293b' : activeBorderColor,
                            color: themeMode === 'dark' ? '#64748b' : '#a1a1aa'
                          }}
                        >
                          Powered by <span className="font-semibold" style={{ color: themeMode === 'dark' ? '#94a3b8' : '#52525b' }}>ShopMate AI</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Floating Launcher Button Preview */
                    <div className={`flex flex-col p-4 w-full h-[520px] justify-between ${position === 'bottom_left' ? 'items-start' : 'items-end'}`}>
                      <div className="bg-white/90 backdrop-blur-xs border border-zinc-200 rounded-2xl p-3 shadow-2xs max-w-xs text-center space-y-1">
                        <p className="text-xs font-bold text-zinc-900">Live Floating Launcher Preview</p>
                        <p className="text-[11px] text-zinc-500">
                          Shape: <span className="font-semibold capitalize text-zinc-700">{launcherShape}</span> • Icon: <span className="font-semibold capitalize text-zinc-700">{launcherIcon}</span>
                        </p>
                        <p className="text-[10px] text-zinc-400 font-mono">Click button below to open chat</p>
                      </div>

                      <button
                        onClick={() => setIsWidgetOpen(true)}
                        className={`flex items-center gap-2.5 font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                          !launcherText.trim() || launcherShape === 'circle'
                            ? `w-14 h-14 ${
                                launcherShape === 'teardrop' 
                                  ? 'rounded-3xl rounded-br-xs' 
                                  : 'rounded-full'
                              } justify-center p-0`
                            : launcherShape === 'teardrop'
                              ? 'px-5 py-3 rounded-3xl rounded-br-xs'
                              : 'px-5 py-3 rounded-full'
                        } ${
                          (launcherIcon === 'logo' && logoUrl && logoBackground === 'transparent' && (!launcherText.trim() || launcherShape === 'circle'))
                            ? ''
                            : 'shadow-xl text-white'
                        }`}
                        style={{ 
                          backgroundColor: (launcherIcon === 'logo' && logoUrl && logoBackground === 'transparent' && (!launcherText.trim() || launcherShape === 'circle'))
                            ? 'transparent' 
                            : primaryColor 
                        }}
                      >
                        {launcherIcon === 'logo' && (
                          logoUrl ? (
                            (!launcherText.trim() || launcherShape === 'circle') ? (
                              logoBackground === 'transparent' ? (
                                <div className={`relative w-14 h-14 flex items-center justify-center ${
                                  launcherShape === 'teardrop' 
                                    ? 'rounded-3xl rounded-br-xs' 
                                    : 'rounded-full'
                                }`}>
                                  <img 
                                    src={logoUrl} 
                                    alt="Store Logo" 
                                    className={`w-14 h-14 object-cover border-2 border-white shadow-xl ${
                                      launcherShape === 'teardrop' 
                                        ? 'rounded-3xl rounded-br-xs' 
                                        : 'rounded-full'
                                    }`} 
                                  />
                                  <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-xs"></span>
                                </div>
                              ) : (
                                <div className="relative w-11 h-11 flex items-center justify-center">
                                  <img 
                                    src={logoUrl} 
                                    alt="Store Logo" 
                                    className={`w-10 h-10 object-cover border-2 border-white/90 shadow-xs ${
                                      launcherShape === 'teardrop' 
                                        ? 'rounded-2xl rounded-br-xs' 
                                        : 'rounded-full'
                                    }`} 
                                  />
                                  <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                                </div>
                              )
                            ) : (
                              <img 
                                src={logoUrl} 
                                alt="Store Logo" 
                                className="w-6 h-6 object-cover rounded-full border border-white/70 shadow-xs shrink-0" 
                              />
                            )
                          ) : (
                            <ImageIcon className="w-5 h-5 shrink-0" />
                          )
                        )}
                        {launcherIcon === 'chat' && <MessageSquare className="w-5 h-5 shrink-0" />}
                        {launcherIcon === 'sparkles' && <Sparkles className="w-5 h-5 shrink-0" />}
                        {launcherIcon === 'bot' && <Bot className="w-5 h-5 shrink-0" />}
                        {launcherIcon === 'bag' && <ShoppingBag className="w-5 h-5 shrink-0" />}
                        {launcherIcon === 'help' && <HelpCircle className="w-5 h-5 shrink-0" />}
                        
                        {launcherShape !== 'circle' && launcherText.trim() && (
                          <span className="text-xs font-bold tracking-wide">{launcherText}</span>
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