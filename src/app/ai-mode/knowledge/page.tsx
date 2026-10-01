'use client';

import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  FileText, 
  Plus, 
  RefreshCw, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle,
  X,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { AIModeKnowledgeSource } from '@/ai-mode/types';

export default function AIModeKnowledgePage() {
  const [sources, setSources] = useState<AIModeKnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [tab, setTab] = useState<'WEBSITE' | 'DOCUMENT' | 'FAQ'>('WEBSITE');
  
  // Form fields
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSources();
  }, []);

  async function loadSources() {
    setLoading(true);
    try {
      const res = await fetch('/api/ai-mode/knowledge');
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddSource(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      let body: any = { type: tab };
      if (tab === 'WEBSITE') {
        if (!url) throw new Error('Please enter a target website URL');
        body.url = url;
        body.name = name || url;
      } else if (tab === 'FAQ') {
        if (!faqQuestion || !faqAnswer) throw new Error('Please fill in both question and answer');
        body.name = faqQuestion;
        body.content = `Q: ${faqQuestion}\nA: ${faqAnswer}`;
      } else {
        if (!name || !content) throw new Error('Please fill in document name and content');
        body.name = name;
        body.content = content;
      }

      const res = await fetch('/api/ai-mode/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save knowledge source');
      }

      setShowAddModal(false);
      resetForm();
      await loadSources();
    } catch (err: any) {
      setError(err.message || 'Error saving source');
    } finally {
      setSaving(false);
    }
  }

  async function handleSync(id: string) {
    try {
      await fetch('/api/ai-mode/knowledge/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      await loadSources();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to remove this knowledge source?')) return;
    try {
      await fetch(`/api/ai-mode/knowledge/${id}`, { method: 'DELETE' });
      await loadSources();
    } catch (e) {
      console.error(e);
    }
  }

  function resetForm() {
    setName('');
    setUrl('');
    setContent('');
    setFaqQuestion('');
    setFaqAnswer('');
    setError(null);
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 tracking-tight">AI Mode Knowledge Base</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Manage live website crawlers, documents, and FAQs specifically for the AI Mode search layer.</p>
        </div>

        <button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Add Knowledge Source</span>
        </button>
      </div>

      {/* Knowledge Sources Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200/80 bg-zinc-50/50 text-[11px] font-semibold text-zinc-500">
                <th className="py-3 px-4">Source Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Indexed Products</th>
                <th className="py-3 px-4">Last Synced</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs">
              {sources.map(source => (
                <tr key={source.id} className="hover:bg-zinc-50/60 transition">
                  <td className="py-3.5 px-4 font-semibold text-zinc-900">
                    <div className="flex items-center gap-2.5">
                      {source.type === 'WEBSITE' ? (
                        <Globe className="w-4 h-4 text-indigo-600 shrink-0" />
                      ) : source.type === 'FAQ' ? (
                        <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-zinc-600 shrink-0" />
                      )}
                      <div>
                        <p className="line-clamp-1">{source.name}</p>
                        {source.source_url && (
                          <span className="text-[11px] text-zinc-400 font-mono line-clamp-1">{source.source_url}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-600">{source.type}</td>
                  <td className="py-3.5 px-4">
                    {source.status === 'INDEXED' ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md font-medium text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Indexed
                      </span>
                    ) : source.status === 'INDEXING' ? (
                      <span className="inline-flex items-center gap-1.5 text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md font-medium text-[11px]">
                        <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
                        Indexing...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded-md font-medium text-[11px]">
                        Error
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-zinc-700 font-mono text-[11px]">
                    {source.product_count > 0 ? `${source.product_count} Products` : `${source.document_count} Chunks`}
                  </td>
                  <td className="py-3.5 px-4 text-zinc-500 text-[11px]">
                    {source.last_synced_at ? new Date(source.last_synced_at).toLocaleString() : 'Never'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleSync(source.id)}
                        className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition"
                        title="Re-sync Source"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(source.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-zinc-400 hover:text-rose-600 transition"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {sources.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400 mb-1">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <p className="font-semibold text-zinc-800 text-sm">No AI Mode knowledge sources connected yet</p>
                      <p className="text-xs text-zinc-400 max-w-sm">Connect a website URL or upload store guidelines to empower AI Search.</p>
                      <button
                        onClick={() => { resetForm(); setShowAddModal(true); }}
                        className="mt-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs transition shadow-xs cursor-pointer"
                      >
                        + Add First Source
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Knowledge Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white text-zinc-900 rounded-2xl w-full max-w-lg shadow-2xl border border-zinc-200/80 overflow-hidden animate-in zoom-in-[0.98] duration-200">
            {/* Modal Header */}
            <div className="p-5 pb-4 flex items-center justify-between border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shadow-2xs">
                  <BookOpen className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Add AI Mode Knowledge</h3>
                  <p className="text-xs text-zinc-500">Sync website pages, FAQs, or raw documentation</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddSource} className="p-5 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Segmented Control */}
              <div className="grid grid-cols-3 p-1 bg-zinc-100 rounded-xl border border-zinc-200/60 gap-1">
                <button
                  type="button"
                  onClick={() => setTab('WEBSITE')}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    tab === 'WEBSITE' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" /> Website Sync
                </button>
                <button
                  type="button"
                  onClick={() => setTab('DOCUMENT')}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    tab === 'DOCUMENT' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> Document
                </button>
                <button
                  type="button"
                  onClick={() => setTab('FAQ')}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    tab === 'FAQ' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <HelpCircle className="w-3.5 h-3.5" /> Q&amp;A
                </button>
              </div>

              {tab === 'WEBSITE' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-zinc-700 mb-1">Target Website / Store URL</label>
                    <input
                      type="url"
                      placeholder="https://bluetyga.com/pages/shipping-returns"
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      className="w-full bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-zinc-700 mb-1">Source Label (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Store Shipping &amp; Return Policy"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
                    />
                  </div>
                </div>
              )}

              {tab === 'DOCUMENT' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-zinc-700 mb-1">Document Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Sizing Guide &amp; Return Policy"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-zinc-700 mb-1">Content Body</label>
                    <textarea
                      rows={5}
                      placeholder="Paste text, policies, or product specifications here..."
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      className="w-full bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl p-3 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
                    />
                  </div>
                </div>
              )}

              {tab === 'FAQ' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-zinc-700 mb-1">Customer Question</label>
                    <input
                      type="text"
                      placeholder="e.g. How long does standard shipping take?"
                      value={faqQuestion}
                      onChange={e => setFaqQuestion(e.target.value)}
                      className="w-full bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-zinc-700 mb-1">Store Answer</label>
                    <textarea
                      rows={4}
                      placeholder="e.g. Standard delivery takes 3-5 business days across India."
                      value={faqAnswer}
                      onChange={e => setFaqAnswer(e.target.value)}
                      className="w-full bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl p-3 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.98]"
                >
                  {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{saving ? 'Indexing...' : 'Save & Index'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
