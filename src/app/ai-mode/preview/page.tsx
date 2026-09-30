'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Send, ShoppingBag, Plus, 
  Layers, ShoppingCart, Check, RefreshCw, X, ChevronRight 
} from 'lucide-react';
import { AiModeChatMessage, AiModeComparisonResult } from '@/ai-mode/types';
import { CommerceProduct } from '@/types';

export default function AiModePreviewPage() {
  const [messages, setMessages] = useState<AiModeChatMessage[]>([
    {
      id: 'init_welcome',
      role: 'assistant',
      content: 'Welcome to the AI Mode Shopping Experience! I can find specific styles, recommend products, compare items side-by-side, and help you find exactly what you are looking for. What can I help you find today?',
      timestamp: new Date().toISOString(),
      suggested_actions: [
        'Find gift ideas under $50',
        'Show popular items',
        'Compare top products'
      ]
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [cartCount, setCartCount] = useState(0);
  const [cartToast, setCartToast] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
          sessionId: sessionId || undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.sessionId) setSessionId(data.sessionId);
        if (data.message) {
          setMessages(prev => [...prev, data.message]);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setMessages(prev => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: 'assistant',
            content: err.error || 'Sorry, I encountered an issue searching the catalog.',
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

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">AI Mode Live Preview</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Test the live conversational commerce engine against your workspace catalog.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live Session Connected</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold">
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Cart: {cartCount} items</span>
          </div>
        </div>
      </div>

      {/* Cart Toast Notification */}
      {cartToast && (
        <div className="bg-zinc-900 text-white text-xs px-4 py-2.5 rounded-2xl flex items-center justify-between animate-fade-in shadow-lg">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{cartToast}</span>
          </div>
          <button onClick={() => setCartToast(null)} className="text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Chat Container */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs flex flex-col h-[680px] overflow-hidden">
        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50/40">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              {/* Message Bubble */}
              <div 
                className={`max-w-[80%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white font-medium shadow-xs rounded-br-xs'
                    : 'bg-white text-zinc-800 border border-zinc-200 shadow-xs rounded-bl-xs'
                }`}
              >
                {msg.content}
              </div>

              {/* Product Comparison View */}
              {msg.comparison && msg.comparison.comparison_points && (
                <div className="mt-3 w-full bg-white rounded-2xl border border-zinc-200 p-4 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-900">
                    <Layers className="w-4 h-4 text-indigo-600" /> Side-by-Side Comparison
                  </div>
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-100 text-zinc-500 font-semibold">
                          <th className="py-2 px-3 text-left">Feature</th>
                          {msg.comparison.products.map(p => (
                            <th key={p.id} className="py-2 px-3 text-left font-bold text-zinc-900">{p.title}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {msg.comparison.comparison_points.map((pt, idx) => (
                          <tr key={idx} className="hover:bg-zinc-50/50">
                            <td className="py-2 px-3 font-medium text-zinc-500">{pt.attribute}</td>
                            {msg.comparison!.products.map(p => (
                              <td key={p.id} className="py-2 px-3 text-zinc-800 font-semibold">
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

              {/* Product Cards */}
              {msg.products && msg.products.length > 0 && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                  {msg.products.map((product) => (
                    <div 
                      key={product.id}
                      className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-2xs hover:shadow-md transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="h-36 bg-zinc-100 relative overflow-hidden flex items-center justify-center">
                          {product.images && product.images[0] ? (
                            <img 
                              src={product.images[0]} 
                              alt={product.title} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ShoppingBag className="w-8 h-8 text-zinc-300" />
                          )}
                          <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            product.in_stock ? 'bg-emerald-500 text-white' : 'bg-zinc-600 text-white'
                          }`}>
                            {product.in_stock ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </div>
                        <div className="p-3.5 space-y-1">
                          <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">
                            {product.category}
                          </span>
                          <h4 className="font-semibold text-xs text-zinc-900 line-clamp-1">{product.title}</h4>
                          <p className="text-[11px] text-zinc-500 line-clamp-2">{product.description}</p>
                        </div>
                      </div>

                      <div className="p-3.5 pt-0 border-t border-zinc-100 flex items-center justify-between mt-2">
                        <span className="font-bold text-sm text-zinc-900">
                          {product.currency || '$'}{product.price}
                        </span>
                        <button
                          onClick={() => handleAddToCart(product)}
                          className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Follow-up Action Chips */}
              {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {msg.suggested_actions.map((act, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(act)}
                      className="text-xs bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 font-medium px-3 py-1 rounded-full transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
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
            <div className="flex items-center gap-2 text-xs text-zinc-500 bg-white p-3 rounded-2xl border border-zinc-200 w-fit shadow-xs animate-pulse">
              <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" />
              <span>AI Mode is searching catalog and formulating response...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-zinc-200">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex items-center gap-2 bg-zinc-50 border border-zinc-300 rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask anything (e.g. 'show dresses for a wedding', 'cheaper options', 'compare top 2', 'add the first one')..."
              className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isSending}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition disabled:opacity-40 cursor-pointer shadow-xs"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
