'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import { 
  Send, Bot, User, ShoppingBag, Truck, CheckCircle2, RotateCcw, 
  AlertCircle, Image as ImageIcon, X, ZoomIn, ZoomOut, Eye, ExternalLink
} from 'lucide-react';
import { sanitizeImageUrl, getProductFallbackImage } from '@/lib/utils';
import MarkdownContent from '@/components/chat/MarkdownContent';
import CheckoutModal from '@/components/chat/CheckoutModal';
import { getThemePreset } from '@/lib/theme-presets';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  imageUrl?: string;
  createdAt?: string;
  created_at?: string;
  metadata?: {
    products?: Array<{ id: string; title: string; price: number; comparePrice?: number; handle: string; imageUrl?: string; rating?: number; description?: string }>;
    order?: { id: string; orderNumber?: string; order_number?: string; status: string; carrier?: string; trackingNumber?: string; tracking_number?: string; total?: number; total_amount?: number; currency: string; items: any[] };
    returnStatus?: { eligible: boolean; policy: string; instructions?: string; returnLabelUrl?: string };
    cart?: { id: string; total: number; currency: string; items: any[] };
    razorpay?: { order_id?: string; amount?: number; currency?: string; payment_link?: string; key_id?: string; is_mock?: boolean };
    payment_link?: string;
    paymentGateway?: string;
    data?: any;
    type?: string;
    [key: string]: any;
  };
}

interface ImageModalState {
  url: string;
  title?: string;
  price?: number;
  description?: string;
}

