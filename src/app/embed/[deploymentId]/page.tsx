'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import { 
  Send, Bot, User, ShoppingBag, Truck, CheckCircle2, RotateCcw, 
  AlertCircle, Sparkles, Image as ImageIcon, X, ZoomIn, ZoomOut, Eye, ExternalLink 
} from 'lucide-react';
import PortalSwitcher from '@/components/layout/PortalSwitcher';
import { sanitizeImageUrl } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  imageUrl?: string;
  createdAt?: string;
  created_at?: string;
  metadata?: {
    products?: Array<{ id: string; title: string; price: number; comparePrice?: number; handle: string; imageUrl?: string; rating?: number; description?: string }>;
    order?: { id: string; orderNumber: string; status: string; carrier?: string; trackingNumber?: string; total: number; currency: string; items: any[] };
    returnStatus?: { eligible: boolean; policy: string; instructions?: string; returnLabelUrl?: string };
    cart?: { id: string; total: number; currency: string; items: any[] };
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [previewModal, setPreviewModal] = useState<ImageModalState | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
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

  // Helper to render markdown message text with inline markdown image support
  const renderMessageContent = (content: string) => {
    const imgRegex = /!\[(.*?)\]\((.*?)\)/g;
    const parts: Array<{ type: 'text'; value: string } | { type: 'image'; alt: string; url: string }> = [];
    let lastIndex = 0;
    let match;

    while ((match = imgRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: content.substring(lastIndex, match.index) });
      }
      const cleanUrl = sanitizeImageUrl(match[2]);
      if (cleanUrl) {
        parts.push({ type: 'image', alt: match[1], url: cleanUrl });
      } else {
        parts.push({ type: 'text', value: `[Image: ${match[1]}]` });
      }
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
              className="relative group rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50 cursor-pointer max-w-sm my-2 shadow-2xs hover:border-zinc-300 transition"
            >
              <img src={p.url} alt={p.alt} className="w-full max-h-56 object-cover" />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                <span className="text-[11px] font-semibold bg-white/95 text-zinc-900 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow">
                  <ZoomIn className="w-3.5 h-3.5 text-emerald-600" /> Click to enlarge
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f4f5f7] text-zinc-500 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-zinc-900 rounded-full animate-ping"></span>
          <span>Initializing ShopMate Storefront Concierge...</span>
        </div>
      </div>
    );
  }

  if (error || !deployment) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f4f5f7] p-4 font-sans">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-6 text-center space-y-3 shadow-sm">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <h2 className="text-base font-bold text-zinc-900">Widget Unavailable</h2>
          <p className="text-xs text-zinc-500">{error || 'Unable to connect to active storefront deployment.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-xl mx-auto bg-[#f4f5f7] font-sans border-x border-zinc-200 relative antialiased selection:bg-zinc-200 selection:text-zinc-900">
      {/* Widget Header */}
      <div className="px-5 py-3.5 border-b border-zinc-200 bg-white flex items-center justify-between sticky top-0 z-20 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-white font-bold text-xs shadow-xs">
            {agent?.avatar_url ? (
              <img src={agent.avatar_url} alt={agent.name} className="w-full h-full object-cover rounded-xl" />
            ) : (
              <Bot className="w-4.5 h-4.5" />
            )}
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
              {agent?.name || 'ShopMate Concierge'}
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </h3>
            <p className="text-[10px] text-zinc-500 font-mono">Live Catalog • Verified Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PortalSwitcher />
          <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600 font-semibold">
            ShopMate AaaS
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
              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 font-mono text-[10px] shadow-2xs ${
                m.role === 'user' ? 'bg-zinc-900 text-white font-bold' : 'bg-white text-zinc-700 border border-zinc-200'
              }`}
            >
              {m.role === 'user' ? 'U' : 'AI'}
            </div>

            <div className={`flex flex-col gap-1.5 max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              {/* User attached image */}
              {m.imageUrl && (
                <div 
                  onClick={() => { setPreviewModal({ url: m.imageUrl!, title: 'Uploaded Image' }); setZoomScale(1); }}
                  className="rounded-2xl overflow-hidden border border-zinc-200 max-w-[240px] cursor-pointer group relative shadow-2xs"
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
                    ? 'bg-zinc-900 text-white rounded-tr-xs'
                    : 'bg-white border border-zinc-200 text-zinc-800 rounded-tl-xs'
                }`}
              >
                {renderMessageContent(m.content)}
              </div>

              {/* Dynamic Product Cards */}
              {m.metadata?.products && m.metadata.products.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full mt-1.5">
                  {m.metadata.products.map((p) => {
                    const imgSrc = p.imageUrl || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80';
                    return (
                      <div key={p.id} className="bg-white border border-zinc-200 hover:border-zinc-300 transition rounded-2xl p-3.5 flex flex-col justify-between gap-3 shadow-2xs group">
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
                            className="w-16 h-16 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer relative group/img shadow-2xs"
                            title="Click to view full HD image"
                          >
                            <img 
                              src={imgSrc} 
                              alt={p.title} 
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&auto=format&fit=crop&q=80';
                              }}
                              className="w-full h-full object-cover group-hover/img:scale-110 transition duration-300" 
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center">
                              <Eye className="w-4 h-4 text-white" />
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-zinc-900 truncate group-hover:text-zinc-700 transition">{p.title}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-xs font-mono font-bold text-zinc-900">₹{p.price?.toLocaleString('en-IN') || p.price}</span>
                              {p.comparePrice && (
                                <span className="text-[10px] font-mono text-zinc-400 line-through">₹{p.comparePrice?.toLocaleString('en-IN') || p.comparePrice}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 pt-2 border-t border-zinc-100">
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
                            className="px-2.5 py-1 rounded-xl text-[11px] font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition flex items-center gap-1 shrink-0"
                          >
                            <Eye className="w-3 h-3" /> View
                          </button>
                          <button 
                            onClick={() => handleSend(`Add ${p.title} to my cart`)}
                            className="flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" /> Add to Cart
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Dynamic Order Card */}
              {m.metadata?.order && (
                <div className="w-full bg-white border border-zinc-200 rounded-2xl p-4 mt-1 space-y-2 text-xs shadow-2xs">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                    <span className="font-bold text-zinc-900 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-zinc-600" /> Order #{m.metadata.order.orderNumber}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
                      {m.metadata.order.status}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-600 space-y-0.5 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="font-sans">Carrier:</span>
                      <span className="text-zinc-900 font-semibold">{m.metadata.order.carrier || 'FedEx Express'}</span>
                    </div>
                    {m.metadata.order.trackingNumber && (
                      <div className="flex justify-between">
                        <span className="font-sans">Tracking:</span>
                        <span className="text-zinc-900 select-all font-semibold">{m.metadata.order.trackingNumber}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold pt-1.5 border-t border-zinc-100 text-zinc-900">
                      <span className="font-sans">Total:</span>
                      <span>${m.metadata.order.total.toFixed(2)} {m.metadata.order.currency}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Return Status Card */}
              {m.metadata?.returnStatus && (
                <div className="w-full bg-white border border-zinc-200 rounded-2xl p-4 mt-1 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                    <RotateCcw className="w-4 h-4 text-zinc-600" />
                    <span>Return Policy</span>
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed">{m.metadata.returnStatus.policy}</p>
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-white text-zinc-700 border border-zinc-200 flex items-center justify-center font-mono text-[10px] shadow-2xs">
              AI
            </div>
            <div className="bg-white border border-zinc-200 p-3 rounded-2xl rounded-tl-xs text-xs text-zinc-600 flex items-center gap-2 font-mono text-[11px] shadow-2xs">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span>Checking store catalog and inventory...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto bg-white/80 border-t border-zinc-200">
          {['Recommend running shoes under $150', 'Track my order #10482', 'What is your return policy?', 'Show pictures of winter coats'].map((quickText, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(quickText)}
              className="text-xs whitespace-nowrap bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 px-3 py-1.5 rounded-xl transition shrink-0 font-medium shadow-2xs cursor-pointer"
            >
              {quickText}
            </button>
          ))}
        </div>
      )}

      {/* Attached Image Preview Bar */}
      {attachedImage && (
        <div className="px-4 py-2.5 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl border border-zinc-200 overflow-hidden bg-white shrink-0 shadow-2xs">
              <img src={attachedImage} alt="Preview" className="w-full h-full object-cover" />
            </div>
            <div className="text-xs">
              <p className="text-zinc-900 font-semibold">Image attached for Visual Search</p>
              <p className="text-[10px] text-zinc-500 font-mono">Agent will match catalog items</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAttachedImage(null)}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Form */}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="p-3.5 border-t border-zinc-200 bg-white flex items-center gap-2"
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
          className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
        />
        <button
          type="submit"
          disabled={(!input.trim() && !attachedImage) || sending}
          className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold disabled:opacity-40 transition shrink-0 text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
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
                <button
                  onClick={() => {
                    handleSend(`Add ${previewModal.title} to my cart`);
                    setPreviewModal(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-semibold flex items-center gap-1.5 transition shrink-0 shadow-xs cursor-pointer"
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