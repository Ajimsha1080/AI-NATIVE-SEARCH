'use client';

import React, { useEffect, useState, use } from 'react';
import Navbar from '@/components/layout/Navbar';
import StudioSidebar from '@/components/layout/StudioSidebar';
import { 
  Bot, Save, CheckCircle2, Sliders, Palette, 
  FileText, ShieldAlert, Check, Sparkles 
} from 'lucide-react';

interface ThemePreset {
  id: string;
  name: string;
  isPremium?: boolean;
  primaryColor: string;
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
    id: 'golden_amber',
    name: 'Golden Amber',
    primaryColor: '#d97706',
    canvasBg: 'bg-[#fffbeb]',
    topBubbleBg: 'bg-[#fef3c7]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#d97706',
    cardBgHex: '#fffbeb',
    headerBgHex: '#fef3c7',
    borderHex: '#fde68a',
    description: 'Rich golden honey & warm sunlit amber accents'
  },
  {
    id: 'sunset_bliss',
    name: 'Sunset Bliss',
    primaryColor: '#f97316',
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

export default function AgentDesignPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const agentId = resolvedParams.id;
  const [data, setData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [greeting, setGreeting] = useState('');
  const [tone, setTone] = useState<'friendly' | 'professional' | 'concise' | 'detailed' | 'persuasive' | 'casual'>('friendly');
  const [enthusiasm, setEnthusiasm] = useState(80);
  const [formality, setFormality] = useState(30);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [fallback, setFallback] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#7c3aed');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('cosmic_chills');

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/agents/${agentId}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        if (d.agent) setName(d.agent.name);
        if (d.config) {
          setBrandName(d.config.identity?.brand_name || '');
          setGreeting(d.config.identity?.greeting || '');
          setTone(d.config.personality?.tone || 'friendly');
          setEnthusiasm(d.config.personality?.enthusiasm_level || 80);
          setFormality(d.config.personality?.formality_level || 30);
          setSystemPrompt(d.config.instructions?.system_prompt || '');
          setFallback(d.config.instructions?.fallback_response || '');
          const preset = d.config.appearance?.theme_preset || 'cosmic_chills';
          setSelectedPresetId(preset);
          setPrimaryColor(d.config.appearance?.primary_color || '#7c3aed');
        }
      })
      .catch(() => {});
  }, [agentId]);

  const handleSelectThemePreset = (preset: ThemePreset) => {
    setSelectedPresetId(preset.id);
    setPrimaryColor(preset.primaryColor);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: { name },
          config: {
            identity: { ...data?.config?.identity, name, brand_name: brandName, greeting },
            personality: { ...data?.config?.personality, tone, enthusiasm_level: enthusiasm, formality_level: formality },
            instructions: { ...data?.config?.instructions, system_prompt: systemPrompt, fallback_response: fallback },
            appearance: { ...data?.config?.appearance, primary_color: primaryColor, theme_preset: selectedPresetId }
          }
        })
      });

      if (!res.ok) throw new Error('Failed to save configuration');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f4f5f7] text-zinc-900 font-sans antialiased overflow-hidden selection:bg-zinc-200">
      <StudioSidebar agentId={agentId} agentName={data?.agent?.name} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Design & Identity Studio</h1>
                <p className="text-xs text-zinc-600 mt-1">Configure personality tone, system instructions, and brand appearance presets.</p>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer"
              >
                {saved ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Save className="h-3.5 w-3.5" />}
                <span>{saving ? 'Saving...' : saved ? 'Saved!' : 'Save Configuration'}</span>
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
              {/* 1. Identity & Greeting */}
              <div className="p-6 rounded-2xl bg-white border border-zinc-200 space-y-4 shadow-2xs">
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                  <Bot className="h-4 w-4 text-zinc-500" />
                  <span>1. Agent Identity & Greeting</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">Agent Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">Brand Name</label>
                    <input
                      type="text"
                      value={brandName}
                      onChange={e => setBrandName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">Initial Greeting Message</label>
                  <textarea
                    rows={2}
                    value={greeting}
                    onChange={e => setGreeting(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:bg-white transition leading-relaxed"
                  />
                </div>
              </div>

              {/* 2. Personality & Behavioral Tone */}
              <div className="p-6 rounded-2xl bg-white border border-zinc-200 space-y-5 shadow-2xs">
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-zinc-500" />
                  <span>2. Personality & Behavioral Tone</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {['friendly', 'professional', 'concise', 'detailed', 'persuasive', 'casual'].map((tOption) => (
                    <button
                      key={tOption}
                      type="button"
                      onClick={() => setTone(tOption as any)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold capitalize transition cursor-pointer ${
                        tone === tOption
                          ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                          : 'bg-zinc-50/60 border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-white'
                      }`}
                    >
                      {tOption}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                  <div className="p-4 rounded-xl bg-zinc-50/60 border border-zinc-200/80 space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-zinc-800">Enthusiasm Level</span>
                      <span className="font-mono text-zinc-900 bg-white px-2 py-0.5 rounded border border-zinc-200">{enthusiasm}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={enthusiasm}
                      onChange={e => setEnthusiasm(Number(e.target.value))}
                      className="w-full accent-zinc-900 cursor-pointer"
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-zinc-50/60 border border-zinc-200/80 space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-zinc-800">Formality Level</span>
                      <span className="font-mono text-zinc-900 bg-white px-2 py-0.5 rounded border border-zinc-200">{formality}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={formality}
                      onChange={e => setFormality(Number(e.target.value))}
                      className="w-full accent-zinc-900 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* 3. System Prompt & Instructions */}
              <div className="p-6 rounded-2xl bg-white border border-zinc-200 space-y-4 shadow-2xs">
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="h-4 w-4 text-zinc-500" />
                  <span>3. System Prompt & Instructions</span>
                </h3>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">System Instructions Prompt</label>
                  <textarea
                    rows={6}
                    value={systemPrompt}
                    onChange={e => setSystemPrompt(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-50/50 border border-zinc-200 rounded-xl font-mono text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:bg-white transition leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">Fallback Response</label>
                  <input
                    type="text"
                    value={fallback}
                    onChange={e => setFallback(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* 4. Appearance & Theme Presets */}
              <div className="p-6 rounded-2xl bg-white border border-zinc-200 space-y-6 shadow-2xs">
                <div className="space-y-1 pb-2 border-b border-zinc-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                      <Palette className="h-4 w-4 text-zinc-500" />
                      <span>4. AI Agent Appearance</span>
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Customize widget theme presets and live brand accent styling.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                    SYNCED
                  </span>
                </div>

                {/* 20 Theme Presets Arranged in 4 Columns */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
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

                {/* Custom Brand Accent Color */}
                <div className="pt-4 border-t border-zinc-100 space-y-2">
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
                          type="button"
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
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