export default function EmbedChatPage({ params }: { params: Promise<{ deploymentId: string }> }) {
  const resolvedParams = use(params);
  const deploymentId = resolvedParams.deploymentId;

  const [loading, setLoading] = useState(true);
  const [deployment, setDeployment] = useState<any>(null);
  const [agent, setAgent] = useState<any>(null);
  const [themePresetId, setThemePresetId] = useState('mint_breeze');
  const [primaryColor, setPrimaryColor] = useState('#ec4899');
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [previewModal, setPreviewModal] = useState<ImageModalState | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [checkoutModal, setCheckoutModal] = useState<{
    isOpen: boolean;
    product: any;
    variant?: any;
    quantity?: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadDeployment() {
      try {
        const res = await fetch(`/api/deployments/resolve?key=${encodeURIComponent(deploymentId)}`);
        if (!res.ok) {
          setError('Deployment configuration not found or inactive.');
          setLoading(false);
          return;
        }
        const data = await res.json();
        const dep = data.deployment;
        if (!dep) {
          setError('Deployment not found');
          setLoading(false);
          return;
        }
        setDeployment(dep);
        
        // Use resolved Agent details
        setAgent(data.agent || { id: dep.agent_id, name: 'ShopMate AI' });

        if (typeof window !== 'undefined') {
          const sp = new URLSearchParams(window.location.search);
          const qPreset = sp.get('themePreset') || sp.get('preset');
          const qColor = sp.get('primaryColor') || sp.get('color');
          const qTheme = sp.get('theme') || sp.get('themeMode');
          const qLogo = sp.get('logoUrl') || sp.get('logo');

          const chosenPresetId = qPreset || data.appearance?.theme_preset || 'mint_breeze';
          const presetObj = getThemePreset(chosenPresetId);
          setThemePresetId(chosenPresetId);
          setPrimaryColor(qColor || data.appearance?.primary_color || presetObj.primaryColor || '#ec4899');
          setThemeMode((qTheme === 'dark' || (!qTheme && data.appearance?.theme_mode === 'dark')) ? 'dark' : 'light');
          setLogoUrl(qLogo || data.appearance?.logo_url || data.agent?.avatar_url || '');
        }
        
        const welcomeMsg = data.welcome_message || 'Hello! I am your AI store concierge. How may I assist you today?';
        setMessages([
          {
            id: 'msg_welcome',
            role: 'assistant',
            content: welcomeMsg,
            createdAt: new Date().toISOString()
          }
        ]);
      } catch (err: any) {
        setError(err.message || 'Failed to initialize agent chat');
      } finally {
        setLoading(false);
      }
    }
    loadDeployment();
  }, [deploymentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle escape key
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
    if ((!text.trim() && !currentImage) || sending || !agent) return;

    const userMsg: Message = {
      id: 'msg_' + Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: text || 'Visual product query',
      imageUrl: currentImage || undefined,
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setAttachedImage(null);
    setSending(true);

    try {
      const res = await fetch(`/api/agents/${agent.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text + (currentImage ? ` [Attached Image: ${currentImage}]` : ''),
          imageUrl: currentImage || undefined,
          conversationId: conversationId || undefined,
          channel: 'website_widget',
          deploymentId: deploymentId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      const convId = data.conversationId || data.conversation_id;
      if (convId && !conversationId) {
        setConversationId(convId);
      }

      const rawProducts = data.interactive_payload?.type === 'PRODUCTS' ? data.interactive_payload.data : data.metadata?.products;
      const products = Array.isArray(rawProducts) ? rawProducts.map((p: any) => ({
        ...p,
        imageUrl: p.imageUrl || p.images?.[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
        images: Array.isArray(p.images) && p.images.length > 0 ? p.images : (p.imageUrl ? [p.imageUrl] : [])
      })) : undefined;

      const order = data.interactive_payload?.type === 'ORDER' ? data.interactive_payload.data : data.metadata?.order;

      const payload = data.interactive_payload || data.metadata;
      const botMsg: Message = {
        id: data.message_id || data.message?.id || 'msg_' + Math.random().toString(36).substring(2, 9),
        role: 'assistant',
        content: data.response || data.message?.content || '',
        created_at: new Date().toISOString(),
        metadata: {
          ...data.metadata,
          products,
          order
        }
      };

      setMessages((prev) => [...prev, botMsg]);

      // Automatically trigger checkout session if AI detected conversational purchase intent
      if (payload?.type === 'CHECKOUT_SESSION' && payload?.data?.product) {
        handleBuyNow(payload.data.product, payload.data.variant, payload.data.quantity || 1);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'msg_err_' + Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          content: 'I apologize, but I encountered an error. Please try again.',
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleBuyNow = (product: any, variant?: any, quantity: number = 1) => {
    setCheckoutModal({
      isOpen: true,
      product,
      variant,
      quantity
    });
  };

  const handleOrderSuccess = (order: any) => {
    const orderNum = order?.order_number || '#ORD-CONFIRMED';
    const orderItem = order?.items?.[0]?.title || 'Selected item';
    const assistantMsg: Message = {
      id: 'msg_ord_' + Date.now(),
      role: 'assistant',
      content: `🎉 **Order Confirmed!** (${orderNum})\n\nThank you for your purchase of **${orderItem}**. A confirmation receipt and tracking updates have been dispatched.`,
      metadata: { order },
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, assistantMsg]);
  };

  const handleAddToCart = (itemTitle: string) => {
    const userMsg = {
      id: 'msg_u_' + Date.now(),
      role: 'user' as const,
      content: `Add ${itemTitle} to my cart`,
      created_at: new Date().toISOString()
    };

    const assistantMsg = {
      id: 'msg_a_' + (Date.now() + 1),
      role: 'assistant' as const,
      content: `🛍️ **${itemTitle}** has been added to your cart! You can continue browsing or proceed to checkout.`,
      created_at: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
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
    return (
      <MarkdownContent
        content={content}
        onImageClick={(url, alt) => {
          setPreviewModal({ url, title: alt || 'Image Preview' });
          setZoomScale(1);
        }}
      />
    );
  };

  const currentPreset = getThemePreset(themePresetId);
  const isDark = themeMode === 'dark';

  if (loading) {
    return (
      <div className={`flex h-screen items-center justify-center text-xs font-mono ${isDark ? 'bg-[#09090b] text-zinc-400' : 'bg-[#f4f5f7] text-zinc-500'}`}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: primaryColor }}></span>
          <span>Initializing ShopMate Storefront Concierge...</span>
        </div>
      </div>
    );
  }

  if (error || !deployment) {
    return (
      <div className={`flex h-screen items-center justify-center p-4 font-sans ${isDark ? 'bg-[#09090b]' : 'bg-[#f4f5f7]'}`}>
        <div className={`max-w-md w-full border rounded-2xl p-6 text-center space-y-3 shadow-sm ${isDark ? 'bg-[#18181b] border-zinc-800' : 'bg-white border-zinc-200'}`}>
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Widget Unavailable</h2>
          <p className="text-xs text-zinc-500">{error || 'Unable to connect to active storefront deployment.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`flex flex-col h-screen max-w-xl mx-auto font-sans border-x relative antialiased ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}
      style={{ backgroundColor: isDark ? '#09090b' : currentPreset.cardBgHex }}
    >
      {/* Widget Header */}
      <div 
        className={`px-5 py-3.5 border-b flex items-center justify-between sticky top-0 z-20 shadow-2xs ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}
        style={{ 
          backgroundColor: isDark ? '#121215' : currentPreset.headerBgHex,
          borderColor: isDark ? '#27272a' : currentPreset.borderHex 
        }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-xs overflow-hidden shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            {logoUrl || agent?.avatar_url ? (
              <img src={logoUrl || agent.avatar_url} alt={agent?.name || 'ShopMate'} className="w-full h-full object-cover" />
            ) : (
              <Bot className="w-4.5 h-4.5" />
            )}
          </div>
          <div>
            <h3 
              className="text-xs font-bold flex items-center gap-1.5"
              style={{ color: isDark ? '#ffffff' : (currentPreset.headerTextColor || primaryColor) }}
            >
              {agent?.name || 'ShopMate Concierge'}
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: primaryColor }}></span>
            </h3>
            <p className="text-[10px] text-zinc-500 font-mono">Live Catalog • Verified Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span 
            className={`hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold ${
              isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-white/80 border-zinc-200 text-zinc-600'
            }`}
          >
            AI Shopping
          </span>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 font-mono text-[10px] shadow-2xs font-bold ${
                m.role === 'user' 
                  ? 'text-white' 
                  : isDark 
                    ? 'bg-zinc-800 text-zinc-200 border border-zinc-700' 
                    : 'bg-white text-zinc-700 border border-zinc-200'
              }`}
              style={m.role === 'user' ? { backgroundColor: primaryColor } : undefined}
            >
              {m.role === 'user' ? 'U' : 'AI'}
            </div>

            <div className={`flex flex-col gap-1.5 max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              {/* User attached image */}
              {m.imageUrl && (
                <div 
                  onClick={() => { setPreviewModal({ url: m.imageUrl!, title: 'Uploaded Image' }); setZoomScale(1); }}
                  className={`rounded-2xl overflow-hidden border max-w-[240px] cursor-pointer group relative shadow-2xs ${
                    isDark ? 'border-zinc-800' : 'border-zinc-200'
                  }`}
                >
                  <img src={m.imageUrl} alt="Attached" className="w-full h-auto max-h-48 object-cover rounded-2xl" />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <span className="text-[10px] font-mono text-zinc-900 bg-white/90 px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold">
                      <ZoomIn className="w-3 h-3" /> Inspect
                    </span>
                  </div>
                </div>
              )}

              <div
                className={`p-3.5 rounded-2xl text-xs leading-relaxed break-words shadow-2xs ${
                  m.role === 'user'
                    ? 'text-white rounded-tr-xs'
                    : isDark
                      ? 'bg-[#18181b] border border-zinc-800 text-zinc-100 rounded-tl-xs'
                      : 'bg-white border border-zinc-200 text-zinc-800 rounded-tl-xs'
                }`}
                style={m.role === 'user' ? { backgroundColor: primaryColor } : undefined}
              >
                {renderMessageContent(m.content)}
              </div>

              {/* Dynamic Product Cards */}
              {m.metadata?.products && m.metadata.products.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full mt-1.5">
                  {m.metadata.products.map((p) => {
                    const fallbackImg = getProductFallbackImage(p.title);
                    const rawImg = p.imageUrl;
                    const imgSrc = (rawImg && !rawImg.includes('red_shirt.jpg') && !rawImg.includes('saree.jpg') && !rawImg.includes('corduroy.jpg')) ? rawImg : fallbackImg;
                    return (
                      <div 
                        key={p.id} 
                        className={`border hover:border-zinc-400 transition rounded-2xl p-3.5 flex flex-col justify-between gap-3 shadow-2xs group ${
                          isDark ? 'bg-[#18181b] border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Image thumbnail with zoom trigger */}
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
                            className={`w-16 h-16 rounded-xl border flex items-center justify-center shrink-0 overflow-hidden cursor-pointer relative group/img shadow-2xs ${
                              isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-100 border-zinc-200'
                            }`}
                            title="Click to view full HD image"
                          >
                            <img 
                              src={imgSrc} 
                              alt={p.title} 
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = fallbackImg;
                              }}
                              className="w-full h-full object-cover group-hover/img:scale-110 transition duration-300" 
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center">
                              <Eye className="w-4 h-4 text-white" />
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-bold truncate transition ${isDark ? 'text-white group-hover:text-zinc-300' : 'text-zinc-900 group-hover:text-zinc-700'}`}>{p.title}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-xs font-mono font-bold" style={{ color: primaryColor }}>₹{p.price?.toLocaleString('en-IN') || p.price}</span>
                              {p.comparePrice && (
                                <span className="text-[10px] font-mono text-zinc-400 line-through">₹{p.comparePrice?.toLocaleString('en-IN') || p.comparePrice}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className={`grid grid-cols-3 gap-1.5 pt-2 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
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
                            className={`px-2 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-semibold transition flex items-center justify-center gap-1 shrink-0 ${
                              isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                            }`}
                            title="View full image"
                          >
                            <Eye className="w-3.5 h-3.5" /> <span className="truncate">View Photo</span>
                          </button>
                          <button 
                            onClick={() => handleBuyNow(p)}
                            style={{ backgroundColor: primaryColor }}
                            className="px-2 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-semibold text-white transition flex items-center justify-center gap-1 shadow-xs cursor-pointer hover:opacity-90 active:scale-95"
                            title="Instant Checkout"
                          >
                            <span className="truncate">Buy Now</span>
                          </button>
                          <button 
                            onClick={() => handleAddToCart(p.title)}
                            className={`px-2 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-semibold transition flex items-center justify-center gap-1 shadow-xs cursor-pointer active:scale-95 ${
                              isDark ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700' : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200 border border-zinc-200'
                            }`}
                            title="Add item to cart"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" /> <span className="truncate">Add to Cart</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Dynamic Razorpay Agentic Payment Link Card */}
              {(m.metadata?.razorpay?.payment_link || m.metadata?.payment_link || (m.metadata as any)?.data?.razorpay || (m.metadata as any)?.paymentGateway === 'RAZORPAY') && (
                <div className={`w-full border rounded-2xl p-3.5 mt-1 space-y-2.5 text-xs shadow-xs ${
                  isDark ? 'bg-sky-950/40 border-sky-800/60 text-white' : 'bg-gradient-to-br from-sky-50/90 to-white border-sky-200 text-zinc-900'
                }`}>
                  <div className={`flex items-center justify-between border-b pb-2 ${isDark ? 'border-sky-800/50' : 'border-sky-100'}`}>
                    <span className="font-bold flex items-center gap-1.5 text-sky-400">
                      Razorpay Agentic Payment
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">
                      Instant
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <p className={isDark ? 'text-zinc-300' : 'text-zinc-600'}>Direct checkout session verified by Razorpay Engine.</p>
                    {((m.metadata?.razorpay as any)?.amount || (m.metadata as any)?.data?.razorpay?.amount) && (
                      <p className="font-mono font-bold text-sm">
                        Payable: ₹{(((m.metadata?.razorpay as any)?.amount || (m.metadata as any)?.data?.razorpay?.amount) / 100).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const targetProd = (m.metadata as any)?.data?.product || (m.metadata as any)?.product || m.metadata?.products?.[0];
                        if (targetProd) {
                          handleBuyNow(targetProd, (m.metadata as any)?.data?.variant, (m.metadata as any)?.data?.quantity || 1);
                        } else {
                          const link = m.metadata?.razorpay?.payment_link || (m.metadata as any)?.data?.razorpay?.payment_link || m.metadata?.payment_link;
                          if (link) window.open(link, '_blank');
                        }
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                    >
                      Pay with Razorpay
                    </button>
                    {(m.metadata?.razorpay?.payment_link || (m.metadata as any)?.data?.razorpay?.payment_link || m.metadata?.payment_link) && (
                      <a
                        href={m.metadata?.razorpay?.payment_link || (m.metadata as any)?.data?.razorpay?.payment_link || m.metadata?.payment_link}
                        target="_blank"
                        rel="noreferrer"
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold transition flex items-center gap-1 shrink-0 cursor-pointer ${
                          isDark ? 'bg-zinc-800 border-zinc-700 text-sky-400 hover:bg-zinc-700' : 'bg-white border-sky-200 text-sky-700 hover:bg-sky-50'
                        }`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Open Link
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Dynamic Order Card */}
              {m.metadata?.order && (
                <div className={`w-full border rounded-2xl p-4 mt-1 space-y-2 text-xs shadow-2xs ${
                  isDark ? 'bg-[#18181b] border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'
                }`}>
                  <div className={`flex items-center justify-between border-b pb-2 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                    <span className="font-bold flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-zinc-400" /> Order #{m.metadata.order.orderNumber}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                      {m.metadata.order.status}
                    </span>
                  </div>
                  <div className="text-xs space-y-0.5 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="font-sans text-zinc-400">Carrier:</span>
                      <span className="font-semibold">{m.metadata.order.carrier || 'FedEx Express'}</span>
                    </div>
                    {m.metadata.order.trackingNumber && (
                      <div className="flex justify-between">
                        <span className="font-sans text-zinc-400">Tracking:</span>
                        <span className="select-all font-semibold">{m.metadata.order.trackingNumber}</span>
                      </div>
                    )}
                    <div className={`flex justify-between font-bold pt-1.5 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                      <span className="font-sans text-zinc-400">Total:</span>
                      <span style={{ color: primaryColor }}>₹{(m.metadata.order.total ?? m.metadata.order.total_amount ?? 0).toLocaleString('en-IN')} {m.metadata.order.currency}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Return Status Card */}
              {m.metadata?.returnStatus && (
                <div className={`w-full border rounded-2xl p-4 mt-1 space-y-1.5 shadow-2xs ${
                  isDark ? 'bg-[#18181b] border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'
                }`}>
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <RotateCcw className="w-4 h-4 text-zinc-400" />
                    <span>Return Policy</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{m.metadata.returnStatus.policy}</p>
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex items-start gap-2.5">
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono text-[10px] shadow-2xs ${
              isDark ? 'bg-zinc-800 text-zinc-300 border border-zinc-700' : 'bg-white text-zinc-700 border border-zinc-200'
            }`}>
              AI
            </div>
            <div className={`border p-3 rounded-2xl rounded-tl-xs text-xs flex items-center gap-2 font-mono text-[11px] shadow-2xs ${
              isDark ? 'bg-[#18181b] border-zinc-800 text-zinc-300' : 'bg-white border-zinc-200 text-zinc-600'
            }`}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: primaryColor }}></span>
              <span>Checking store catalog and inventory...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts */}
      {messages.length <= 2 && (
        <div className={`px-4 py-2 flex items-center gap-2 overflow-x-auto border-t ${
          isDark ? 'bg-[#121215]/80 border-zinc-800' : 'bg-white/80 border-zinc-200'
        }`}>
          {['Recommend running shoes under $150', 'Track my order #10482', 'What is your return policy?', 'Show pictures of winter coats'].map((quickText, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(quickText)}
              className={`text-xs whitespace-nowrap border px-3 py-1.5 rounded-xl transition shrink-0 font-medium shadow-2xs cursor-pointer ${
                isDark 
                  ? 'bg-[#18181b] hover:bg-zinc-800 border-zinc-800 text-zinc-200' 
                  : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-700'
              }`}
            >
              {quickText}
            </button>
          ))}
        </div>
      )}

      {/* Attached Image Preview Bar */}
      {attachedImage && (
        <div className={`px-4 py-2.5 border-t flex items-center justify-between gap-3 ${
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-xl border overflow-hidden shrink-0 shadow-2xs ${
              isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-200'
            }`}>
              <img src={attachedImage} alt="Preview" className="w-full h-full object-cover" />
            </div>
            <div className="text-xs">
              <p className={`font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Image attached for Visual Search</p>
              <p className="text-[10px] text-zinc-500 font-mono">Agent will match catalog items</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAttachedImage(null)}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Form */}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className={`p-3.5 border-t flex items-center gap-2 ${
          isDark ? 'bg-[#121215] border-zinc-800' : 'bg-white border-zinc-200'
        }`}
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
          className={`p-2.5 rounded-xl border transition shrink-0 cursor-pointer ${
            attachedImage 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : isDark
                ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                : 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={attachedImage ? "Add query for attached image..." : "Ask anything about products, orders, returns..."}
          className={`flex-1 border rounded-xl px-3.5 py-2.5 text-xs placeholder:text-zinc-400 focus:outline-none transition ${
            isDark 
              ? 'bg-[#18181b] border-zinc-800 text-white focus:border-zinc-700' 
              : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-zinc-400 focus:bg-white'
          }`}
        />
        <button
          type="submit"
          disabled={(!input.trim() && !attachedImage) || sending}
          className="px-4 py-2.5 rounded-xl text-white font-semibold disabled:opacity-40 transition shrink-0 text-xs flex items-center gap-1.5 shadow-xs cursor-pointer hover:opacity-90"
          style={{ backgroundColor: primaryColor }}
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* High-Resolution Interactive Image Lightbox Modal */}
      {previewModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => { setPreviewModal(null); setZoomScale(1); }}
        >
          <div 
            className="bg-white border border-zinc-200 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
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
                  className="p-1.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 transition"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono text-zinc-600 font-semibold">{Math.round(zoomScale * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoomScale(prev => Math.min(2.5, prev + 0.25))}
                  className="p-1.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 transition"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <a
                  href={previewModal.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 transition"
                  title="Open original in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => { setPreviewModal(null); setZoomScale(1); }}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body / Image Viewport */}
            <div className="flex-1 overflow-auto bg-zinc-50 p-6 flex items-center justify-center min-h-[280px]">
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
                  className="max-h-[55vh] max-w-full object-contain rounded-xl shadow-lg border border-zinc-200" 
                />
              </div>
            </div>

            {/* Modal Footer */}
            {previewModal.title && (
              <div className="px-5 py-3.5 border-t border-zinc-200 bg-white flex items-center justify-between gap-4">
                <p className="text-xs text-zinc-500 line-clamp-1">{previewModal.description || 'Verified product image asset.'}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const itemTitle = previewModal.title!;
                      setPreviewModal(null);
                      handleBuyNow({ title: itemTitle, price: previewModal.price || 999, imageUrl: previewModal.url, description: previewModal.description });
                    }}
                    style={{ backgroundColor: primaryColor }}
                    className="px-4 py-2 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0 shadow-xs hover:opacity-90 cursor-pointer"
                  >
                    Buy Now
                  </button>
                  <button
                    onClick={() => {
                      handleAddToCart(previewModal.title!);
                      setPreviewModal(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-semibold flex items-center gap-1.5 transition shrink-0 shadow-xs cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" /> Add to Cart
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instant Checkout Sheet Modal */}
      {checkoutModal && (
        <CheckoutModal
          isOpen={checkoutModal.isOpen}
          onClose={() => setCheckoutModal(null)}
          product={checkoutModal.product}
          initialVariant={checkoutModal.variant}
          initialQuantity={checkoutModal.quantity}
          primaryColor={primaryColor}
          workspaceId={deployment?.workspace_id}
          onOrderSuccess={handleOrderSuccess}
        />
      )}
    </div>
  );
}