'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Sparkles, 
  Tag, 
  ShoppingBag, 
  Zap, 
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { AIModeSearchResult, AIModeProduct } from '@/ai-mode/types';

export default function AIModeSearchPlayground() {
  const [query, setQuery] = useState('women products');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [result, setResult] = useState<AIModeSearchResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(48);

  const quickFilters = [
    { label: '👩 Women Products', query: 'women products' },
    { label: '🥻 Sarees & Drapes', query: 'sarees for women' },
    { label: '🎀 Bows & Accessories', query: 'satin hair bows and accessories' },
    { label: '🎁 Couple & Saree Combos', query: 'couple combos' },
    { label: '👨 Men Casuals', query: 'casual shirts for men' },
    { label: '👕 Cotton Shirts Under ₹2000', query: 'show me formal cotton shirts under 2000' },
    { label: '👖 Pants & Joggers', query: 'linen pants and joggers' },
  ];

  useEffect(() => {
    handleSearch('women products', 1, pageSize);
  }, []);

  async function handleSearch(searchQuery: string, page = 1, size = pageSize) {
    if (!searchQuery.trim()) return;
    setLoadingSearch(true);
    setCurrentPage(page);
    try {
      const res = await fetch('/api/ai-mode/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: searchQuery,
          page,
          page_size: size
        })
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSearch(false);
    }
  }

  function handlePageChange(newPage: number) {
    if (!result || newPage < 1) return;
    const maxPage = Math.ceil(result.total_matches / pageSize);
    if (newPage > maxPage) return;
    handleSearch(query, newPage, pageSize);
  }

  function handlePageSizeChange(newSize: number) {
    setPageSize(newSize);
    handleSearch(query, 1, newSize);
  }

  const totalPages = result ? Math.ceil(result.total_matches / pageSize) : 1;
  const startCount = result && result.total_matches > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endCount = result ? Math.min(currentPage * pageSize, result.total_matches) : 0;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 tracking-tight">AI Search Playground</h2>
            <p className="text-xs text-zinc-500">Test natural-language query planning, constraint extraction, and hybrid ranking algorithms.</p>
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-2xs space-y-4">
        <form onSubmit={e => { e.preventDefault(); handleSearch(query, 1, pageSize); }} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Ask any shopping query (e.g. 'women products', 'cotton shirts under 1500', 'sarees for wedding')..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition font-medium"
            />
          </div>
          <button
            type="submit"
            disabled={loadingSearch || !query.trim()}
            className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
          >
            {loadingSearch ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-400" />}
            <span>Execute AI Search</span>
          </button>
        </form>

        {/* Quick Filter Buttons */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">Quick Category &amp; Demographic Searches:</span>
          <div className="flex items-center gap-2 overflow-x-auto text-[11px] pb-1">
            {quickFilters.map(qf => (
              <button
                key={qf.query}
                type="button"
                onClick={() => { setQuery(qf.query); handleSearch(qf.query, 1, pageSize); }}
                className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition flex items-center gap-1.5 border ${
                  query === qf.query 
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs' 
                    : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200/80'
                }`}
              >
                <span>{qf.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Section */}
      {result && (
        <div className="space-y-6">
          {/* Diagnostic Query Plan Card */}
          <div className="bg-zinc-900 text-white rounded-2xl p-5 shadow-lg border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold font-mono text-zinc-200">Dynamic AI Search Plan</span>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">Latency: <strong className="text-emerald-400">{result.latency_ms}ms</strong></span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div className="bg-zinc-800/60 p-3 rounded-xl border border-zinc-700/50">
                <span className="text-zinc-400 block text-[10px] uppercase font-semibold">Intent</span>
                <span className="text-emerald-400 font-bold">{result.search_plan.intent}</span>
              </div>
              <div className="bg-zinc-800/60 p-3 rounded-xl border border-zinc-700/50">
                <span className="text-zinc-400 block text-[10px] uppercase font-semibold">Target Demographic</span>
                <span className="text-indigo-300 font-bold capitalize">
                  {result.search_plan.extracted_filters.gender || 'All / General'}
                </span>
              </div>
              <div className="bg-zinc-800/60 p-3 rounded-xl border border-zinc-700/50">
                <span className="text-zinc-400 block text-[10px] uppercase font-semibold">Category &amp; Price</span>
                <span className="text-amber-300 font-bold">
                  {result.search_plan.extracted_filters.category || 'Any Category'}
                  {result.search_plan.extracted_filters.max_price ? ` (≤ ₹${result.search_plan.extracted_filters.max_price})` : ''}
                </span>
              </div>
              <div className="bg-zinc-800/60 p-3 rounded-xl border border-zinc-700/50">
                <span className="text-zinc-400 block text-[10px] uppercase font-semibold">Total Matches</span>
                <span className="text-emerald-300 font-bold">{result.total_matches} Products Found</span>
              </div>
            </div>
          </div>

          {/* Results Bar & Page Size Selector */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white px-5 py-3.5 rounded-2xl border border-zinc-200 shadow-2xs">
            <div className="text-xs text-zinc-600 font-medium">
              Showing <span className="font-bold text-zinc-900">{startCount}–{endCount}</span> of <span className="font-bold text-zinc-900">{result.total_matches}</span> matching products
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span>Show:</span>
                <select
                  value={pageSize}
                  onChange={e => handlePageSizeChange(Number(e.target.value))}
                  className="bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1 text-xs text-zinc-900 font-semibold focus:outline-none focus:border-zinc-900"
                >
                  <option value={12}>12 products</option>
                  <option value={24}>24 products</option>
                  <option value={48}>48 products</option>
                  <option value={100}>100 products</option>
                </select>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-zinc-700" />
                  </button>
                  <span className="text-xs font-mono font-semibold text-zinc-700 px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-700" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Product Cards Grid */}
          {result.products.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center space-y-3">
              <ShoppingBag className="w-10 h-10 text-zinc-300 mx-auto" />
              <h3 className="text-sm font-bold text-zinc-800">No matching products found</h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">Try a broader search term or choose from the quick search suggestions above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {result.products.map((product, idx) => (
                <div key={product.id || idx} className="bg-white rounded-2xl border border-zinc-200/80 p-3.5 shadow-2xs space-y-3 flex flex-col justify-between hover:border-zinc-300 transition group">
                  <div className="space-y-2.5">
                    <div className="h-48 rounded-xl bg-zinc-100 overflow-hidden relative border border-zinc-100">
                      {product.images?.[0] ? (
                        <img 
                          src={product.images[0]} 
                          alt={product.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-400">
                          <ShoppingBag className="w-8 h-8" />
                        </div>
                      )}

                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase bg-white/90 text-zinc-800 backdrop-blur-xs shadow-xs border border-zinc-200/60">
                        {product.category || 'Apparel'}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-zinc-900 line-clamp-1 group-hover:text-indigo-600 transition" title={product.title}>
                        {product.title}
                      </h4>
                      <p className="text-[11px] text-zinc-500 line-clamp-2 mt-1 leading-relaxed">
                        {product.description || 'Exclusive item from official store collection.'}
                      </p>
                    </div>

                    {product.subcategories && product.subcategories.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {product.subcategories.slice(0, 3).map((tag, tIdx) => (
                          <span key={tIdx} className="text-[9px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-mono">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-zinc-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-zinc-900">
                        ₹{product.price.toLocaleString('en-IN')}
                      </span>
                      {product.sale_price && product.sale_price > product.price && (
                        <span className="text-[10px] text-zinc-400 line-through ml-1.5 font-mono">
                          ₹{product.sale_price.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      In Stock
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bottom Pagination Bar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-5 py-3 rounded-2xl border border-zinc-200">
              <span className="text-xs text-zinc-500 font-mono">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pNum = i + 1;
                  return (
                    <button
                      key={pNum}
                      onClick={() => handlePageChange(pNum)}
                      className={`w-8 h-8 rounded-xl text-xs font-mono font-bold transition ${
                        currentPage === pNum
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
