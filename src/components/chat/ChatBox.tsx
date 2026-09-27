'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Bot, User, ShoppingBag, Truck, CheckCircle2, RotateCcw, 
  Check, ArrowRight, ExternalLink, RefreshCw, Image as ImageIcon,
  X, ZoomIn, ZoomOut, Maximize2, Download, Eye, Sparkles, MessageSquare
} from 'lucide-react';
import { getThemePreset, ThemePreset } from '@/lib/theme-presets';

interface ChatBoxProps {
  agentId: string;
  agentName?: string;
  brandTitle?: string;
  subtitle?: string;
  initialMessage?: string;
  primaryColor?: string;
  themePreset?: string;
  showBranding?: boolean;
  onClose?: () => void;
  externalTrigger?: { text: string; timestamp: number } | null;
  onTraceUpdate?: (trace: any) => void;
  [key: string]: any;
}

interface ImageModalState {
  url: string;
  title?: string;
  price?: number;
  description?: string;
}

export default function ChatBox({
  agentId,
  agentName = 'ShopMate Concierge',
  brandTitle = 'Blue Tyga',
  subtitle = 'We usually reply in a few seconds',
  initialMessage = "Hello! 👋 I'm ShopMate, your AI shopping concierge for Blue Tyga. How can I help you today?",
  primaryColor = '#ec4899',
  themePreset = 'mint_breeze',
  showBranding = true,
  onClose,
  externalTrigger,
  onTraceUpdate
}: ChatBoxProps) {
  const [messages, setMessages] = useState<any[]>([
    {
      id: 'msg_init',
      role: 'assistant',
      content: initialMessage,
      createdAt: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [addedItem, setAddedItem] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [previewModal, setPreviewModal] = useState<ImageModalState | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Live Theme & Appearance State
  const [activeThemePresetId, setActiveThemePresetId] = useState<string>(themePreset || 'mint_breeze');
  const [activePrimaryColor, setActivePrimaryColor] = useState<string>(primaryColor || '#ec4899');
  const [activeBrandTitle, setActiveBrandTitle] = useState<string>(brandTitle || 'Blue Tyga');
  const [activeAssistantName, setActiveAssistantName] = useState<string>(agentName || 'ShopMate Concierge');
  const [activeSubtitle, setActiveSubtitle] = useState<string>(subtitle || 'We usually reply in a few seconds');
  const [activeShowBranding, setActiveShowBranding] = useState<boolean>(showBranding);
  const [activeStarterQuestions, setActiveStarterQuestions] = useState<string[]>([
    'Show UPF 50+ Sunscreen Jackets',
    'Track order #10482',
    'What is your 7-day exchange policy?',
    'Do you have Travel Joggers?'
  ]);

  useEffect(() => {
    if (agentId) {
      fetch(`/api/agents/${agentId}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.config) {
            const cfg = data.config;
            if (cfg.identity?.greeting) {
              setMessages(prev => {
                if (prev.length === 1 && prev[0].id === 'msg_init') {
                  return [{ ...prev[0], content: cfg.identity.greeting }];
                }
                return prev;
              });
            }
            if (cfg.identity?.brand_name) setActiveBrandTitle(cfg.identity.brand_name);
            else if (cfg.identity?.name) setActiveBrandTitle(cfg.identity.name);

            if (cfg.identity?.name) setActiveAssistantName(cfg.identity.name);
            if (cfg.identity?.description) setActiveSubtitle(cfg.identity.description);

            if (cfg.appearance?.theme_preset) setActiveThemePresetId(cfg.appearance.theme_preset);
            if (cfg.appearance?.primary_color) setActivePrimaryColor(cfg.appearance.primary_color);
            if (cfg.appearance?.show_branding !== undefined) setActiveShowBranding(cfg.appearance.show_branding);
            if (cfg.starter_questions && Array.isArray(cfg.starter_questions) && cfg.starter_questions.length > 0) {
              setActiveStarterQuestions(cfg.starter_questions);
            }
          }
        })
        .catch(() => {});
    }
  }, [agentId]);

  const activePreset: ThemePreset = getThemePreset(activeThemePresetId);

  useEffect(() => {
    if (externalTrigger && externalTrigger.text) {
      handleSend(externalTrigger.text);
    }
  }, [externalTrigger]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewModal(null);
        setZoomScale(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSend = async (textToSend?: string, imageToSend?: string | null) => {
    const text = textToSend || input;
    const currentImage = imageToSend !== undefined ? imageToSend : attachedImage;
    if ((!text.trim() && !currentImage) || loading) return;

    const userMessage = {
      id: 'msg_u_' + Date.now(),
      role: 'user',
      content: text.trim() || 'Visual Product Search',
      imageUrl: currentImage,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    if (!textToSend) setInput('');
    setAttachedImage(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          conversationId,
          imageUrl: currentImage,
          channel: 'web_widget'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get response');

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      if (onTraceUpdate && data.trace) {
        onTraceUpdate(data.trace);
      }

      const botMessage = {
        id: 'msg_a_' + Date.now(),
        role: 'assistant',
        content: data.response || "I'm ready to assist! Let me search our active catalog.",
        metadata: data.interactive_payload || data.metadata || (data.matchedProducts ? { products: data.matchedProducts } : undefined),
        createdAt: new Date().toISOString()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: 'msg_err_' + Date.now(),
          role: 'assistant',
          content: "I'm experiencing a brief network lag. You can retry your question or choose one of the suggested prompts below.",
          createdAt: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (itemTitle: string) => {
    setAddedItem(itemTitle);
    handleSend(`Add ${itemTitle} to my cart`);
    setTimeout(() => setAddedItem(null), 3000);
  };

  const handleResetChat = () => {
    setMessages([{
      id: 'msg_init',
      role: 'assistant',
      content: initialMessage,
      createdAt: new Date().toISOString()
    }]);
    setConversationId(null);
    setAttachedImage(null);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const renderMessageContent = (content: string) => {
    const imgRegex = /!\[(.*?)\]\((.*?)\)/g;
    const parts: Array<{ type: 'text'; value: string } | { type: 'image'; alt: string; url: string }> = [];
    let lastIndex = 0;
    let match;

    while ((match = imgRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: content.substring(lastIndex, match.index) });
      }
      parts.push({ type: 'image', alt: match[1], url: match[2] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
      parts.push({ type: 'text', value: content.substring(lastIndex) });
    }

    if (parts.length === 0) {
      return <span>{content}</span>;
    }

    return (
      <div className="space-y-2">
        {parts.map((p, idx) => {
          if (p.type === 'text') {
            return <p key={idx} className="whitespace-pre-wrap">{p.value}</p>;
          }
          return (
            <div 
              key={idx} 
              onClick={() => { setPreviewModal({ url: p.url, title: p.alt || 'Image Preview' }); setZoomScale(1); }}
              className="relative group rounded-xl overflow-hidden border border-zinc-200 bg-white cursor-pointer max-w-sm my-2 shadow-xs hover:border-zinc-300 transition"
            >
              <img src={p.url} alt={p.alt} className="w-full max-h-56 object-cover" />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                <span className="text-[11px] font-semibold bg-white text-zinc-900 px-3 py-1 rounded-full flex items-center gap-1.5 shadow">
                  <ZoomIn className="w-3.5 h-3.5 text-indigo-600" /> Click to enlarge
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div 
      className="flex flex-col h-full rounded-3xl border overflow-hidden font-sans relative shadow-xl transition-colors duration-200"
      style={{ 
        borderColor: activePreset.borderHex,
        backgroundColor: activePreset.cardBgHex 
      }}
    >
      {/* Widget Header - Exact match to Deploy Preview */}
      <div 
        className="p-5 pb-4 border-b relative transition-colors duration-200 shrink-0"
        style={{ 
          backgroundColor: activePreset.headerBgHex, 
          borderColor: activePreset.borderHex 
        }}
      >
        <div className="flex items-center justify-between mb-2">
          {/* Brand Pill Badge */}
          <div 
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold shadow-2xs border"
            style={{
              backgroundColor: activePreset.themeMode === 'dark' ? '#1e293b' : '#ffffff',
              borderColor: activePreset.borderHex || '#e4e4e7',
              color: activePreset.themeMode === 'dark' ? '#ffffff' : '#18181b'
            }}
          >
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: activePrimaryColor }} />
            <span>{activeAssistantName || 'ShopMate Concierge'}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleResetChat}
              title="Reset conversation"
              className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-black/5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            {onClose && (
              <button 
                type="button"
                onClick={onClose}
                title="Close chat"
                className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-black/5 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Title & Subtitle */}
        <h2 className="text-xl font-bold tracking-tight" style={{ color: activePrimaryColor }}>
          {activeBrandTitle}
        </h2>
        <p className={`text-xs mt-0.5 ${activePreset.themeMode === 'dark' ? 'text-slate-400' : 'text-zinc-500'}`}>
          {activeSubtitle}
        </p>
      </div>

      {/* Message Transcript Thread */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-3 transition-colors duration-200"
        style={{ backgroundColor: activePreset.cardBgHex }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex flex-col gap-1.5 max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              {m.imageUrl && (
                <div 
                  onClick={() => { if (m.imageUrl) { setPreviewModal({ url: m.imageUrl, title: 'Uploaded Image' }); setZoomScale(1); } }}
                  className="rounded-xl overflow-hidden border border-zinc-200 max-w-[240px] cursor-pointer group relative shadow-xs"
                >
                  <img src={m.imageUrl} alt="Attached" className="w-full h-auto max-h-48 object-cover rounded-xl" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/opacity-100 transition flex items-center justify-center">
                    <span className="text-[10px] font-mono text-zinc-900 bg-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                      <ZoomIn className="w-3 h-3" /> Inspect
                    </span>
                  </div>
                </div>
              )}

              <div
                className="rounded-2xl px-4 py-3 text-xs leading-relaxed break-words shadow-2xs border"
                style={
                  m.role === 'user'
                    ? {
                        backgroundColor: activePrimaryColor,
                        borderColor: activePrimaryColor,
                        color: '#ffffff',
                        borderTopRightRadius: '4px'
                      }
                    : {
                        backgroundColor: activePreset.themeMode === 'dark' ? '#1e293b' : '#ffffff',
                        borderColor: activePreset.borderHex || '#e4e4e7',
                        color: activePreset.themeMode === 'dark' ? '#f1f5f9' : '#18181b',
                        borderTopLeftRadius: '4px'
                      }
                }
              >
                {renderMessageContent(m.content)}
              </div>

              {/* Dynamic Product Cards */}
              {m.metadata?.products && m.metadata.products.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full mt-1.5">
                  {m.metadata.products.map((p: any) => {
                    const imgSrc = p.imageUrl || p.images?.[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80';
                    return (
                      <div key={p.id} className="bg-white border border-zinc-200 hover:border-zinc-300 transition rounded-2xl p-3 flex flex-col justify-between gap-2.5 shadow-xs group">
                        <div className="flex items-start gap-3">
                          <div 
                            onClick={() => {
                              setPreviewModal({
                                url: imgSrc,
                                title: p.title,
                                price: p.price,
                                description: p.description
                              });
                              setZoomScale(1);
                            }}
                            className="w-16 h-16 rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50 shrink-0 cursor-pointer relative group/thumb"
                            title="Click to view full image details"
                          >
                            <img 
                              src={imgSrc} 
                              alt={p.title}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80';
                              }}
                              className="w-full h-full object-cover group-hover/thumb:scale-105 transition duration-300"
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/thumb:opacity-100 transition flex items-center justify-center">
                              <Eye className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-zinc-900 truncate group-hover:text-indigo-600 transition">{p.title}</p>
                            <p className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">{p.description || p.category}</p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="text-xs font-mono font-bold text-zinc-900">₹{p.price?.toLocaleString('en-IN') || p.price}</span>
                              {p.comparePrice && (
                                <span className="text-[10px] font-mono text-zinc-400 line-through">₹{p.comparePrice?.toLocaleString('en-IN') || p.comparePrice}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-100">
                          <button 
                            onClick={() => {
                              setPreviewModal({
                                url: imgSrc,
                                title: p.title,
                                price: p.price,
                                description: p.description
                              });
                              setZoomScale(1);
                            }}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition flex items-center gap-1 shrink-0"
                            title="View full image details"
                          >
                            <Eye className="w-3 h-3" /> View
                          </button>
                          <button 
                            onClick={() => handleAddToCart(p.title)}
                            style={{ backgroundColor: activePrimaryColor }}
                            className="flex-1 py-1 px-2.5 rounded-lg text-[11px] font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-2xs hover:opacity-90 cursor-pointer"
                          >
                            <ShoppingBag className="w-3 h-3" /> 
                            {addedItem === p.title ? 'Added' : 'Add to Cart'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Dynamic Order Card */}
              {m.metadata?.order && (
                <div className="w-full bg-white border border-zinc-200 rounded-2xl p-3 mt-1 space-y-2 text-xs shadow-xs">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5">
                    <span className="font-bold text-zinc-900 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-zinc-500" /> Order #{m.metadata.order.orderNumber}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200 font-semibold">
                      {m.metadata.order.status}
                    </span>
                  </div>

                  <div className="text-zinc-500 space-y-0.5 text-[11px] font-mono">
                    <p>Carrier: <strong className="text-zinc-800">{m.metadata.order.carrier || 'FedEx Express'}</strong></p>
                    {m.metadata.order.trackingNumber && (
                      <p>Tracking: <span className="text-zinc-800 select-all">{m.metadata.order.trackingNumber}</span></p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div 
            className="border rounded-2xl px-4 py-2.5 text-xs flex items-center gap-1.5 shadow-2xs w-fit"
            style={{
              backgroundColor: activePreset.themeMode === 'dark' ? '#1e293b' : '#ffffff',
              borderColor: activePreset.borderHex || '#e4e4e7',
              color: activePreset.themeMode === 'dark' ? '#94a3b8' : '#71717a'
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: activePrimaryColor }} />
            <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0.2s]" style={{ backgroundColor: activePrimaryColor }} />
            <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0.4s]" style={{ backgroundColor: activePrimaryColor }} />
            <span className="ml-1 text-[11px] font-medium">Checking live catalog &amp; stock...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions Section (Matching Screenshot) */}
      {messages.length <= 2 && activeStarterQuestions.length > 0 && (
        <div className="px-4 pb-2 space-y-1.5 shrink-0">
          <span className={`text-[10px] font-bold uppercase tracking-wider block ${
            activePreset.themeMode === 'dark' ? 'text-slate-400' : 'text-zinc-500'
          }`}>
            SUGGESTED QUESTIONS:
          </span>
          <div className="space-y-1.5">
            {activeStarterQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                className="w-full text-left p-2.5 rounded-2xl border text-xs transition-all flex items-center gap-2 group shadow-2xs hover:scale-[1.01] cursor-pointer"
                style={{
                  backgroundColor: activePreset.themeMode === 'dark' ? '#1e293b' : '#ffffff',
                  borderColor: activePreset.borderHex || '#e4e4e7',
                  color: activePreset.themeMode === 'dark' ? '#f1f5f9' : '#18181b'
                }}
              >
                <span style={{ color: activePrimaryColor }}>💬</span>
                <span className="flex-1 truncate">{q}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Attached Image Preview Bar */}
      {attachedImage && (
        <div className="px-3 py-2 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg border border-zinc-200 overflow-hidden bg-white shrink-0">
              <img src={attachedImage} alt="Preview" className="w-full h-full object-cover" />
            </div>
            <div className="text-xs">
              <p className="text-zinc-900 font-semibold">Image attached for Visual Search</p>
              <p className="text-[10px] text-zinc-500 font-mono">Agent will inspect &amp; match catalog products</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAttachedImage(null)}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Chat Input Bar */}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleSend(); }} 
        className="p-3 border-t flex items-center gap-2 transition-colors duration-200 shrink-0"
        style={{
          backgroundColor: activePreset.themeMode === 'dark' ? '#090d16' : (activePreset.cardBgHex || '#ffffff'),
          borderColor: activePreset.borderHex || (activePreset.themeMode === 'dark' ? '#334155' : '#e4e4e7')
        }}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImageFileChange} 
          accept="image/*" 
          className="hidden" 
        />
        
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Attach image for visual product search"
          className="p-2 rounded-full border transition shrink-0 cursor-pointer shadow-2xs"
          style={{
            backgroundColor: attachedImage ? `${activePrimaryColor}15` : (activePreset.themeMode === 'dark' ? '#1e293b' : '#ffffff'),
            borderColor: attachedImage ? activePrimaryColor : (activePreset.borderHex || '#e4e4e7'),
            color: attachedImage ? activePrimaryColor : '#71717a'
          }}
        >
          <ImageIcon className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={attachedImage ? "Add details about this image or press send..." : "Type your message..."}
          className="flex-1 px-4 py-2.5 rounded-full text-xs focus:outline-none transition border shadow-2xs"
          style={{
            backgroundColor: activePreset.themeMode === 'dark' ? '#1e293b' : '#ffffff',
            borderColor: activePreset.borderHex || '#e4e4e7',
            color: activePreset.themeMode === 'dark' ? '#ffffff' : '#18181b'
          }}
        />

        <button
          type="submit"
          disabled={(!input.trim() && !attachedImage) || loading}
          className="w-9 h-9 rounded-full text-white disabled:opacity-40 transition-all shadow-xs cursor-pointer flex items-center justify-center shrink-0 hover:scale-105 active:scale-95"
          style={{ backgroundColor: activePrimaryColor }}
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Footer Branding */}
      {activeShowBranding && (
        <div 
          className="py-1.5 text-center text-[11px] border-t shrink-0"
          style={{
            backgroundColor: activePreset.themeMode === 'dark' ? '#070e24' : (activePreset.cardBgHex || '#f4f4f5'),
            borderColor: activePreset.borderHex || '#e4e4e7',
            color: activePreset.themeMode === 'dark' ? '#64748b' : '#71717a'
          }}
        >
          Powered by <span className="font-semibold" style={{ color: activePreset.themeMode === 'dark' ? '#94a3b8' : '#3f3f46' }}>ShopMate AI</span>
        </div>
      )}

      {/* High-Resolution Interactive Image Lightbox Modal */}
      {previewModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => { setPreviewModal(null); setZoomScale(1); }}
        >
          <div 
            className="bg-white border border-zinc-200 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between bg-white">
              <div className="min-w-0 pr-4">
                <h3 className="text-sm font-bold text-zinc-900 truncate">{previewModal.title || 'Product Image Preview'}</h3>
                {previewModal.price !== undefined && (
                  <p className="text-xs font-mono font-bold text-emerald-600 mt-0.5">₹{previewModal.price.toLocaleString('en-IN')}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoomScale(prev => Math.max(0.6, prev - 0.25))}
                  className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 cursor-pointer"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono text-zinc-600 font-semibold">{Math.round(zoomScale * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoomScale(prev => Math.min(2.5, prev + 0.25))}
                  className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 cursor-pointer"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <a
                  href={previewModal.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                  title="Open original in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => { setPreviewModal(null); setZoomScale(1); }}
                  className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-zinc-50/70 p-6 flex items-center justify-center min-h-[300px]">
              <div 
                className="transition-transform duration-200 origin-center"
                style={{ transform: `scale(${zoomScale})` }}
              >
                <img 
                  src={previewModal.url} 
                  alt={previewModal.title || 'Preview'} 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&auto=format&fit=crop&q=80';
                  }}
                  className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-xl border border-zinc-200" 
                />
              </div>
            </div>

            {previewModal.title && (
              <div className="px-5 py-3.5 border-t border-zinc-100 bg-white flex items-center justify-between gap-4">
                <p className="text-xs text-zinc-500 line-clamp-1">{previewModal.description || 'High-resolution catalog asset verified by ShopMate Commerce Engine.'}</p>
                <button
                  onClick={() => {
                    handleAddToCart(previewModal.title!);
                    setPreviewModal(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#18181b] text-white hover:bg-[#27272a] text-xs font-semibold flex items-center gap-1.5 transition shrink-0 shadow-xs cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5" /> Add to Cart
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}