'use client';

import React, { useState } from 'react';
import { 
  Send, 
  Sparkles, 
  ShoppingBag, 
  Plus, 
  RotateCcw, 
  Check, 
  HelpCircle,
  Tag
} from 'lucide-react';
import { AIModeMessage, AIModeProduct } from '@/ai-mode/types';

export default function AIModeLivePreviewPage() {
  const [messages, setMessages] = useState<AIModeMessage[]>([
    {
      id: 'msg_welcome',
      role: 'assistant',
      content: 'Hello! 👋 I am running in **AI Mode**. Ask me to discover products, find outfits under a specific budget, or compare styles.',
      created_at: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);

  async function handleSend(textToSend?: string) {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg: AIModeMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai-mode/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.responseMessage) {
          setMessages(prev => [...prev, data.responseMessage]);
        }
        if (data.conversation?.id) {
          setConversationId(data.conversation.id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 tracking-tight">AI Mode Live Storefront Preview</h2>
          <p className="text-xs text-zinc-500">Test multi-turn context memory, ordinals ("add the second one"), comparisons, and recommendations.</p>
        </div>
        <button
          onClick={() => {
            setMessages([{
              id: 'msg_welcome',
              role: 'assistant',
              content: 'Hello! 👋 I am running in **AI Mode**. Ask me to discover products, find outfits under a specific budget, or compare styles.',
              created_at: new Date().toISOString()
            }]);
            setConversationId(undefined);
          }}
          className="px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700 text-xs font-semibold transition flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Session</span>
        </button>
      </div>

      {/* Chat Window */}
      <div className="flex-1 bg-white rounded-3xl border border-zinc-200/90 shadow-sm flex flex-col overflow-hidden">
        {/* Messages list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-2`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-zinc-900 text-white font-medium'
                    : 'bg-zinc-100/80 text-zinc-900 border border-zinc-200/60'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>

              {/* Comparison Card if available */}
              {msg.comparison && (
                <div className="w-full max-w-xl bg-zinc-900 text-white rounded-2xl p-4 shadow-md border border-zinc-800 space-y-2 text-xs">
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">Side-By-Side AI Comparison</span>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="bg-zinc-800/80 p-3 rounded-xl space-y-1">
                      <strong className="block text-zinc-100 text-xs">{msg.comparison.item_a.title}</strong>
                      <span className="text-emerald-400 font-mono text-[11px]">₹{msg.comparison.item_a.price}</span>
                      <ul className="text-[10px] text-zinc-300 list-disc list-inside pt-1">
                        {msg.comparison.pros_a.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                    <div className="bg-zinc-800/80 p-3 rounded-xl space-y-1">
                      <strong className="block text-zinc-100 text-xs">{msg.comparison.item_b.title}</strong>
                      <span className="text-emerald-400 font-mono text-[11px]">₹{msg.comparison.item_b.price}</span>
                      <ul className="text-[10px] text-zinc-300 list-disc list-inside pt-1">
                        {msg.comparison.pros_b.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Attached Products Grid */}
              {msg.products && msg.products.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-2xl pt-1">
                  {msg.products.map(p => (
                    <div key={p.id} className="bg-white rounded-xl border border-zinc-200 p-3 shadow-2xs space-y-2 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="h-28 rounded-lg bg-zinc-100 overflow-hidden">
                          {p.images?.[0] ? (
                            <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-400">
                              <ShoppingBag className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                        <h5 className="text-[11px] font-bold text-zinc-900 line-clamp-1">{p.title}</h5>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
                        <span className="text-xs font-black text-zinc-900">₹{p.price.toLocaleString('en-IN')}</span>
                        <button
                          onClick={() => handleSend(`Add ${p.title} to cart`)}
                          className="p-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-semibold"
                          title="Add to Cart"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
              <span>AI Mode is reasoning and retrieving products...</span>
            </div>
          )}
        </div>

        {/* Suggested Follow-Ups */}
        <div className="px-4 py-2 bg-zinc-50 border-t border-zinc-100 flex items-center gap-2 overflow-x-auto text-[11px]">
          <span className="text-zinc-400 font-medium shrink-0">Suggestions:</span>
          {['Show cheaper options', 'Which one is better?', 'Show more products', 'Add the second one'].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => handleSend(s)}
              className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-medium shrink-0 transition"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="p-3 bg-white border-t border-zinc-200/80 flex items-center gap-2">
          <input
            type="text"
            placeholder="Type your shopping request or follow-up question..."
            value={input}
            onChange={e => setInput(e.target.value)}
            className="flex-1 bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-50 transition shadow-xs cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
