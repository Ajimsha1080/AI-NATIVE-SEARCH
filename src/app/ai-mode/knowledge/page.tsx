'use client';

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Globe, FileText, Plus, RefreshCw, 
  Trash2, CheckCircle2, AlertCircle, Clock, 
  Upload, X, HelpCircle, Layers, Check, ExternalLink
} from 'lucide-react';
import { AiModeKnowledgeSource, AiModeKnowledgeType } from '@/ai-mode/types';

export default function AiModeKnowledgePage() {
  const [sources, setSources] = useState<AiModeKnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<AiModeKnowledgeType>('WEBSITE_URL');
  const [nameInput, setNameInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const fetchSources = async () => {
    try {
      const res = await fetch('/api/ai-mode/knowledge');
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources || []);
      }
    } catch (e) {
      console.error('Failed to fetch knowledge sources:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    setIsSubmitting(true);
    try {
      const payload: any = {
        type: modalType,
        name: nameInput
      };

      if (modalType === 'WEBSITE_URL') {
        payload.url = urlInput;
      } else if (modalType === 'FILE_UPLOAD') {
        payload.file_name = `${nameInput.toLowerCase().replace(/\s+/g, '_')}.pdf`;
        payload.file_type = 'PDF';
        payload.file_size = 1024 * 142;
        payload.content_preview = textInput || 'Parsed document contents';
      } else {
        payload.content_preview = textInput;
      }

      const res = await fetch('/api/ai-mode/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        await fetchSources();
        setIsModalOpen(false);
        setNameInput('');
        setUrlInput('');
        setTextInput('');
      }
    } catch (e) {
      console.error('Add source error:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncSource = async (id: string) => {
    setSyncingId(id);
    try {
      const res = await fetch('/api/ai-mode/knowledge/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        await fetchSources();
      }
    } catch (e) {
      console.error('Sync error:', e);
    } finally {
      setSyncingId(null);
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm('Are you sure you want to delete this knowledge source?')) return;
    try {
      const res = await fetch(`/api/ai-mode/knowledge/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSources(prev => prev.filter(s => s.id !== id));
      }
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Knowledge Sources</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Connect merchant website URLs, upload documents, and manage store policies for AI Mode.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Knowledge Source</span>
        </button>
      </div>

      {/* Sources List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
        </div>
      ) : sources.length === 0 ? (
        <div className="bg-white rounded-3xl border border-zinc-200 p-12 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900">No Knowledge Sources Connected</h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto mt-1">
              Add your merchant website URL or upload store documents so AI Mode can extract product knowledge and answer customer questions.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition cursor-pointer"
          >
            Add Your First Source
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/50 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="py-3 px-5">Source Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Extracted Items</th>
                  <th className="py-3 px-4">Last Synced</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {sources.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-50/60 transition">
                    <td className="py-3.5 px-5 font-semibold text-zinc-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-700 flex items-center justify-center shrink-0">
                          {s.type === 'WEBSITE_URL' && <Globe className="w-4 h-4 text-indigo-600" />}
                          {s.type === 'FILE_UPLOAD' && <FileText className="w-4 h-4 text-emerald-600" />}
                          {s.type === 'FAQ' && <HelpCircle className="w-4 h-4 text-amber-600" />}
                          {s.type === 'BUSINESS_INFO' && <BookOpen className="w-4 h-4 text-violet-600" />}
                        </div>
                        <div>
                          <div className="font-semibold text-zinc-900">{s.name}</div>
                          {s.url && (
                            <a 
                              href={s.url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-[11px] text-zinc-400 hover:text-indigo-600 flex items-center gap-1 mt-0.5"
                            >
                              <span>{s.url}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-zinc-600 font-medium">
                      {s.type.replace('_', ' ')}
                    </td>

                    <td className="py-3.5 px-4">
                      {s.status === 'READY' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                          <CheckCircle2 className="w-3 h-3" /> Indexed
                        </span>
                      )}
                      {s.status === 'SYNCING' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Syncing
                        </span>
                      )}
                      {s.status === 'FAILED' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
                          <AlertCircle className="w-3 h-3" /> Failed
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-zinc-700">
                      <div className="font-semibold">{s.product_count} Products</div>
                      <div className="text-[11px] text-zinc-400">{s.document_count} Chunks</div>
                    </td>

                    <td className="py-3.5 px-4 text-zinc-500 font-medium">
                      {s.last_synced_at ? new Date(s.last_synced_at).toLocaleString() : 'Never'}
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleSyncSource(s.id)}
                          disabled={syncingId === s.id}
                          title="Re-sync"
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${syncingId === s.id ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={() => handleDeleteSource(s.id)}
                          title="Delete"
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-zinc-200 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="font-bold text-base text-zinc-900">Add AI Mode Knowledge Source</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Type selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { type: 'WEBSITE_URL', label: 'Website URL', icon: Globe },
                { type: 'FILE_UPLOAD', label: 'Upload File', icon: Upload },
                { type: 'FAQ', label: 'Store FAQs', icon: HelpCircle },
                { type: 'BUSINESS_INFO', label: 'Business Info', icon: BookOpen }
              ].map(t => {
                const Icon = t.icon;
                const isSelected = modalType === t.type;
                return (
                  <button
                    type="button"
                    key={t.type}
                    onClick={() => setModalType(t.type as any)}
                    className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-bold'
                        : 'border-zinc-200 hover:bg-zinc-50 text-zinc-600'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-zinc-500'}`} />
                    <span className="text-[11px]">{t.label}</span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleAddSource} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Source Name</label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Official Store Catalog or Return Policy"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {modalType === 'WEBSITE_URL' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Website URL</label>
                  <input
                    type="url"
                    required
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example-store.com/products"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-zinc-400 mt-1">
                    The crawler will parse Schema.org Product data, breadcrumbs, prices, and catalog tags.
                  </p>
                </div>
              )}

              {modalType !== 'WEBSITE_URL' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Content / Document Text</label>
                  <textarea
                    rows={4}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Paste store FAQs, policy details, or document text here..."
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-zinc-600 hover:bg-zinc-100 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !nameInput.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Adding...' : 'Add Knowledge Source'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
