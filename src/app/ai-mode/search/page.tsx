'use client';

import React, { useState } from 'react';
import { 
  Search, 
  Sparkles, 
  Tag, 
  SlidersHorizontal, 
  ShoppingBag, 
  ArrowRight,
  Zap,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { AIModeSearchResult, AIModeProduct } from '@/ai-mode/types';

export default function AIModeSearchPlayground() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIModeSearchResult | null>(null);

  const sampleQueries = [
    'show me formal cotton shirts under 2000',
    'what do you recommend for a summer party?',
    'find trending red shirts',
    'show cheaper options in stock',
    'compare the most popular items'
  ];

  async function handleSearch(searchQuery: string) {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ai-mode/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-zinc-900 tracking-tight">AI Search Playground</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Test natural-language query planning, constraint extraction, and hybrid ranking algorithms.</p>
      </div>

      {/* Search Input Bar */}
      <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs space-y-3">
        <form onSubmit={e => { e.preventDefault(); handleSearch(query); }} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Ask any natural-language shopping question (e.g. 'cotton shirts under 1500 for wedding')..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-400" />}
            <span>Execute AI Search</span>
          </button>
        </form>

        {/* Query Suggestions */}
        <div className="flex items-center gap-2 overflow-x-auto text-[11px] pt-1">
          <span className="text-zinc-400 font-medium shrink-0">Try:</span>
          {sampleQueries.map(sq => (
            <button
              key={sq}
              type="button"
              onClick={() => { setQuery(sq); handleSearch(sq); }}
              className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium shrink-0 transition"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* Results Section */}
      {result && (
        <div className="space-y-6">
          {/* Diagnostic Query Plan Card */}
          <div className="bg-zinc-900 text-white rounded-2xl p-5 shadow-lg border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold font-mono">Dynamic Search Plan</span>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">Latency: {result.latency_ms}ms</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Detected Intent</span>
                <span className="text-emerald-400 font-bold">{result.search_plan.intent}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Extracted Filters</span>
                <span className="text-zinc-200">
                  {Object.keys(result.applied_filters).length > 0 ? JSON.stringify(result.applied_filters) : 'None (Broad Search)'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Total Candidates</span>
                <span className="text-indigo-300 font-bold">{result.total_matches} Products</span>
              </div>
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {result.products.map(product => (
              <div key={product.id} className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-2xs space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="h-44 rounded-xl bg-zinc-100 overflow-hidden relative">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-400">
                        <ShoppingBag className="w-8 h-8" />
                      </div>
                    )}
                    {product.score !== undefined && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-900/80 text-emerald-400 backdrop-blur-xs">
                        {(product.score * 100).toFixed(0)}% Match
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase">{product.category}</span>
                    <h4 className="text-xs font-bold text-zinc-900 line-clamp-1">{product.title}</h4>
                    <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">{product.description}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                  <span className="text-xs font-black text-zinc-900">
                    ₹{product.price.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    In Stock
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
