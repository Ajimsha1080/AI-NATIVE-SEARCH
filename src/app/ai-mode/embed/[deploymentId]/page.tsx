'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  Send, 
  Sparkles, 
  ShoppingBag, 
  X, 
  RotateCcw,
  Check
} from 'lucide-react';
import { AIModeDeployment, AIModeMessage } from '@/ai-mode/types';

export default function AIModeEmbedWidget() {
  const params = useParams();
  const deploymentId = params?.deploymentId as string;
  const [deployment, setDeployment] = useState<AIModeDeployment | null>(null);
  const [messages, setMessages] = useState<AIModeMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (deploymentId) {
      fetch(`/api/ai-mode/widget/${deploymentId}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.deployment) {
            setDeployment(data.deployment);
            setMessages([
              {
                id: 'welcome',
                role: 'assistant',
                content: data.deployment.branding.welcome_message || 'Hi there! How can I help you shop today?',
                created_at: new Date().toISOString()
              }
            ]);
          }
        })
        .catch(() => {});
    }
  }, [deploymentId]);

  async function handleSend(textToSend?: string) {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg: AIModeMessage = {
      id: `u_${Date.now()}`,
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
          conversation_id: conversationId,
          workspace_id: deployment?.workspace_id
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

  if (!deployment) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-50 text-xs text-zinc-400 font-mono">
        Loading AI Mode Widget...
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-white text-zinc-900 font-sans antialiased overflow-hidden">
      {/* Widget Top Bar */}
      <div className="p-4 bg-zinc-900 text-white flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 text-white flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">{deployment.branding.title}</h3>
            <p className="text-[10px] text-zinc-400">{deployment.branding.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-1.5`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-zinc-900 text-white font-medium'
                  : 'bg-zinc-100 text-zinc-900 border border-zinc-200/60'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>

            {/* Attached Products */}
            {msg.products && msg.products.length > 0 && (
              <div className="grid grid-cols-2 gap-2 w-full pt-1">
                {msg.products.slice(0, 4).map(p => (
                  <div key={p.id} className="bg-white rounded-xl border border-zinc-200 p-2 shadow-2xs space-y-1 flex flex-col justify-between">
                    <div className="h-20 rounded-lg bg-zinc-100 overflow-hidden">
                      {p.images?.[0] ? (
                        <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-400">
                          <ShoppingBag className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    <h5 className="text-[10px] font-bold text-zinc-900 line-clamp-1">{p.title}</h5>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-black text-zinc-900">₹{p.price.toLocaleString('en-IN')}</span>
                      <button
                        onClick={() => handleSend(`Add ${p.title} to cart`)}
                        className="px-1.5 py-0.5 rounded bg-zinc-900 text-white text-[9px] font-bold"
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
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <Sparkles className="w-3 h-3 text-indigo-500 animate-spin" />
            <span>Finding products...</span>
          </div>
        )}
      </div>

      {/* Suggested Prompts */}
      {messages.length <= 1 && deployment.branding.suggested_prompts?.length > 0 && (
        <div className="px-3 py-1.5 bg-zinc-50 border-t border-zinc-100 flex items-center gap-1.5 overflow-x-auto text-[10px]">
          {deployment.branding.suggested_prompts.map(sp => (
            <button
              key={sp}
              type="button"
              onClick={() => handleSend(sp)}
              className="px-2 py-1 rounded-lg bg-white border border-zinc-200 text-zinc-700 font-medium shrink-0 hover:bg-zinc-100"
            >
              {sp}
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="p-3 bg-white border-t border-zinc-200 flex items-center gap-1.5">
        <input
          type="text"
          placeholder="Ask for items, outfits, prices..."
          value={input}
          onChange={e => setInput(e.target.value)}
          className="flex-1 bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="p-2 rounded-xl bg-zinc-900 text-white disabled:opacity-50 transition cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
