'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import { 
  Sparkles, Send, ShoppingBag, ArrowRight, Check, 
  ExternalLink, RotateCcw, Plus, Layers, AlertCircle, 
  ChevronRight, RefreshCw, X, ShoppingCart
} from 'lucide-react';
import { AiModeChatMessage, AiModeComparisonResult } from '@/ai-mode/types';
import { CommerceProduct } from '@/types';

export default function AiModeEmbedPage({ params }: { params: Promise<{ deploymentId: string }> }) {
  const resolvedParams = use(params);
  const deploymentId = resolvedParams.deploymentId;

  const [deployment, setDeployment] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [messages, setMessages] = useState<AiModeChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [cartCount, setCartCount] = useState(0);
  const [cartToast, setCartToast] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load deployment configuration
  useEffect(() => {
    async function loadDeployment() {
      try {
        const res = await fetch(`/api/ai-mode/widget/${deploymentId}`);
        if (res.ok) {
          const data = await res.json();
          setDeployment(data);

          // Add initial welcome message
          const welcome = data.theme?.welcome_message || 'Hi! How can I help you shop today?';
          setMessages([
            {
              id: 'welcome_msg',
              role: 'assistant',
              content: welcome,
              timestamp: new Date().toISOString(),
              suggested_actions: data.theme?.starter_prompts || ['Show popular products', 'Find gifts under $50']
            }
          ]);
        }
      } catch (e) {
        console.error('Failed to load deployment:', e);
      } finally {
        setLoadingConfig(false);
      }
    }
    loadDeployment();
  }, [deploymentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputValue;
    if (!text.trim() || isSending) return;

    const userMsg: AiModeChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputValue('');
    setIsSending(true);

    try {
      const res = await fetch('/api/ai-mode/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId: sessionId || undefined,
          deploymentId
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.sessionId) setSessionId(data.sessionId);
        if (data.message) {
          setMessages(prev => [...prev, data.message]);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setMessages(prev => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: 'assistant',
            content: errData.error || 'Sorry, I encountered an issue searching the catalog. Please try again.',
            timestamp: new Date().toISOString()
          }
        ]);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: 'Network connection issue. Please try again.',
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleAddToCart = (product: CommerceProduct) => {
    setCartCount(prev => prev + 1);
    setCartToast(`Added ${product.title} to cart`);
    setTimeout(() => setCartToast(null), 3000);
  };

  if (loadingConfig) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-50">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  const theme = deployment?.theme || {};
  const primaryColor = theme.primary_color || '#4f46e5';
  const title = theme.widget_title || 'ShopMate AI Assistant';

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden text-zinc-900 font-sans select-none antialiased">
      {/* Widget Header */}
      <div 
        className="p-4 border-b flex items-center justify-between text-white shadow-xs shrink-0"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-xs">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm leading-tight">{title}</h3>
            <span className="text-[10px] text-white/80 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> AI Shopping Mode Active
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {cartCount > 0 && (
            <div className="flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-xs">
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>{cartCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Cart Toast Notification */}
      {cartToast && (
        <div className="bg-zinc-900 text-white text-xs px-3.5 py-2 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{cartToast}</span>
          </div>
          <button onClick={() => setCartToast(null)} className="text-zinc-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Chat & Product Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            {/* Text Message Bubble */}
            <div 
              className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'text-white shadow-xs font-medium rounded-br-xs' 
                  : 'bg-white text-zinc-800 border border-zinc-200/80 shadow-xs rounded-bl-xs'
              }`}
              style={msg.role === 'user' ? { backgroundColor: primaryColor } : {}}
            >
              {msg.content}
            </div>

            {/* Product Comparison View */}
            {msg.comparison && msg.comparison.comparison_points && (
              <div className="mt-3 w-full bg-white rounded-2xl border border-zinc-200 p-3.5 shadow-xs space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" /> Product Comparison Matrix
                </div>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-100 text-zinc-500 font-semibold">
                        <th className="py-1.5 px-2 text-left">Feature</th>
                        {msg.comparison.products.map(p => (
                          <th key={p.id} className="py-1.5 px-2 text-left font-bold text-zinc-800">{p.title}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {msg.comparison.comparison_points.map((pt, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/50">
                          <td className="py-2 px-2 font-medium text-zinc-500">{pt.attribute}</td>
                          {msg.comparison!.products.map(p => (
                            <td key={p.id} className="py-2 px-2 text-zinc-800 font-semibold">
                              {pt.values[p.title] ?? 'N/A'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Product Cards Grid */}
            {msg.products && msg.products.length > 0 && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                {msg.products.map((product) => (
                  <div 
                    key={product.id}
                    className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between group"
                  >
                    <div>
                      <div className="h-32 bg-zinc-100 relative overflow-hidden flex items-center justify-center">
                        {product.images && product.images[0] ? (
                          <img 
                            src={product.images[0]} 
                            alt={product.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        ) : (
                          <ShoppingBag className="w-8 h-8 text-zinc-300" />
                        )}
                        <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          product.in_stock 
                            ? 'bg-emerald-500 text-white shadow-xs' 
                            : 'bg-zinc-600 text-white'
                        }`}>
                          {product.in_stock ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </div>

                      <div className="p-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
                          {product.category || 'General'}
                        </span>
                        <h4 className="font-semibold text-xs text-zinc-900 line-clamp-1 mt-0.5">
                          {product.title}
                        </h4>
                        <p className="text-[11px] text-zinc-500 line-clamp-2 mt-1 leading-snug">
                          {product.description}
                        </p>
                      </div>
                    </div>

                    <div className="p-3 pt-0 flex items-center justify-between border-t border-zinc-100 mt-2">
                      <span className="font-bold text-sm text-zinc-900">
                        {product.currency || '$'}{product.price}
                      </span>
                      <button 
                        onClick={() => handleAddToCart(product)}
                        className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Suggested Follow-up Actions */}
            {msg.suggested_actions && msg.suggested_actions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {msg.suggested_actions.map((act, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(act)}
                    className="text-[11px] bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 font-medium px-2.5 py-1 rounded-full transition shadow-2xs flex items-center gap-1 cursor-pointer"
                  >
                    <span>{act}</span>
                    <ChevronRight className="w-3 h-3 text-zinc-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {isSending && (
          <div className="flex items-center gap-2 text-xs text-zinc-500 bg-white p-3 rounded-2xl border border-zinc-200/80 w-fit shadow-xs animate-pulse">
            <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" />
            <span>AI Mode is searching catalog & reasoning...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Field & Starter Suggestions */}
      <div className="p-3 bg-white border-t border-zinc-200 shrink-0">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center gap-2 bg-zinc-50 border border-zinc-300/80 rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition shadow-inner"
        >
          <input 
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={theme.placeholder_text || 'Ask anything about products, styles, or comparison...'}
            className="flex-1 bg-transparent px-3 py-1.5 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden"
          />
          <button 
            type="submit"
            disabled={!inputValue.trim() || isSending}
            className="p-2 rounded-xl text-white font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs shrink-0 cursor-pointer"
            style={{ backgroundColor: primaryColor }}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

        {theme.show_branding && (
          <div className="text-center mt-2">
            <span className="text-[10px] text-zinc-400 font-medium">
              Powered by <span className="font-bold text-zinc-600">ShopMate AI Mode</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
