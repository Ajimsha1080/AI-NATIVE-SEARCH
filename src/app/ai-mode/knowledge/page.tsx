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
  BookOpen,
  Search,
  Eye,
  Info,
  Check,
  Layers,
  UploadCloud,
  FileCode,
  ShieldCheck,
  Database
} from 'lucide-react';
import { AIModeKnowledgeSource } from '@/ai-mode/types';

export default function AIModeKnowledgePage() {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryTab, setCategoryTab] = useState<'all' | 'active' | 'disabled' | 'trash' | 'documents' | 'qa' | 'websites'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab] = useState<'DOCUMENT' | 'WEBSITE' | 'FAQ'>('WEBSITE');
  const [previewSource, setPreviewSource] = useState<any | null>(null);
  
  // Form fields
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  useEffect(() => {
    loadSources();
  }, []);

  function extractDomainKey(nameOrUrl: string): string {
    if (!nameOrUrl) return '';
    let str = nameOrUrl.toLowerCase().trim();
    str = str.replace(/https?:\/\//g, '').replace(/^(www\.)/g, '');
    str = str.replace(/\s*\(store pages & policies\)/gi, '').replace(/\s*\(store pages\)/gi, '').replace(/\s*\(store\)/gi, '');
    str = str.split('/')[0].split('?')[0].trim();
    return str;
  }

  async function loadSources() {
    setLoading(true);
    try {
      const res = await fetch('/api/ai-mode/knowledge');
      if (res.ok) {
        const aiData = await res.json();
        setSources(aiData.sources || []);
      }
    } catch (err) {
      console.error('Failed to load knowledge sources:', err);
    } finally {
      setLoading(false);
    }
  }

  // Handle File Upload for documents
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    setError(null);
    let file: File | null = null;
    if ('dataTransfer' in e) {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        file = e.dataTransfer.files[0];
      }
    } else if (e.target.files && e.target.files.length > 0) {
      file = e.target.files[0];
    }

    if (file) {
      setUploadedFileName(file.name);
      if (!name) {
        setName(file.name.replace(/\.[^/.]+$/, ''));
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setContent(text || `Document: ${file?.name}`);
      };
      reader.onerror = () => {
        setContent(`Document: ${file?.name} (binary)`);
      };
      reader.readAsText(file);
    }
  };

  async function handleAddSource(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      let body: any = { type: addTab };
      if (addTab === 'WEBSITE') {
        if (!url.trim()) throw new Error('Please enter a target website URL');
        body.url = url.trim();
        body.name = name.trim() || url.trim();

        // Trigger AI Mode knowledge sync crawler for full catalog extraction
        await fetch('/api/ai-mode/knowledge/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url.trim(), name: name.trim() || undefined })
        }).catch(() => {});
      } else if (addTab === 'FAQ') {
        if (!faqQuestion.trim() || !faqAnswer.trim()) throw new Error('Please fill in both question and answer');
        body.name = faqQuestion.trim();
        body.content = `Q: ${faqQuestion.trim()}\nA: ${faqAnswer.trim()}`;
      } else {
        if (!name.trim() || !content.trim()) throw new Error('Please fill in document name and content');
        body.name = name.trim();
        body.content = content.trim();
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
    setSyncingId(id);
    try {
      await fetch('/api/ai-mode/knowledge/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      await loadSources();
    } catch (e) {
      console.error(e);
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to remove "${name || 'this source'}"?`)) return;
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
    setUploadedFileName(null);
    setError(null);
  }

  // Counts for Left Sidebar
  const countAll = sources.length;
  const countActive = sources.filter(s => s.status !== 'DISABLED' && s.status !== 'ERROR').length;
  const countDisabled = sources.filter(s => s.status === 'DISABLED').length;
  const countTrash = 0;
  const countDocs = sources.filter(s => s.type === 'DOCUMENT' || s.type === 'PDF' || s.type === 'TEXT' || s.type === 'MARKDOWN' || s.type === 'CSV').length;
  const countQA = sources.filter(s => s.type === 'FAQ' || s.type === 'QA' || s.type === 'Q&A').length;
  const countWebsites = sources.filter(s => s.type === 'URL' || s.type === 'WEBSITE').length;

  const filteredSources = sources.filter(s => {
    if (categoryTab === 'active' && (s.status === 'DISABLED' || s.status === 'ERROR')) return false;
    if (categoryTab === 'disabled' && s.status !== 'DISABLED') return false;
    if (categoryTab === 'trash') return false;
    if (categoryTab === 'documents' && !(s.type === 'DOCUMENT' || s.type === 'PDF' || s.type === 'TEXT' || s.type === 'MARKDOWN' || s.type === 'CSV')) return false;
    if (categoryTab === 'qa' && !(s.type === 'FAQ' || s.type === 'QA' || s.type === 'Q&A')) return false;
    if (categoryTab === 'websites' && !(s.type === 'URL' || s.type === 'WEBSITE')) return false;

    return !searchTerm || 
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.source_url?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.raw_content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.type?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="flex h-[calc(100vh-105px)] bg-[#f4f5f7] text-zinc-900 font-sans antialiased overflow-hidden">
      {/* ========================================================================= */}
      {/* LEFT KNOWLEDGE SUB-SIDEBAR */}
      {/* ========================================================================= */}
      <aside className="w-60 border-r border-zinc-200/80 bg-white/70 backdrop-blur-xs flex flex-col shrink-0 p-3 select-none overflow-y-auto">
        <div className="space-y-1">
          {/* 1. All Sources */}
          <button
            onClick={() => setCategoryTab('all')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              categoryTab === 'all'
                ? 'bg-zinc-900 text-white font-semibold shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            <span>All Sources</span>
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-medium ${
              categoryTab === 'all' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-400 bg-zinc-100'
            }`}>
              {countAll}
            </span>
          </button>

          {/* 2. Active */}
          <button
            onClick={() => setCategoryTab('active')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              categoryTab === 'active'
                ? 'bg-zinc-900 text-white font-semibold shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            <span>Active</span>
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-medium ${
              categoryTab === 'active' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-400 bg-zinc-100'
            }`}>
              {countActive}
            </span>
          </button>

          {/* 3. Disabled */}
          <button
            onClick={() => setCategoryTab('disabled')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              categoryTab === 'disabled'
                ? 'bg-zinc-900 text-white font-semibold shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            <span>Disabled</span>
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-medium ${
              categoryTab === 'disabled' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-400 bg-zinc-100'
            }`}>
              {countDisabled}
            </span>
          </button>

          {/* 4. Trash (30-day) */}
          <button
            onClick={() => setCategoryTab('trash')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              categoryTab === 'trash'
                ? 'bg-zinc-900 text-white font-semibold shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            <span>Trash (30-day)</span>
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-medium ${
              categoryTab === 'trash' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-400 bg-zinc-100'
            }`}>
              {countTrash}
            </span>
          </button>
        </div>

        {/* Divider */}
        <div className="h-[1px] bg-zinc-200/80 my-3" />

        {/* KNOWLEDGE BASE Section */}
        <div className="space-y-1">
          <div className="px-3 py-1 flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            <span>Knowledge Base</span>
            <Info className="w-3.5 h-3.5 text-zinc-400" />
          </div>

          {/* Documents */}
          <button
            onClick={() => setCategoryTab('documents')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              categoryTab === 'documents'
                ? 'bg-zinc-900 text-white font-semibold shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" /> Documents
            </span>
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-medium ${
              categoryTab === 'documents' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-400 bg-zinc-100'
            }`}>
              {countDocs}
            </span>
          </button>

          {/* Q&A */}
          <button
            onClick={() => setCategoryTab('qa')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              categoryTab === 'qa'
                ? 'bg-zinc-900 text-white font-semibold shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <HelpCircle className="w-3.5 h-3.5" /> Q&A
            </span>
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-medium ${
              categoryTab === 'qa' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-400 bg-zinc-100'
            }`}>
              {countQA}
            </span>
          </button>

          {/* Websites */}
          <button
            onClick={() => setCategoryTab('websites')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              categoryTab === 'websites'
                ? 'bg-zinc-900 text-white font-semibold shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5" /> Websites
            </span>
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-medium ${
              categoryTab === 'websites' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-400 bg-zinc-100'
            }`}>
              {countWebsites}
            </span>
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* RIGHT MAIN CONTENT AREA */}
      {/* ========================================================================= */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
        {/* Top Header */}
        <div>
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Content &amp; Knowledge</h2>
          <p className="text-xs text-zinc-500 mt-1">Manage authoritative documents, live website crawls, and verified store policies.</p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search articles, FAQs, URLs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 shadow-2xs transition"
          />
        </div>

        {/* Add Content Quick Action Cards */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-zinc-700">Add content</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Card 1: Upload Document */}
            <div
              onClick={() => {
                resetForm();
                setAddTab('DOCUMENT');
                setShowAddModal(true);
              }}
              className="bg-white rounded-2xl border border-zinc-200/90 p-4 shadow-2xs hover:border-zinc-400 hover:shadow-xs transition-all cursor-pointer group flex items-start gap-3.5"
            >
              <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white transition shrink-0">
                <Plus className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-zinc-900 group-hover:text-indigo-600 transition">Upload Document</h4>
                <p className="text-[11px] text-zinc-500 mt-0.5 truncate">PDF, Markdown, CSV, TXT</p>
              </div>
            </div>

            {/* Card 2: Website Sync */}
            <div
              onClick={() => {
                resetForm();
                setAddTab('WEBSITE');
                setShowAddModal(true);
              }}
              className="bg-white rounded-2xl border border-zinc-200/90 p-4 shadow-2xs hover:border-zinc-400 hover:shadow-xs transition-all cursor-pointer group flex items-start gap-3.5"
            >
              <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white transition shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-zinc-900 group-hover:text-indigo-600 transition">Website Sync</h4>
                <p className="text-[11px] text-zinc-500 mt-0.5 truncate">Live URL &amp; policy crawler</p>
              </div>
            </div>

            {/* Card 3: Q&A / Snippet */}
            <div
              onClick={() => {
                resetForm();
                setAddTab('FAQ');
                setShowAddModal(true);
              }}
              className="bg-white rounded-2xl border border-zinc-200/90 p-4 shadow-2xs hover:border-zinc-400 hover:shadow-xs transition-all cursor-pointer group flex items-start gap-3.5"
            >
              <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white transition shrink-0">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-zinc-900 group-hover:text-indigo-600 transition">Q&amp;A / Snippet</h4>
                <p className="text-[11px] text-zinc-500 mt-0.5 truncate">Curated FAQ pairs &amp; policies</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content Sources Table Section */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-zinc-700">Content sources</h3>

          <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-2xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-xs text-zinc-400 space-y-2">
                <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin mx-auto" />
                <span>Loading store knowledge sources...</span>
              </div>
            ) : filteredSources.length === 0 ? (
              <div className="p-12 text-center text-zinc-400 text-xs space-y-2">
                <BookOpen className="w-8 h-8 text-zinc-300 mx-auto" />
                <h4 className="text-xs font-bold text-zinc-700">No knowledge sources found</h4>
                <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">Click one of the cards above to sync your website, upload documents, or add FAQ snippets.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50/50 text-[11px] font-semibold text-zinc-500">
                      <th className="py-3 px-4">Title</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Scope</th>
                      <th className="py-3 px-4">Agent AI</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-xs">
                    {filteredSources.map((source, idx) => {
                      const isWeb = source.type === 'WEBSITE' || source.type === 'URL';
                      const isFaq = source.type === 'FAQ' || source.type === 'QA';
                      const isIndexing = syncingId === source.id || source.status === 'INDEXING';
                      
                      const subtitle = source.raw_content 
                        ? source.raw_content.replace(/\n/g, ' ').substring(0, 90) + '...'
                        : (source.source_url || 'Store knowledge entity');

                      return (
                        <tr key={source.id || idx} className="hover:bg-zinc-50/60 transition group">
                          {/* Title Column */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-zinc-100 border border-zinc-200/60 flex items-center justify-center text-zinc-600 shrink-0">
                                {isWeb ? <Globe className="w-4 h-4 text-indigo-600" /> : isFaq ? <HelpCircle className="w-4 h-4 text-amber-600" /> : <FileText className="w-4 h-4 text-zinc-700" />}
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-zinc-900 block truncate" title={source.name}>
                                  {source.name}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-mono block truncate max-w-md">
                                  {subtitle}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Status Column */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isIndexing ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                Syncing
                              </span>
                            ) : source.status === 'ERROR' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                • Error
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                • Active
                              </span>
                            )}
                          </td>

                          {/* Scope Column */}
                          <td className="py-3.5 px-4 whitespace-nowrap text-zinc-600 font-mono text-[11px]">
                            {isWeb ? 'URL' : isFaq ? 'FAQ' : 'DOCUMENT'}
                          </td>

                          {/* Agent AI Column */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-700">
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              Enabled
                            </span>
                          </td>

                          {/* Actions Column */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {/* Re-sync Button (for websites) */}
                              {isWeb && (
                                <button
                                  onClick={() => handleSync(source.id)}
                                  disabled={isIndexing}
                                  title="Re-crawl & sync products"
                                  className="p-1.5 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition cursor-pointer disabled:opacity-40"
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 ${isIndexing ? 'animate-spin' : ''}`} />
                                </button>
                              )}

                              {/* Inspect / View Button */}
                              <button
                                onClick={() => setPreviewSource(source)}
                                title="Inspect content chunks"
                                className="p-1.5 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={() => handleDelete(source.id, source.name)}
                                title="Delete source"
                                className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* MODAL: ADD KNOWLEDGE SOURCE */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-bold text-zinc-900">Add Content to Knowledge</h3>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Type Selector Tabs */}
            <div className="grid grid-cols-3 gap-2 bg-zinc-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setAddTab('WEBSITE')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  addTab === 'WEBSITE' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5" /> Website
              </button>
              <button
                type="button"
                onClick={() => setAddTab('DOCUMENT')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  addTab === 'DOCUMENT' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Document
              </button>
              <button
                type="button"
                onClick={() => setAddTab('FAQ')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  addTab === 'FAQ' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" /> Q&amp;A
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleAddSource} className="space-y-4">
              {addTab === 'WEBSITE' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-700 block mb-1">Target Website URL *</label>
                    <input
                      type="url"
                      required
                      placeholder="https://yourstore.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
                    />
                    <p className="text-[10px] text-zinc-400 mt-1">Deep-crawls catalog products, canonical source URLs, shipping &amp; return policies.</p>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-zinc-700 block mb-1">Source Label (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Official Store Catalog"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
                    />
                  </div>
                </div>
              )}

              {addTab === 'DOCUMENT' && (
                <div className="space-y-3">
                  {/* File Drag and Drop Zone */}
                  <label className="block border-2 border-dashed border-zinc-200 hover:border-zinc-400 bg-zinc-50/50 rounded-2xl p-4 text-center cursor-pointer transition">
                    <UploadCloud className="w-6 h-6 text-zinc-400 mx-auto mb-1" />
                    <span className="text-xs font-semibold text-zinc-700 block">
                      {uploadedFileName ? `Selected: ${uploadedFileName}` : 'Click to select or drag & drop file'}
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">PDF, Markdown, CSV, TXT files supported</span>
                    <input type="file" accept=".pdf,.txt,.md,.csv,.json" onChange={handleFileUpload} className="hidden" />
                  </label>

                  <div>
                    <label className="text-[11px] font-bold text-zinc-700 block mb-1">Document Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 2026 Festive Season Catalog"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-zinc-700 block mb-1">Document Text Content *</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Paste or edit document text chunks here..."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 font-mono"
                    />
                  </div>
                </div>
              )}

              {addTab === 'FAQ' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-700 block mb-1">Customer Question *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. What is your return and exchange window?"
                      value={faqQuestion}
                      onChange={(e) => setFaqQuestion(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-zinc-700 block mb-1">Verified Policy Answer *</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="e.g. We accept returns within 7 days of delivery for all unworn apparel with tags intact."
                      value={faqAnswer}
                      onChange={(e) => setFaqAnswer(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{saving ? 'Ingesting...' : 'Add Knowledge'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PREVIEW & INSPECT CHUNKS */}
      {/* ========================================================================= */}
      {previewSource && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-700">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-900">{previewSource.name}</h3>
                  <p className="text-[10px] text-zinc-400 font-mono">Scope: {previewSource.type} | Status: {previewSource.status}</p>
                </div>
              </div>
              <button onClick={() => setPreviewSource(null)} className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {previewSource.source_url && (
              <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-[11px] flex items-center justify-between">
                <span className="font-mono text-zinc-600 truncate">{previewSource.source_url}</span>
                <a href={previewSource.source_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1 shrink-0 ml-2">
                  <span>Visit URL</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-700">Ingested Policy &amp; Content Chunks</label>
              <div className="max-h-72 overflow-y-auto p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200 text-xs font-mono text-zinc-700 whitespace-pre-wrap leading-relaxed">
                {previewSource.raw_content || 'No raw text available for this source.'}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-[11px] text-zinc-500">
              <span>Indexed: {new Date(previewSource.created_at || Date.now()).toLocaleDateString()}</span>
              <button
                onClick={() => setPreviewSource(null)}
                className="px-4 py-1.5 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
