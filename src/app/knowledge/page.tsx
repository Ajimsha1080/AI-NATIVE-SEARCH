'use client';

import React, { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import Link from 'next/link';
import { 
  Plus, Search, FileText, Globe, RefreshCw, CheckCircle2, 
  Trash2, ExternalLink, AlertCircle, Layers, Eye, X, Play, HelpCircle, 
  ChevronRight, MoreVertical, Check, Info, Edit3, FolderPlus,
  Sparkles, SlidersHorizontal, BookOpen, ChevronDown, User, MessageSquare,
  ArrowUpRight, Database, CheckSquare, Square, Folder
} from 'lucide-react';
import { fetchWithCache, getClientCachedData } from '@/lib/client-cache';

export default function KnowledgeWorkspacePage() {
  const [sources, setSources] = useState<any[]>(() => {
    const cached = getClientCachedData('/api/knowledge');
    return cached?.documents || cached?.sources || [];
  });
  const [loading, setLoading] = useState(() => !getClientCachedData('/api/knowledge'));
  const [categoryTab, setCategoryTab] = useState<'all' | 'active' | 'disabled' | 'trash' | 'documents' | 'qa' | 'websites'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('All');
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRagTestModal, setShowRagTestModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  
  // Add Knowledge Form state
  const [addTab, setAddTab] = useState<'WEBSITE' | 'DOCUMENT' | 'FAQ' | 'TEXT'>('DOCUMENT');
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('General');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  
  // RAG Test state
  const [testQuery, setTestQuery] = useState('');
  const [testingRag, setTestingRag] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  useEffect(() => {
    loadKnowledge();
  }, []);

  async function loadKnowledge() {
    try {
      const res = await fetch('/api/knowledge', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const docs = data.documents || data.sources || [];
        setSources(docs);
      }
    } catch (err) {
      console.error('Failed to load knowledge:', err);
    } finally {
      setLoading(false);
    }
  }

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    setModalError(null);
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
      setUploadedFile({ name: file.name, size: file.size });
      if (!docTitle) {
        setDocTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setDocContent(text || `Document: ${file?.name}\n\nProcessed contents and verified guidelines for AI assistant.`);
      };
      reader.onerror = () => {
        setDocContent(`Document: ${file?.name}\nSize: ${(file!.size / 1024).toFixed(1)} KB`);
      };
      reader.readAsText(file);
    }
  };

  async function handleSaveKnowledge(e: React.FormEvent) {
    e.preventDefault();
    setModalError(null);
    setSaving(true);
    try {
      let payloadName = docTitle.trim();
      let payloadType = addTab;
      let payloadContent = docContent.trim();

      if (addTab === 'WEBSITE') {
        if (!websiteUrl.trim()) {
          setModalError('Please enter a website target URL (e.g. https://acmestore.com/pages/shipping).');
          setSaving(false);
          return;
        }
        const res = await fetch('/api/knowledge/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: websiteUrl.trim(),
            name: payloadName || undefined
          })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || data.error || 'Failed to crawl website URL');
        }
        if (data.document) {
          setSources(prev => [data.document, ...prev.filter(d => d.id !== data.document.id)]);
        }
        setShowAddModal(false);
        setDocTitle('');
        setWebsiteUrl('');
        setSuccessToast(`Successfully synced and indexed website: ${websiteUrl}`);
        setTimeout(() => setSuccessToast(null), 4000);
        await loadKnowledge();
        return;
      }

      if (addTab === 'FAQ') {
        if (!faqQuestion.trim() || !faqAnswer.trim()) {
          setModalError('Please provide both the Question (Q) and Verified Store Answer (A).');
          setSaving(false);
          return;
        }
        payloadName = payloadName || `FAQ: ${faqQuestion.trim().substring(0, 45)}...`;
        payloadContent = `### Q: ${faqQuestion.trim()}\n\n**A:** ${faqAnswer.trim()}`;
      } else if (addTab === 'DOCUMENT') {
        if (!payloadName && !uploadedFile) {
          setModalError('Please enter a document title or upload a document file.');
          setSaving(false);
          return;
        }
        if (!payloadName && uploadedFile) {
          payloadName = uploadedFile.name.replace(/\.[^/.]+$/, '');
        }
        if (!payloadContent) {
          payloadContent = `Document: ${payloadName}\n\nStandard operating guidelines, policies, and product catalog metadata for AI customer service.`;
        }
      } else if (addTab === 'TEXT') {
        if (!payloadName) {
          setModalError('Please enter an article title.');
          setSaving(false);
          return;
        }
        if (!payloadContent) {
          setModalError('Please paste or write your article or policy text.');
          setSaving(false);
          return;
        }
      }

      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: payloadName,
          type: payloadType === 'FAQ' ? 'FAQ' : 'DOCUMENT',
          content: payloadContent,
          collection: selectedCollection
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.error || 'Failed to save knowledge document');
      }

      setShowAddModal(false);
      setDocTitle('');
      setDocContent('');
      setWebsiteUrl('');
      setFaqQuestion('');
      setFaqAnswer('');
      setUploadedFile(null);
      setSuccessToast(`Successfully added and indexed "${payloadName}"!`);
      setTimeout(() => setSuccessToast(null), 4000);
      await loadKnowledge();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save knowledge document.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      const res = await fetch(`/api/knowledge?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedIds(prev => prev.filter(i => i !== id));
        await loadKnowledge();
      }
    } catch (err) {
      console.error('Failed to delete doc:', err);
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedIds.length} selected knowledge articles?`)) return;
    for (const id of selectedIds) {
      await fetch(`/api/knowledge?id=${id}`, { method: 'DELETE' });
    }
    setSelectedIds([]);
    await loadKnowledge();
  }

  async function handleRunRagTest(e: React.FormEvent) {
    e.preventDefault();
    if (!testQuery.trim() || testingRag) return;
    setTestingRag(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/agents/agent_shopmate_01/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: testQuery,
          channel: 'rag_test_suite'
        })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ error: err.message || 'Test failed' });
    } finally {
      setTestingRag(false);
    }
  }

  const countAll = sources.length;
  const countActive = sources.filter(s => s.status !== 'DISABLED' && s.status !== 'TRASH').length;
  const countDisabled = sources.filter(s => s.status === 'DISABLED').length;
  const countTrash = sources.filter(s => s.status === 'TRASH').length;
  const countDocs = sources.filter(s => s.type === 'DOCUMENT' || s.type === 'PDF' || s.type === 'TEXT' || s.type === 'MARKDOWN' || s.type === 'CSV').length;
  const countQA = sources.filter(s => s.type === 'FAQ' || s.type === 'QA' || s.type === 'Q&A').length;
  const countWebsites = sources.filter(s => s.type === 'URL' || s.type === 'WEBSITE').length;

  const filteredSources = sources.filter(s => {
    if (categoryTab === 'active' && (s.status === 'DISABLED' || s.status === 'TRASH')) return false;
    if (categoryTab === 'disabled' && s.status !== 'DISABLED') return false;
    if (categoryTab === 'trash' && s.status !== 'TRASH') return false;
    if (categoryTab === 'documents' && !(s.type === 'DOCUMENT' || s.type === 'PDF' || s.type === 'TEXT' || s.type === 'MARKDOWN' || s.type === 'CSV')) return false;
    if (categoryTab === 'qa' && !(s.type === 'FAQ' || s.type === 'QA' || s.type === 'Q&A')) return false;
    if (categoryTab === 'websites' && !(s.type === 'URL' || s.type === 'WEBSITE')) return false;

    return !searchTerm || 
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.raw_content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.type?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSources.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSources.map(s => s.id));
    }
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex h-screen bg-[#f4f5f7] text-zinc-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f4f5f7]">
        <Navbar />

        <div className="flex-1 flex overflow-hidden">
          
          {/* ========================================================================= */}
          {/* LEFT KNOWLEDGE SUB-SIDEBAR (Matches Image media_1790257914189.png) */}
          {/* ========================================================================= */}
          <aside className="w-64 border-r border-zinc-200 bg-[#f9fafb] flex flex-col shrink-0 p-3 select-none">
            <div className="space-y-1">
              {/* 1. All Sources */}
              <button
                onClick={() => setCategoryTab('all')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition cursor-pointer ${
                  categoryTab === 'all'
                    ? 'bg-[#e0f2fe] text-zinc-950 font-bold shadow-2xs'
                    : 'text-zinc-700 hover:bg-zinc-200/50 hover:text-zinc-950'
                }`}
              >
                <span>All Sources</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                  categoryTab === 'all' ? 'bg-[#bae6fd] text-sky-950' : 'text-zinc-500'
                }`}>
                  {countAll}
                </span>
              </button>

              {/* 2. Active */}
              <button
                onClick={() => setCategoryTab('active')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-medium transition cursor-pointer ${
                  categoryTab === 'active'
                    ? 'bg-[#e0f2fe] text-zinc-950 font-bold shadow-2xs'
                    : 'text-zinc-700 hover:bg-zinc-200/50 hover:text-zinc-950'
                }`}
              >
                <span>Active</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold ${
                  categoryTab === 'active' ? 'bg-[#bae6fd] text-sky-950' : 'text-zinc-500'
                }`}>
                  {countActive}
                </span>
              </button>

              {/* 3. Disabled */}
              <button
                onClick={() => setCategoryTab('disabled')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-medium transition cursor-pointer ${
                  categoryTab === 'disabled'
                    ? 'bg-[#e0f2fe] text-zinc-950 font-bold shadow-2xs'
                    : 'text-zinc-700 hover:bg-zinc-200/50 hover:text-zinc-950'
                }`}
              >
                <span>Disabled</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold ${
                  categoryTab === 'disabled' ? 'bg-[#bae6fd] text-sky-950' : 'text-zinc-500'
                }`}>
                  {countDisabled}
                </span>
              </button>

              {/* 4. Trash (30-day) */}
              <button
                onClick={() => setCategoryTab('trash')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-medium transition cursor-pointer ${
                  categoryTab === 'trash'
                    ? 'bg-[#e0f2fe] text-zinc-950 font-bold shadow-2xs'
                    : 'text-zinc-700 hover:bg-zinc-200/50 hover:text-zinc-950'
                }`}
              >
                <span>Trash (30-day)</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold ${
                  categoryTab === 'trash' ? 'bg-[#bae6fd] text-sky-950' : 'text-zinc-500'
                }`}>
                  {countTrash}
                </span>
              </button>
            </div>

            {/* Divider */}
            <div className="h-[1px] bg-zinc-200 my-4" />

            {/* COARAI ASSISTANT AI Section */}
            <div className="space-y-1">
              <div className="px-3.5 py-1.5 flex items-center justify-between text-[11px] font-bold font-mono tracking-wider text-zinc-900 uppercase">
                <span>COARAI ASSISTANT AI</span>
                <Info className="w-3.5 h-3.5 text-zinc-400" />
              </div>

              {/* Documents */}
              <button
                onClick={() => setCategoryTab('documents')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-medium transition cursor-pointer ${
                  categoryTab === 'documents'
                    ? 'bg-[#e0f2fe] text-zinc-950 font-bold shadow-2xs'
                    : 'text-zinc-700 hover:bg-zinc-200/50 hover:text-zinc-950'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-zinc-500" /> Documents
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold ${
                  categoryTab === 'documents' ? 'bg-[#bae6fd] text-sky-950' : 'text-zinc-500'
                }`}>
                  {countDocs}
                </span>
              </button>

              {/* Q&A */}
              <button
                onClick={() => setCategoryTab('qa')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-medium transition cursor-pointer ${
                  categoryTab === 'qa'
                    ? 'bg-[#e0f2fe] text-zinc-950 font-bold shadow-2xs'
                    : 'text-zinc-700 hover:bg-zinc-200/50 hover:text-zinc-950'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <HelpCircle className="w-4 h-4 text-zinc-500" /> Q&amp;A
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold ${
                  categoryTab === 'qa' ? 'bg-[#bae6fd] text-sky-950' : 'text-zinc-500'
                }`}>
                  {countQA}
                </span>
              </button>

              {/* Websites */}
              <button
                onClick={() => setCategoryTab('websites')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-medium transition cursor-pointer ${
                  categoryTab === 'websites'
                    ? 'bg-[#e0f2fe] text-zinc-950 font-bold shadow-2xs'
                    : 'text-zinc-700 hover:bg-zinc-200/50 hover:text-zinc-950'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-zinc-500" /> Websites
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold ${
                  categoryTab === 'websites' ? 'bg-[#bae6fd] text-sky-950' : 'text-zinc-500'
                }`}>
                  {countWebsites}
                </span>
              </button>
            </div>
          </aside>

          {/* ========================================================================= */}
          {/* MAIN CONTENT AREA (Matches Image media_1790248746644.png) */}
          {/* ========================================================================= */}
          <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-white m-3 rounded-2xl border border-zinc-200 shadow-xs p-6 lg:p-8 space-y-6">
            
            {/* Header: Title & Action Pills */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 border border-zinc-400 rounded flex items-center justify-center">
                  <div className="w-2.5 h-2.5 bg-zinc-900 rounded-xs"></div>
                </div>
                <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Content</h1>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowRagTestModal(true)}
                  className="px-3.5 py-1.5 rounded-full bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border border-zinc-200 text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-zinc-700" />
                  <span>Operator</span>
                </button>

                <button
                  onClick={() => setShowRagTestModal(true)}
                  className="px-3.5 py-1.5 rounded-full bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border border-zinc-200 text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
                >
                  <BookOpen className="w-3.5 h-3.5 text-zinc-700" />
                  <span>Learn</span>
                  <ChevronDown className="w-3 h-3 text-zinc-500" />
                </button>

                <Link
                  href="/agents/agent_shopmate_01/playground"
                  className="px-4 py-1.5 rounded-full bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border border-zinc-200 text-xs font-semibold transition shadow-2xs"
                >
                  Preview
                </Link>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              {/* Search input with clear */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  id="knowledge-search-input"
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-zinc-50/70 border border-zinc-200 rounded-xl pl-9 pr-8 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* "ADD CONTENT" 4 QUICK ACTION CARDS (Matches Screenshot Grid) */}
            {/* ========================================================================= */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-zinc-900">Add content</h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Create content */}
                <button
                  onClick={() => { setAddTab('DOCUMENT'); setShowAddModal(true); }}
                  className="bg-white hover:bg-zinc-50 border border-zinc-200 rounded-2xl p-5 text-left transition-all hover:border-zinc-300 hover:shadow-xs group flex flex-col justify-between h-32"
                >
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-800 group-hover:bg-zinc-200 transition">
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <span className="text-xs font-bold text-zinc-900">Create content</span>
                </button>

                {/* 2. Website sync */}
                <button
                  onClick={() => { setAddTab('WEBSITE'); setShowAddModal(true); }}
                  className="bg-white hover:bg-zinc-50 border border-zinc-200 rounded-2xl p-5 text-left transition-all hover:border-zinc-300 hover:shadow-xs group flex flex-col justify-between h-32"
                >
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-800 group-hover:bg-zinc-200 transition">
                    <Globe className="w-4 h-4 text-zinc-700" />
                  </div>
                  <span className="text-xs font-bold text-zinc-900">Website sync</span>
                </button>

                {/* 3. Other syncs & imports */}
                <button
                  onClick={() => { setAddTab('TEXT'); setShowAddModal(true); }}
                  className="bg-white hover:bg-zinc-50 border border-zinc-200 rounded-2xl p-5 text-left transition-all hover:border-zinc-300 hover:shadow-xs group flex flex-col justify-between h-32"
                >
                  <div className="flex items-center gap-1.5">
                    <div className="w-7 h-7 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-800">
                      ⚡
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-800">
                      N
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-500">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-zinc-900">Other syncs &amp; imports</span>
                </button>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* "CONTENT SOURCES" TABLE (Matches Screenshot Matrix) */}
            {/* ========================================================================= */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-zinc-900">Content sources</h3>

              <div className="border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50/50 text-[11px] font-semibold text-zinc-500">
                        <th className="py-3 px-4 font-semibold text-zinc-700">
                          <div className="flex items-center gap-1.5">
                            <span>Title</span>
                            <span className="text-[10px] text-zinc-400">⇅</span>
                          </div>
                        </th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Help Center</th>
                        <th className="py-3 px-4">Copilot</th>
                        <th className="py-3 px-4">Service</th>
                        <th className="py-3 px-4">Sales</th>
                        <th className="py-3 px-4">Ecommerce</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-xs">
                      {/* Default Master Row */}
                      <tr className="hover:bg-zinc-50/60 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <FileText className="w-4 h-4 text-zinc-700 shrink-0" />
                            <div>
                              <strong className="font-semibold text-zinc-900">Articles</strong>
                              <span className="text-zinc-500 ml-1.5 text-[11px]">· Snippets, public, internal, docs</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium text-xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            {sources.length} Live
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400 font-mono">—</td>
                        <td className="py-3.5 px-4 text-zinc-400 font-mono">—</td>
                        <td className="py-3.5 px-4 text-zinc-400 font-mono">—</td>
                        <td className="py-3.5 px-4 text-zinc-400 font-mono">—</td>
                        <td className="py-3.5 px-4">
                          <span className="text-xs text-zinc-700 font-semibold">✓ Active</span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setShowAddModal(true)}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            + Add
                          </button>
                        </td>
                      </tr>

                      {/* Dynamic Knowledge Items */}
                      {filteredSources.map((source) => (
                        <tr key={source.id} className="hover:bg-zinc-50/60 transition group">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              {source.type === 'URL' || source.type === 'WEBSITE' ? (
                                <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : source.type === 'FAQ' ? (
                                <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                              ) : (
                                <FileText className="w-4 h-4 text-zinc-600 shrink-0" />
                              )}
                              <div>
                                <p className="font-semibold text-zinc-900 line-clamp-1">{source.name}</p>
                                <p className="text-[11px] text-zinc-500 line-clamp-1 font-mono">{source.raw_content?.substring(0, 70)}...</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium text-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Active
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-zinc-400 font-mono">—</td>
                          <td className="py-3.5 px-4 text-emerald-600 font-semibold text-xs">✓ Enabled</td>
                          <td className="py-3.5 px-4 text-emerald-600 font-semibold text-xs">✓ Enabled</td>
                          <td className="py-3.5 px-4 text-zinc-400 font-mono">—</td>
                          <td className="py-3.5 px-4 text-emerald-600 font-semibold text-xs">✓ Store</td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setPreviewDoc(source)}
                                className="p-1 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900"
                                title="View Document"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(source.id, source.name)}
                                className="p-1 rounded hover:bg-rose-100 text-zinc-500 hover:text-rose-600"
                                title="Delete"
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
            </div>

          </main>
        </div>

        {/* Floating Success Toast */}
        {successToast && (
          <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold">{successToast}</span>
            <button onClick={() => setSuccessToast(null)} className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ADD BUSINESS KNOWLEDGE MODAL */}
        {/* ========================================================================= */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white text-zinc-900 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-zinc-200">
              
              {/* Modal Header */}
              <div className="p-6 pb-4 flex items-start justify-between border-b border-zinc-100">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 tracking-tight">Add Content</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Upload articles, sync website URLs, or configure Q&amp;A pairs.
                  </p>
                </div>
                <button 
                  onClick={() => { setShowAddModal(false); setModalError(null); }}
                  className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body Form */}
              <form onSubmit={handleSaveKnowledge} className="p-6 overflow-y-auto space-y-5">
                
                {modalError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}

                {/* 4 Type Selector Tabs */}
                <div className="grid grid-cols-4 gap-2.5">
                  {[
                    { id: 'DOCUMENT', label: 'Document', icon: FileText },
                    { id: 'WEBSITE', label: 'Website', icon: Globe },
                    { id: 'FAQ', label: 'FAQ', icon: HelpCircle },
                    { id: 'TEXT', label: 'Text', icon: Edit3 },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = addTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => { setAddTab(tab.id as any); setModalError(null); }}
                        className={`py-3 px-2 rounded-2xl flex flex-col items-center justify-center gap-1.5 border transition-all text-xs font-semibold ${
                          isActive
                            ? 'bg-[#18181b] text-white border-[#18181b] shadow-xs'
                            : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                        }`}
                      >
                        <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-white' : 'text-zinc-600'}`} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Form Fields: Document Tab */}
                {addTab === 'DOCUMENT' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-800 mb-1.5">
                        Document Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Product Guide, Sizing & Service Policies"
                        value={docTitle}
                        onChange={(e) => setDocTitle(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-800 mb-1.5">
                        Document File
                      </label>
                      
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleFileUpload}
                        className="border-2 border-dashed border-zinc-300 hover:border-zinc-400 rounded-2xl p-6 text-center bg-zinc-50/50 hover:bg-zinc-50 transition cursor-pointer"
                        onClick={() => document.getElementById('modal-file-input')?.click()}
                      >
                        <input
                          id="modal-file-input"
                          type="file"
                          accept=".txt,.md,.pdf,.csv,.json"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <FileText className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-zinc-800">
                          {uploadedFile ? uploadedFile.name : 'Click to browse or drag & drop file'}
                        </p>
                        <p className="text-[11px] text-zinc-400 mt-1 font-mono">
                          Supports TXT, Markdown, CSV, JSON (up to 10MB)
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Form Fields: Website Tab */}
                {addTab === 'WEBSITE' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-zinc-800">
                        Target Website or Help Center URL
                      </label>
                      <span className="text-[11px] text-zinc-500 font-mono">Live RAG Crawler</span>
                    </div>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                      <input
                        type="url"
                        placeholder="https://acmestore.com/pages/shipping-returns"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                      />
                    </div>
                  </div>
                )}

                {/* Form Fields: FAQ Tab */}
                {addTab === 'FAQ' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-800 mb-1">
                        Customer Question (Q)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. What is your return window?"
                        value={faqQuestion}
                        onChange={(e) => setFaqQuestion(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-800 mb-1">
                        Store Answer (A)
                      </label>
                      <textarea
                        rows={4}
                        placeholder="e.g. We accept returns within 30 days of purchase for full refund."
                        value={faqAnswer}
                        onChange={(e) => setFaqAnswer(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                      />
                    </div>
                  </div>
                )}

                {/* Form Fields: Text Tab */}
                {addTab === 'TEXT' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-800 mb-1">
                        Article Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. VIP Member Shipping Policy"
                        value={docTitle}
                        onChange={(e) => setDocTitle(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-800 mb-1">
                        Content Body
                      </label>
                      <textarea
                        rows={5}
                        placeholder="Paste article text or documentation here..."
                        value={docContent}
                        onChange={(e) => setDocContent(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                      />
                    </div>
                  </div>
                )}

                {/* Modal Footer Buttons */}
                <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); setModalError(null); }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-[#18181b] hover:bg-[#27272a] text-white text-xs font-bold transition shadow-xs flex items-center gap-2"
                  >
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>{saving ? 'Indexing...' : 'Save & Index'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* RAG TEST MODAL */}
        {/* ========================================================================= */}
        {showRagTestModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white text-zinc-900 rounded-3xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-zinc-200">
              <div className="p-6 pb-4 flex items-start justify-between border-b border-zinc-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 tracking-tight">Operator RAG Test</h2>
                    <p className="text-xs text-zinc-500">Query indexed articles and test semantic grounding</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowRagTestModal(false)}
                  className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRunRagTest} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-800 mb-1.5">
                    Test Customer Query
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. How do I return a damaged jacket?"
                      value={testQuery}
                      onChange={(e) => setTestQuery(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-4 pr-24 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                    />
                    <button
                      type="submit"
                      disabled={testingRag || !testQuery.trim()}
                      className="absolute right-1.5 top-1.5 px-3 py-1.5 rounded-lg bg-[#18181b] text-white text-xs font-semibold hover:bg-[#27272a] disabled:opacity-50 transition"
                    >
                      {testingRag ? 'Testing...' : 'Run Query'}
                    </button>
                  </div>
                </div>

                {testResult && (
                  <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-2">
                    <h4 className="text-xs font-bold text-zinc-800">AI Response:</h4>
                    <p className="text-xs text-zinc-700 leading-relaxed">{testResult.response || JSON.stringify(testResult)}</p>
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Document Preview Modal */}
        {previewDoc && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white text-zinc-900 rounded-3xl w-full max-w-xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden border border-zinc-200">
              <div className="p-6 pb-4 flex items-start justify-between border-b border-zinc-100">
                <div>
                  <h3 className="text-base font-bold text-zinc-900">{previewDoc.name}</h3>
                  <p className="text-xs text-zinc-500 font-mono mt-0.5">Type: {previewDoc.type || 'DOCUMENT'}</p>
                </div>
                <button onClick={() => setPreviewDoc(null)} className="p-1 rounded-full hover:bg-zinc-100 text-zinc-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                <pre className="text-xs text-zinc-800 font-mono whitespace-pre-wrap bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                  {previewDoc.raw_content || previewDoc.content || 'No content preview available.'}
                </pre>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}