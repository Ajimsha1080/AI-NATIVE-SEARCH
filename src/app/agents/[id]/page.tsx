'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import { 
  Bot, Play, Save, CheckCircle2, ShieldCheck, Wrench, BookOpen, 
  Layers, Plus, Sparkles, AlertCircle, RefreshCw, Sliders, 
  Globe, MessageSquare, UserCheck, Tag, ShoppingCart, Truck, RotateCcw
} from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { fetchWithCache, getClientCachedData, setClientCachedData } from '@/lib/client-cache';

export default function AgentOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const agentId = resolvedParams.id;
  const cached = getClientCachedData<any>(`/api/agents/${agentId}`);
  const [data, setData] = useState<any>(() => cached || null);
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Tenant Configuration Form States
  const [agentName, setAgentName] = useState(() => cached?.agent?.name || 'ShopMate AI');
  const [brandName, setBrandName] = useState(() => cached?.config?.brand_name || 'Blue Tyga Store');
  const [personality, setPersonality] = useState('Helpful & Professional E-commerce Concierge');
  const [tone, setTone] = useState(() => cached?.config?.personality?.tone || 'Professional & Friendly');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['English', 'Hindi', 'Tamil', 'Spanish']);
  const [systemInstructions, setSystemInstructions] = useState(
    () => cached?.config?.instructions?.system_prompt || `You are ShopMate, the official AI shopping and customer service concierge for Blue Tyga. 
Assist shoppers with product discovery, size recommendations, real-time inventory checks, live order tracking, return & warranty policies, and checkout guidance.
Always be accurate, grounded in verified catalog data and official policy rules. Never invent shipping times or unauthorized discounts.`
  );
  const [greetingMessage, setGreetingMessage] = useState(
    () => cached?.config?.greetingMessage || 'Hello! Welcome to Blue Tyga. How can I help you find techwear products, check order status, or assist with size recommendations today?'
  );
  const [fallbackResponse, setFallbackResponse] = useState(
    'I apologize, but I could not find exact details in our current catalog. Would you like me to connect you with a live specialist or explore our top categories?'
  );
  const [handoffBehavior, setHandoffBehavior] = useState('Escalate after 2 unrecognized intents or when customer requests human agent');

  // 12 Capability Toggles
  const [capabilities, setCapabilities] = useState<{ [key: string]: boolean }>({
    product_search: true,
    product_recommendations: true,
    product_comparison: true,
    inventory_checking: true,
    order_tracking: true,
    cart_management: true,
    returns: true,
    refund_requests: true,
    shipping_info: true,
    faq_answering: true,
    store_policies: true,
    promotions_coupons: true,
  });

  const toggleCapability = (key: string) => {
    setCapabilities(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    fetchWithCache<any>(`/api/agents/${agentId}`)
      .then(d => {
        if (d) {
          setData(d);
          if (d.agent) {
            setAgentName(d.agent.name || 'ShopMate AI');
          }
          if (d.config) {
            if (d.config.identity?.brand_name || d.config.brand_name) setBrandName(d.config.identity?.brand_name || d.config.brand_name);
            if (d.config.instructions?.system_prompt) setSystemInstructions(d.config.instructions.system_prompt);
            if (d.config.personality?.tone) setTone(d.config.personality.tone);
            if (d.config.identity?.greeting || d.config.greetingMessage) setGreetingMessage(d.config.identity?.greeting || d.config.greetingMessage);
            if (d.config.capabilities) setCapabilities(prev => ({ ...prev, ...d.config.capabilities }));
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [agentId]);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const normalizedTone = (tone.toLowerCase().includes('concise') ? 'concise' : tone.toLowerCase().includes('persuasive') ? 'persuasive' : tone.toLowerCase().includes('detailed') ? 'detailed' : tone.toLowerCase().includes('casual') ? 'casual' : tone.toLowerCase().includes('professional') ? 'professional' : 'friendly') as any;
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: { name: agentName },
          config: {
            identity: { name: agentName, brand_name: brandName, greeting: greetingMessage },
            personality: { tone: normalizedTone },
            instructions: { system_prompt: systemInstructions, fallback_response: fallbackResponse },
            capabilities: capabilities
          },
          tool_permissions: [
            { tool_id: 'product_search', is_enabled: capabilities.product_search ?? true, permission_mode: 'ALLOWED' },
            { tool_id: 'inventory_lookup', is_enabled: capabilities.inventory_checking ?? true, permission_mode: 'ALLOWED' },
            { tool_id: 'order_lookup', is_enabled: capabilities.order_tracking ?? true, permission_mode: 'ALLOWED' },
            { tool_id: 'order_tracking', is_enabled: capabilities.order_tracking ?? true, permission_mode: 'ALLOWED' },
            { tool_id: 'cart_lookup', is_enabled: capabilities.cart_management ?? true, permission_mode: 'ALLOWED' },
            { tool_id: 'add_to_cart', is_enabled: capabilities.cart_management ?? true, permission_mode: 'ALLOWED' },
            { tool_id: 'coupon_validation', is_enabled: capabilities.promotions_coupons ?? true, permission_mode: 'ALLOWED' },
            { tool_id: 'return_eligibility', is_enabled: (capabilities.returns || capabilities.refund_requests) ?? true, permission_mode: 'ALLOWED' },
            { tool_id: 'human_handoff', is_enabled: true, permission_mode: 'ALLOWED' }
          ]
        })
      });
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-[#f4f5f7] text-zinc-500 text-xs font-mono items-center justify-center">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-zinc-900 animate-ping"></span>
          <span>Loading Agent Configuration...</span>
        </div>
      </div>
    );
  }

  const capabilityItems = [
    { key: 'product_search', label: 'Product Search', desc: 'Allow natural language and multimodal catalog search', icon: Bot },
    { key: 'product_recommendations', label: 'Product Recommendations', desc: 'Suggest personalized items based on budget & preferences', icon: Sparkles },
    { key: 'product_comparison', label: 'Product Comparison', desc: 'Compare specs, materials, and prices across items', icon: Sliders },
    { key: 'inventory_checking', label: 'Inventory Checking', desc: 'Real-time variant stock lookup via live commerce API', icon: CheckCircle2 },
    { key: 'order_tracking', label: 'Order Tracking', desc: 'Lookup live tracking, carrier, and package status', icon: Truck },
    { key: 'cart_management', label: 'Cart Management', desc: 'Add items, adjust quantities, and generate checkout links', icon: ShoppingCart },
    { key: 'returns', label: 'Returns & Exchanges', desc: 'Check eligibility and generate return procedures', icon: RotateCcw },
    { key: 'refund_requests', label: 'Refund Requests', desc: 'Assist customer with store refund requests', icon: AlertCircle },
    { key: 'shipping_info', label: 'Shipping Information', desc: 'Explain carrier rates, transit times, and international rules', icon: Globe },
    { key: 'faq_answering', label: 'FAQ Answering', desc: 'Instant grounded answers from knowledge base docs', icon: BookOpen },
    { key: 'store_policies', label: 'Store Policies', desc: 'Enforce warranty, privacy, and store terms accurately', icon: ShieldCheck },
    { key: 'promotions_coupons', label: 'Promotions / Coupons', desc: 'Validate and apply active discount codes (e.g. WELCOME10)', icon: Tag },
  ];

  return (
    <div className="flex h-screen bg-[#f4f5f7] text-zinc-900 font-sans antialiased selection:bg-zinc-200 selection:text-zinc-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="max-w-5xl mx-auto space-y-6">
            
            {/* Header with Save Controls */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-xl bg-zinc-900 flex items-center justify-center text-white shadow-xs shrink-0">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-lg font-bold text-zinc-900">{agentName}</h1>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                      LIVE IN PRODUCTION
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Configure identity, personality, conversational boundaries, and live e-commerce capabilities.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Link
                  href="/search"
                  className="px-3.5 py-2 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shadow-2xs"
                >
                  <Play className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Test in Playground</span>
                </Link>
                <button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : savedSuccess ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Changes Saved
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" /> Save Configuration
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 1. General Identity & Brand Persona Configuration */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-5 shadow-2xs">
              <div className="border-b border-zinc-200 pb-3">
                <h2 className="text-sm font-bold text-zinc-900">1. Agent Identity & Brand Persona</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Define your AI concierge name, merchant brand, tone, and spoken languages.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Agent Name</label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Company / Brand Name</label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Personality Archetype</label>
                  <input
                    type="text"
                    value={personality}
                    onChange={(e) => setPersonality(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Conversational Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  >
                    <option value="Professional & Friendly">Professional & Friendly (Recommended)</option>
                    <option value="Luxury & Exclusive">Luxury & Exclusive</option>
                    <option value="Concise & Direct">Concise & Direct</option>
                    <option value="Energetic & Enthusiastic">Energetic & Enthusiastic</option>
                    <option value="Technical & Detailed">Technical & Detailed</option>
                  </select>
                </div>
              </div>

              {/* Supported Languages */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-zinc-700">Supported Languages</label>
                <div className="flex flex-wrap gap-2">
                  {['English', 'Spanish', 'French', 'German', 'Japanese', 'Hindi', 'Portuguese', 'Italian'].map((lang) => {
                    const isSelected = selectedLanguages.includes(lang);
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedLanguages(prev => prev.filter(l => l !== lang));
                          } else {
                            setSelectedLanguages(prev => [...prev, lang]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition shadow-2xs ${
                          isSelected
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-white border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                        }`}
                      >
                        {lang} {isSelected && '✓'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* System Instructions */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold text-zinc-700">System Instructions (Core Prompt)</label>
                <textarea
                  rows={4}
                  value={systemInstructions}
                  onChange={(e) => setSystemInstructions(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 text-xs font-mono text-zinc-900 focus:outline-none focus:border-zinc-400 leading-relaxed"
                />
              </div>

              {/* Greeting & Fallback Responses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Greeting Message</label>
                  <textarea
                    rows={3}
                    value={greetingMessage}
                    onChange={(e) => setGreetingMessage(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl p-3 text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Fallback Response</label>
                  <textarea
                    rows={3}
                    value={fallbackResponse}
                    onChange={(e) => setFallbackResponse(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl p-3 text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  />
                </div>
              </div>

              {/* Human Handoff Behavior */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold text-zinc-700">Human Handoff Trigger & Behavior</label>
                <input
                  type="text"
                  value={handoffBehavior}
                  onChange={(e) => setHandoffBehavior(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                />
              </div>
            </div>

            {/* 2. Agent Capabilities & Commerce Tool Enablement */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-5 shadow-2xs">
              <div className="border-b border-zinc-200 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-zinc-900">2. E-commerce Capabilities (12 Typed Modules)</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Toggle which capabilities the agent is authorized to utilize with customers.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const allEnabled = Object.values(capabilities).every(v => v);
                    const next: { [key: string]: boolean } = {};
                    Object.keys(capabilities).forEach(k => { next[k] = !allEnabled; });
                    setCapabilities(next);
                  }}
                  className="text-xs text-zinc-900 hover:underline font-semibold"
                >
                  {Object.values(capabilities).every(v => v) ? 'Disable All' : 'Enable All'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {capabilityItems.map((item) => {
                  const isEnabled = capabilities[item.key] ?? true;
                  const Icon = item.icon;
                  return (
                    <div 
                      key={item.key}
                      onClick={() => toggleCapability(item.key)}
                      className={`p-4 rounded-2xl border transition cursor-pointer flex items-start justify-between gap-3 shadow-2xs ${
                        isEnabled 
                          ? 'bg-white border-zinc-300' 
                          : 'bg-zinc-50 border-zinc-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-xl ${isEnabled ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-500'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-zinc-900">{item.label}</p>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{item.desc}</p>
                        </div>
                      </div>

                      {/* Switch Toggle */}
                      <div className={`w-9 h-5 rounded-full transition-colors relative shrink-0 mt-0.5 ${isEnabled ? 'bg-zinc-900' : 'bg-zinc-300'}`}>
                        <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-transform ${isEnabled ? 'left-4.5' : 'left-1'}`}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
