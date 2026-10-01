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
import { fetchWithCache, getClientCachedData, invalidateClientCache } from '@/lib/client-cache';
import ChatBox from '@/components/chat/ChatBox';

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
  const [uploadedRawFile, setUploadedRawFile] = useState<File | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [activeAgentId, setActiveAgentId] = useState<string>('agent_shopmate_01');
  
  // RAG Test state
  const [testQuery, setTestQuery] = useState('');
  const [testingRag, setTestingRag] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  useEffect(() => {
    loadKnowledge();
    fetch('/api/agents')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.agents?.[0]?.id) {
          setActiveAgentId(data.agents[0].id);
        }
      })
      .catch(() => {});
  }, []);

  async function loadKnowledge() {
    try {
      const res = await fetch('/api/knowledge', { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/auth/login?redirect=' + encodeURIComponent(window.location.pathname);
        return;
      }
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
      setUploadedRawFile(file);
      setUploadedFile({ name: file.name, size: file.size });
      if (!docTitle) {
        setDocTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
      const reader = new FileReader();
      if (file.name.toLowerCase().endsWith('.pdf')) {
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          setDocContent(dataUrl);
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = (event) => {
          const text = event.target?.result as string;
          setDocContent(text || `Document: ${file?.name}`);
        };
        reader.onerror = () => {
          setDocContent(`Document: ${file?.name}\nSize: ${(file!.size / 1024).toFixed(1)} KB`);
        };
        reader.readAsText(file);
      }
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
          setModalError('Please enter a website target URL (e.g. https://bluetyga.com/pages/shipping).');
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
        setUploadedRawFile(null);
        setUploadedFile(null);
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

      let res: Response;
      if (uploadedRawFile && addTab === 'DOCUMENT') {
        const formData = new FormData();
        formData.append('file', uploadedRawFile);
        formData.append('name', payloadName || uploadedRawFile.name.replace(/\.[^/.]+$/, ''));
        formData.append('type', uploadedRawFile.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'DOCUMENT');
        if (activeAgentId) formData.append('agent_id', activeAgentId);

        res = await fetch('/api/knowledge', {
          method: 'POST',
          body: formData
        });
      } else {
        res = await fetch('/api/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: payloadName,
            type: payloadType,
            content: payloadContent,
            agent_id: activeAgentId
          })
        });
      }

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setModalError('Session expired or unauthorized. Redirecting to login...');
          setTimeout(() => {
            window.location.href = '/auth/login?redirect=' + encodeURIComponent(window.location.pathname);
          }, 1200);
          return;
        }
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
        invalidateClientCache('/api/knowledge');
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
    invalidateClientCache('/api/knowledge');
    setSelectedIds([]);
    await loadKnowledge();
  }

  async function handleRunRagTest(e: React.FormEvent) {
    e.preventDefault();
    if (!testQuery.trim() || testingRag) return;
    setTestingRag(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/agents/${activeAgentId}/chat`, {
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
          {/* LEFT KNOWLEDGE SUB-SIDEBAR (YC-Grade Clean Navigation) */}
          {/* ========================================================================= */}
          <aside className="w-64 border-r border-zinc-200/80 bg-white/70 backdrop-blur-xs flex flex-col shrink-0 p-3 select-none">
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

            {/* KNOWLEDGE TYPES Section */}
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
                  <HelpCircle className="w-3.5 h-3.5" /> Q&amp;A
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
          {/* MAIN CONTENT AREA */}
          {/* ========================================================================= */}
          <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-white m-3 rounded-2xl border border-zinc-200/80 shadow-2xs p-6 lg:p-8 space-y-6">
            
            {/* Header: Title & Action Pills */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold text-zinc-900 tracking-tight">Content &amp; Knowledge</h1>
                <p className="text-xs text-zinc-500 mt-0.5">Manage authoritative documents, live website crawls, and verified store policies.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowRagTestModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-[0.98]"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Test Chat</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-3" />
                <input
                  id="knowledge-search-input"
                  type="text"
                  placeholder="Search articles, FAQs, URLs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-zinc-50/70 border border-zinc-200/80 rounded-xl pl-9 pr-8 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 focus:bg-white transition-all shadow-2xs"
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
            {/* "ADD CONTENT" 3 QUICK ACTION CARDS */}
            {/* ========================================================================= */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-zinc-800">Add content</h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Create content */}
                <button
                  onClick={() => { setAddTab('DOCUMENT'); setShowAddModal(true); }}
                  className="bg-white hover:bg-zinc-50/80 border border-zinc-200/90 rounded-2xl p-4 text-left transition-all hover:border-zinc-300 hover:shadow-xs group flex flex-col justify-between h-28 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 border border-zinc-200/60 flex items-center justify-center text-zinc-800 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                    <Plus className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-zinc-900 block">Upload Document</span>
                    <span className="text-[11px] text-zinc-400 block mt-0.5">PDF, Markdown, CSV, TXT</span>
                  </div>
                </button>

                {/* 2. Website sync */}
                <button
                  onClick={() => { setAddTab('WEBSITE'); setShowAddModal(true); }}
                  className="bg-white hover:bg-zinc-50/80 border border-zinc-200/90 rounded-2xl p-4 text-left transition-all hover:border-zinc-300 hover:shadow-xs group flex flex-col justify-between h-28 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 border border-zinc-200/60 flex items-center justify-center text-zinc-800 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-zinc-900 block">Website Sync</span>
                    <span className="text-[11px] text-zinc-400 block mt-0.5">Live URL &amp; policy crawler</span>
                  </div>
                </button>

                {/* 3. Text & FAQ import */}
                <button
                  onClick={() => { setAddTab('FAQ'); setShowAddModal(true); }}
                  className="bg-white hover:bg-zinc-50/80 border border-zinc-200/90 rounded-2xl p-4 text-left transition-all hover:border-zinc-300 hover:shadow-xs group flex flex-col justify-between h-28 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 border border-zinc-200/60 flex items-center justify-center text-zinc-800 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-zinc-900 block">Q&amp;A / Snippet</span>
                    <span className="text-[11px] text-zinc-400 block mt-0.5">Curated FAQ pairs &amp; policies</span>
                  </div>
                </button>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* "CONTENT SOURCES" TABLE */}
            {/* ========================================================================= */}
            <div className="space-y-3 pt-1">
              <h3 className="text-xs font-semibold text-zinc-800">Content sources</h3>

              <div className="border border-zinc-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200/80 bg-zinc-50/50 text-[11px] font-semibold text-zinc-500">
                        <th className="py-3 px-4 font-semibold text-zinc-700">Title</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Scope</th>
                        <th className="py-3 px-4">Agent AI</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-xs">
                      {/* Dynamic Knowledge Items */}
                      {filteredSources.map((source) => (
                        <tr key={source.id} className="hover:bg-zinc-50/60 transition group">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-zinc-100 border border-zinc-200/60 flex items-center justify-center shrink-0">
                                {source.type === 'URL' || source.type === 'WEBSITE' ? (
                                  <Globe className="w-4 h-4 text-emerald-600" />
                                ) : source.type === 'FAQ' ? (
                                  <HelpCircle className="w-4 h-4 text-amber-600" />
                                ) : (
                                  <FileText className="w-4 h-4 text-zinc-600" />
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-zinc-900 line-clamp-1">{source.name}</p>
                                <p className="text-[11px] text-zinc-500 line-clamp-1 font-mono">{source.raw_content?.substring(0, 70)}...</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md font-medium text-[11px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Active
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-zinc-600 font-mono text-[11px]">
                            {source.type || 'DOCUMENT'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 text-xs text-zinc-700 font-medium">
                              <Check className="w-3.5 h-3.5 text-emerald-600" /> Enabled
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setPreviewDoc(source)}
                                className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 transition-colors"
                                title="View Document"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(source.id, source.name)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-zinc-400 hover:text-rose-600 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {/* Empty State Row */}
                      {filteredSources.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-zinc-500 text-xs">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200/60 flex items-center justify-center text-zinc-400 mb-1">
                                <BookOpen className="w-5 h-5" />
                              </div>
                              <p className="font-semibold text-zinc-800 text-sm">No knowledge sources connected yet</p>
                              <p className="text-xs text-zinc-400 max-w-sm">Add store guidelines, return policies, or crawl your live website to ground the AI concierge.</p>
                              <div className="flex items-center gap-2.5 mt-2">
                                <button
                                  onClick={() => { setAddTab('DOCUMENT'); setShowAddModal(true); }}
                                  className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs transition shadow-xs cursor-pointer"
                                >
                                  + Upload Document
                                </button>
                                <button
                                  onClick={() => { setAddTab('WEBSITE'); setShowAddModal(true); }}
                                  className="px-3.5 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Globe className="w-3.5 h-3.5 text-zinc-500" />
                                  Website Sync
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </main>
        </div>

        {/* Floating Success Toast */}
        {successToast && (
          <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 border border-zinc-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold">{successToast}</span>
            <button onClick={() => setSuccessToast(null)} className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ADD BUSINESS KNOWLEDGE MODAL (YC-Grade Ultra-Refined Aesthetic) */}
        {/* ========================================================================= */}
        {showAddModal && (
          <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white text-zinc-900 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl shadow-zinc-950/20 overflow-hidden border border-zinc-200/80 animate-in zoom-in-[0.98] duration-200">
              
              {/* Modal Header */}
              <div className="p-5 pb-4 flex items-center justify-between border-b border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-100 border border-zinc-200/80 flex items-center justify-center text-zinc-900 shadow-2xs">
                    {addTab === 'DOCUMENT' && <FileText className="w-4.5 h-4.5 text-zinc-700" />}
                    {addTab === 'WEBSITE' && <Globe className="w-4.5 h-4.5 text-zinc-700" />}
                    {addTab === 'FAQ' && <HelpCircle className="w-4.5 h-4.5 text-zinc-700" />}
                    {addTab === 'TEXT' && <Edit3 className="w-4.5 h-4.5 text-zinc-700" />}
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900 tracking-tight">Add Content</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Upload articles, sync website URLs, or configure Q&amp;A pairs.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => { setShowAddModal(false); setModalError(null); }}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body Form */}
              <form onSubmit={handleSaveKnowledge} className="p-5 overflow-y-auto space-y-4">
                
                {modalError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}

                {/* 4 Type Selector Tabs (Segmented Control Pill Style) */}
                <div className="grid grid-cols-4 p-1 bg-zinc-100/90 rounded-xl border border-zinc-200/70 gap-1">
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
                        className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer ${
                          isActive
                            ? 'bg-white text-zinc-900 font-semibold shadow-xs border border-zinc-200/60'
                            : 'text-zinc-600 hover:text-zinc-900 font-medium hover:bg-white/50'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-zinc-900' : 'text-zinc-500'}`} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Form Fields: Document Tab */}
                {addTab === 'DOCUMENT' && (
                  <div className="space-y-3.5 pt-1">
                    <div>
                      <label className="block text-[12px] font-medium text-zinc-700 mb-1">
                        Document Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Product Guide, Sizing & Service Policies"
                        value={docTitle}
                        onChange={(e) => setDocTitle(e.target.value)}
                        className="w-full bg-zinc-50/60 hover:bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[12px] font-medium text-zinc-700 mb-1">
                        Document File
                      </label>
                      
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleFileUpload}
                        className="border border-dashed border-zinc-300 hover:border-zinc-400 rounded-xl p-6 text-center bg-zinc-50/50 hover:bg-zinc-50 transition-all cursor-pointer group flex flex-col items-center justify-center gap-2"
                        onClick={() => document.getElementById('modal-file-input')?.click()}
                      >
                        <input
                          id="modal-file-input"
                          type="file"
                          accept=".txt,.md,.pdf,.csv,.json"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200/80 shadow-2xs flex items-center justify-center text-zinc-600 group-hover:scale-105 group-hover:text-zinc-900 transition-all">
                          <FileText className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-semibold text-zinc-800">
                          {uploadedFile ? uploadedFile.name : 'Click to browse or drag & drop file'}
                        </p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono bg-zinc-100 text-zinc-500 border border-zinc-200/60">
                          Supports TXT, Markdown, CSV, JSON (up to 10MB)
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Form Fields: Website Tab */}
                {addTab === 'WEBSITE' && (
                  <div className="space-y-3.5 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[12px] font-medium text-zinc-700">
                        Target Website or Help Center URL
                      </label>
                      <span className="text-[10px] text-zinc-400 font-mono">Live RAG Crawler</span>
                    </div>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                      <input
                        type="url"
                        placeholder="https://bluetyga.com/pages/shipping-returns"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        className="w-full bg-zinc-50/60 hover:bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all shadow-2xs"
                      />
                    </div>
                  </div>
                )}

                {/* Form Fields: FAQ Tab */}
                {addTab === 'FAQ' && (
                  <div className="space-y-3.5 pt-1">
                    <div>
                      <label className="block text-[12px] font-medium text-zinc-700 mb-1">
                        Customer Question (Q)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. What is your return window?"
                        value={faqQuestion}
                        onChange={(e) => setFaqQuestion(e.target.value)}
                        className="w-full bg-zinc-50/60 hover:bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[12px] font-medium text-zinc-700 mb-1">
                        Store Answer (A)
                      </label>
                      <textarea
                        rows={4}
                        placeholder="e.g. We accept returns within 30 days of purchase for full refund."
                        value={faqAnswer}
                        onChange={(e) => setFaqAnswer(e.target.value)}
                        className="w-full bg-zinc-50/60 hover:bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl p-3 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all shadow-2xs"
                      />
                    </div>
                  </div>
                )}

                {/* Form Fields: Text Tab */}
                {addTab === 'TEXT' && (
                  <div className="space-y-3.5 pt-1">
                    <div>
                      <label className="block text-[12px] font-medium text-zinc-700 mb-1">
                        Article Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. VIP Member Shipping Policy"
                        value={docTitle}
                        onChange={(e) => setDocTitle(e.target.value)}
                        className="w-full bg-zinc-50/60 hover:bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[12px] font-medium text-zinc-700 mb-1">
                        Content Body
                      </label>
                      <textarea
                        rows={5}
                        placeholder="Paste article text or documentation here..."
                        value={docContent}
                        onChange={(e) => setDocContent(e.target.value)}
                        className="w-full bg-zinc-50/60 hover:bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl p-3 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all shadow-2xs"
                      />
                    </div>
                  </div>
                )}

                {/* Modal Footer Buttons */}
                <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); setModalError(null); }}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
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
        {/* TEST CHAT MODAL (Authentic Storefront Widget Size & Style) */}
        {/* ========================================================================= */}
        {showRagTestModal && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setShowRagTestModal(false)}
          >
            <div 
              className="w-full max-w-[400px] h-[600px] max-h-[92vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <ChatBox 
                agentId={activeAgentId}
                agentName="ShopMate Concierge"
                brandTitle="Blue Tyga"
                subtitle="We usually reply in a few seconds"
                initialMessage="Hello! 👋 I'm ShopMate, your AI shopping concierge for Blue Tyga. How can I help you today?"
                onClose={() => setShowRagTestModal(false)}
              />
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