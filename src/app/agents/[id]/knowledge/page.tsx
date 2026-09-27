'use client';

import React, { useEffect, useState, use } from 'react';
import Navbar from '@/components/layout/Navbar';
import StudioSidebar from '@/components/layout/StudioSidebar';
import { 
  BookOpen, Upload, Search, Trash2, FileText, Globe, 
  CheckCircle2, AlertCircle, RefreshCw, Sparkles 
} from 'lucide-react';

export default function KnowledgePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const agentId = resolvedParams.id;
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [docName, setDocName] = useState('');
  const [docContent, setDocContent] = useState('');
  const [docType, setDocType] = useState('PDF');
  const [uploading, setUploading] = useState(false);

  const [urlToScrape, setUrlToScrape] = useState('');
  const [scraping, setScraping] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadDocs = () => {
    fetch('/api/knowledge')
      .then(r => r.json())
      .then(d => {
        setDocuments(d.documents || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadDocs();
  }, [agentId]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName || !docContent) return;
    setUploading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: docName, content: docContent, type: docType, agent_id: agentId })
      });
      if (!res.ok) throw new Error('Upload failed');
      setDocName('');
      setDocContent('');
      loadDocs();
    } catch (err: any) {
      setErrorMsg(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlToScrape) return;
    setScraping(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/knowledge/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToScrape, agent_id: agentId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Scrape failed');
      setUrlToScrape('');
      loadDocs();
    } catch (err: any) {
      setErrorMsg(err.message || 'Website sync failed');
    } finally {
      setScraping(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this document?')) return;
    await fetch(`/api/knowledge?id=${id}`, { method: 'DELETE' });
    loadDocs();
  };

  const handleSearchTest = async () => {
    if (!searchQuery) return;
    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: searchQuery, channel: 'PLAYGROUND' })
      });
      const d = await res.json();
      setSearchResults(d.trace?.retrieved_citations || []);
    } catch (e) {}
  };

  return (
    <div className="flex h-screen bg-[#f4f5f7] text-zinc-900 font-sans antialiased overflow-hidden selection:bg-zinc-200">
      <StudioSidebar agentId={agentId} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="max-w-6xl mx-auto space-y-6">
            <div>
              <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Knowledge Base & RAG Engine</h1>
              <p className="text-xs text-zinc-600 mt-1">Upload store policies, size charts, return rules, and FAQ documents with semantic vector search.</p>
            </div>

            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 shadow-2xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Upload Document Form */}
              <form onSubmit={handleUpload} className="p-6 rounded-2xl bg-white border border-zinc-200 space-y-4 shadow-2xs">
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                  <Upload className="h-4 w-4 text-zinc-500" />
                  <span>Ingest Document (PDF, TXT, DOCX, CSV)</span>
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">Document Title</label>
                    <input
                      type="text"
                      required
                      value={docName}
                      onChange={e => setDocName(e.target.value)}
                      placeholder="e.g. Return Policy 2026.pdf"
                      className="w-full px-3.5 py-2.5 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">Format Type</label>
                    <select
                      value={docType}
                      onChange={e => setDocType(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                    >
                      <option value="PDF">PDF Document</option>
                      <option value="TXT">Plain Text</option>
                      <option value="MARKDOWN">Markdown</option>
                      <option value="CSV">CSV Data</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">Document Content</label>
                  <textarea
                    rows={4}
                    required
                    value={docContent}
                    onChange={e => setDocContent(e.target.value)}
                    placeholder="Paste policy text, terms, shipping guidelines or FAQs..."
                    className="w-full px-3.5 py-2.5 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:bg-white transition leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <span>{uploading ? 'Processing & Vectorizing Chunks...' : 'Ingest & Index Document'}</span>
                </button>
              </form>

              {/* URL Crawler & Tester */}
              <div className="space-y-6">
                <form onSubmit={handleScrape} className="p-6 rounded-2xl bg-white border border-zinc-200 space-y-4 shadow-2xs">
                  <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                    <Globe className="h-4 w-4 text-zinc-500" />
                    <span>Sync Website Help Center URL</span>
                  </h3>
                  <p className="text-xs text-zinc-600">Synchronize web FAQ pages with automated SSRF protection guards.</p>

                  <div className="flex gap-2">
                    <input
                      type="url"
                      required
                      value={urlToScrape}
                      onChange={e => setUrlToScrape(e.target.value)}
                      placeholder="https://bluetyga.com/pages/faq"
                      className="flex-1 px-3.5 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                    />
                    <button
                      type="submit"
                      disabled={scraping}
                      className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded-xl transition shadow-xs cursor-pointer"
                    >
                      {scraping ? 'Syncing...' : 'Sync URL'}
                    </button>
                  </div>
                </form>

                {/* Semantic Vector Retrieval Tester */}
                <div className="p-6 rounded-2xl bg-white border border-zinc-200 space-y-3.5 shadow-2xs">
                  <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                    <Search className="h-4 w-4 text-zinc-500" />
                    <span>Semantic Vector Retrieval Tester</span>
                  </h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Test query (e.g. what is your return window?)"
                      className="flex-1 px-3.5 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                    />
                    <button
                      onClick={handleSearchTest}
                      className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-semibold rounded-xl border border-zinc-200 transition cursor-pointer"
                    >
                      Test RAG
                    </button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {searchResults.map((r, i) => (
                        <div key={i} className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs space-y-1">
                          <div className="flex justify-between font-bold text-zinc-900">
                            <span>{r.document_name}</span>
                            <span className="text-emerald-700 font-mono text-[11px]">{(r.relevance_score * 100).toFixed(0)}% match</span>
                          </div>
                          <p className="text-zinc-600 text-[11px] leading-relaxed">{r.chunk_text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Documents Table */}
            <div className="p-6 rounded-2xl bg-white border border-zinc-200 space-y-4 shadow-2xs">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Indexed Knowledge Documents ({documents.length})</h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-600 uppercase text-[10px] font-mono">
                      <th className="pb-3">Document Name</th>
                      <th className="pb-3">Format</th>
                      <th className="pb-3">Chunks</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="text-zinc-700 hover:bg-zinc-50/60 transition">
                        <td className="py-3 font-semibold text-zinc-900 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-zinc-500" />
                          <span>{doc.name}</span>
                        </td>
                        <td className="py-3 font-mono text-zinc-600">{doc.type}</td>
                        <td className="py-3 font-mono text-zinc-600">{doc.chunk_count || 1} chunks</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-mono border border-emerald-200 font-semibold">
                            {doc.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="p-1.5 text-zinc-400 hover:text-rose-600 transition cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
    </div>
  );
}
