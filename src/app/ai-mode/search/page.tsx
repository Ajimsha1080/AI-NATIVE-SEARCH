'use client';

import React, { useState } from 'react';
import { 
  Search, Sparkles, Sliders, CheckCircle2, 
  Layers, ArrowRight, Zap, RefreshCw, ShoppingBag, 
  Clock, DollarSign, Filter, ChevronRight
} from 'lucide-react';
import { AiModeSearchResult } from '@/ai-mode/types';

export default function AiModeSearchPage() {
  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState<AiModeSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (textToSearch?: string) => {
    const q = textToSearch || query;
    if (!q.trim() || isSearching) return;

    setIsSearching(true);
    setError(null);

    try {
      const res = await fetch('/api/ai-mode/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      });

      if (res.ok) {
        const data = await res.json();
        setSearchResult(data.result);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Failed to execute AI search');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setIsSearching(false);
    }
  };

  const sampleQueries = [
    'show me something for a wedding',
    'find products under 1500',
    'what do you have in red?',
    'cheaper options for dinner',
    'show newest products',
    'recommend best sellers'
  ];

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div>
        <h2 className="text-xl font-bold text-zinc-900 tracking-tight">AI Search Engine Workbench</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Test dynamic query understanding, hybrid lexical + vector retrieval, and ranking algorithms on your catalog.
        </p>
      </div>

      {/* Query Bar */}
      <div className="bg-white rounded-3xl border border-zinc-200 p-5 shadow-xs space-y-4">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
          className="flex items-center gap-2 bg-zinc-50 border border-zinc-300 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition"
        >
          <Search className="w-5 h-5 text-zinc-400 ml-2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type any natural-language shopping query (e.g. 'show me something for a wedding under 2000')..."
            className="flex-1 bg-transparent px-2 py-1 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden"
          />
          <button
            type="submit"
            disabled={!query.trim() || isSearching}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-xs"
          >
            {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Execute AI Search</span>
          </button>
        </form>

        {/* Suggested Sample Queries */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-400 font-medium">Quick Test:</span>
          {sampleQueries.map((sq, i) => (
            <button
              key={i}
              onClick={() => { setQuery(sq); handleSearch(sq); }}
              className="px-3 py-1 rounded-full bg-zinc-100 hover:bg-indigo-50 hover:text-indigo-600 text-zinc-600 font-medium text-[11px] transition cursor-pointer"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Results & Diagnostics View */}
      {searchResult && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Product Results */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                <span>Retrieved Products</span>
                <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-xs font-semibold">
                  {searchResult.total_matches} found
                </span>
              </h3>
              <span className="text-xs text-zinc-500">
                Confidence: <strong className="text-emerald-600">{Math.round(searchResult.confidence_score * 100)}%</strong>
              </span>
            </div>

            {searchResult.products.length === 0 ? (
              <div className="bg-white rounded-3xl border border-zinc-200 p-8 text-center text-xs text-zinc-500">
                No matching products found in the catalog.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {searchResult.products.map((product) => (
                  <div 
                    key={product.id}
                    className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-2xs hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="h-36 bg-zinc-100 relative overflow-hidden flex items-center justify-center">
                        {product.images && product.images[0] ? (
                          <img 
                            src={product.images[0]} 
                            alt={product.title} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ShoppingBag className="w-8 h-8 text-zinc-300" />
                        )}
                        <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          product.in_stock ? 'bg-emerald-500 text-white' : 'bg-zinc-600 text-white'
                        }`}>
                          {product.in_stock ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </div>
                      <div className="p-3.5 space-y-1">
                        <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">
                          {product.category}
                        </span>
                        <h4 className="font-semibold text-xs text-zinc-900 line-clamp-1">{product.title}</h4>
                        <p className="text-[11px] text-zinc-500 line-clamp-2">{product.description}</p>
                      </div>
                    </div>
                    <div className="p-3.5 pt-0 border-t border-zinc-100 flex items-center justify-between mt-2">
                      <span className="font-bold text-sm text-zinc-900">
                        {product.currency || '$'}{product.price}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">ID: {product.id.substring(0, 8)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Col: Diagnostics & Query Understanding Inspector */}
          <div className="space-y-4">
            <div className="bg-white rounded-3xl border border-zinc-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-xs text-zinc-900">Query Understanding Plan</h3>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 font-medium">Intent:</span>
                  <span className="font-bold text-indigo-600">{searchResult.plan.intent}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 font-medium">Category Extracted:</span>
                  <span className="font-semibold text-zinc-800">{searchResult.plan.category || 'Any'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 font-medium">Budget Constraints:</span>
                  <span className="font-semibold text-zinc-800">
                    {searchResult.plan.min_price !== undefined || searchResult.plan.max_price !== undefined
                      ? `[${searchResult.plan.min_price ?? 0} - ${searchResult.plan.max_price ?? '∞'}]`
                      : 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 font-medium">Sort Strategy:</span>
                  <span className="font-semibold text-zinc-800">{searchResult.plan.sort || 'Relevance'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 font-medium">Color / Occasion:</span>
                  <span className="font-semibold text-zinc-800">
                    {[searchResult.plan.color, searchResult.plan.occasion].filter(Boolean).join(', ') || 'None'}
                  </span>
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-3">
                <span className="text-[11px] font-semibold text-zinc-500 block mb-1.5">Keywords Extracted:</span>
                <div className="flex flex-wrap gap-1">
                  {searchResult.plan.extracted_keywords.map((kw, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 text-[10px] font-mono">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Retrieval Diagnostics */}
            <div className="bg-zinc-900 text-white rounded-3xl p-5 shadow-xl border border-zinc-800 space-y-3">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                <Layers className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-xs text-zinc-200">Retrieval Diagnostics</h3>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Lexical Hits:</span>
                  <span className="text-emerald-400">{searchResult.retrieval_diagnostics.lexical_candidates_count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Vector Candidates:</span>
                  <span className="text-indigo-400">{searchResult.retrieval_diagnostics.vector_candidates_count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Fallback Applied:</span>
                  <span className={searchResult.retrieval_diagnostics.fallback_applied ? 'text-amber-400' : 'text-zinc-400'}>
                    {searchResult.retrieval_diagnostics.fallback_applied ? 'Yes (Relaxed)' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Retrieval Latency:</span>
                  <span className="text-emerald-400">{searchResult.retrieval_diagnostics.latency_ms} ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
