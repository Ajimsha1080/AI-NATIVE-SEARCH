'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  Search, 
  ShoppingBag, 
  X, 
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { AIModeDeployment, AIModeProduct } from '@/ai-mode/types';

export default function AIModeEmbedWidget() {
  const params = useParams();
  const deploymentId = params?.deploymentId as string;
  const [deployment, setDeployment] = useState<AIModeDeployment | null>(null);
  const [query, setQuery] = useState('women products');
  const [products, setProducts] = useState<AIModeProduct[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (deploymentId) {
      fetch(`/api/ai-mode/widget/${deploymentId}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.deployment) {
            setDeployment(data.deployment);
          }
        })
        .catch(() => {});
      
      executeSearch('women products');
    }
  }, [deploymentId]);

  async function executeSearch(searchQuery: string) {
    if (!searchQuery.trim()) return;
    setQuery(searchQuery);
    setLoading(true);

    try {
      const res = await fetch('/api/ai-mode/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          page: 1,
          page_size: 48
        })
      });

      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setTotalMatches(data.total || data.products?.length || 0);
      }
    } catch (err) {
      console.error('AI Embed Search Error:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!deployment) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-50 text-xs text-zinc-400 font-mono">
        Loading AI Mode Search...
      </div>
    );
  }

  const primaryColor = deployment.theme?.primary_color || '#09090b';
  const suggestedPrompts = deployment.branding?.suggested_prompts || [
    'women products',
    'formal shirts',
    'cotton kurtis',
    'linen trousers'
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-white text-zinc-900 font-sans antialiased overflow-hidden">
      {/* AI Search Bar Box */}
      <div className="p-3.5 bg-white border-b border-zinc-200/80 space-y-2.5 shrink-0">
        <form 
          onSubmit={e => { e.preventDefault(); executeSearch(query); }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder={deployment.branding?.welcome_message || "Search catalog with AI..."}
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full bg-zinc-50 focus:bg-white border border-zinc-200 rounded-xl pl-10 pr-4 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition font-medium"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-4 py-2 rounded-xl text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5 text-white" />}
            <span>Search</span>
          </button>
        </form>

        {/* Quick Suggestion Chips */}
        {suggestedPrompts.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto text-[10px] pb-0.5">
            <span className="text-zinc-400 font-medium shrink-0">Try:</span>
            {suggestedPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => executeSearch(prompt)}
                className="px-2.5 py-1 rounded-lg bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200/80 font-medium shrink-0 transition"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results Header & Grid */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fafafa]">
        <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium">
          <span>Results for <strong className="text-zinc-800">"{query}"</strong></span>
          <span className="font-mono text-zinc-700 font-semibold">{totalMatches} Products</span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-xs text-zinc-400 space-y-2">
            <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
            <span>Searching catalog with AI...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 text-xs space-y-1">
            <ShoppingBag className="w-8 h-8 mx-auto text-zinc-300" />
            <p>No products found matching "{query}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((p, idx) => (
              <EmbedProductCard
                key={p.id || idx}
                product={p}
                query={query}
                deploymentId={deploymentId}
                primaryColor={primaryColor}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface EmbedProductCardProps {
  product: AIModeProduct;
  query: string;
  deploymentId: string;
  primaryColor: string;
}

function EmbedProductCard({ product, query, deploymentId, primaryColor }: EmbedProductCardProps) {
  const images = (product.images && product.images.length > 0) ? product.images : [];
  const [activeImgIdx, setActiveImgIdx] = useState(0);

  const handlePrevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (images.length <= 1) return;
    setActiveImgIdx((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (images.length <= 1) return;
    setActiveImgIdx((prev) => (prev + 1) % images.length);
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 p-2.5 shadow-2xs space-y-2 flex flex-col justify-between hover:border-zinc-300 transition group">
      <div className="space-y-1.5">
        <div className="aspect-[3/4] w-full rounded-xl bg-zinc-100 overflow-hidden relative border border-zinc-100 select-none group/img">
          {images.length > 0 ? (
            <img 
              src={images[activeImgIdx] || images[0]} 
              alt={`${product.title} - View ${activeImgIdx + 1}`} 
              className="w-full h-full object-cover object-top transition duration-300" 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-400">
              <ShoppingBag className="w-6 h-6" />
            </div>
          )}

          <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase bg-white/90 text-zinc-800 backdrop-blur-xs border border-zinc-200/60 z-10 pointer-events-none">
            {product.category || 'Apparel'}
          </span>

          {/* Multi-photo Counter Badge */}
          {images.length > 1 && (
            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-zinc-900/80 text-white backdrop-blur-xs shadow-xs border border-white/20 z-10 pointer-events-none">
              {activeImgIdx + 1}/{images.length}
            </span>
          )}

          {/* Multi-photo Prev/Next Arrows */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevImage}
                title="Previous photo"
                className="absolute left-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/90 hover:bg-white text-zinc-800 shadow flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity z-10 cursor-pointer"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={handleNextImage}
                title="Next photo"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/90 hover:bg-white text-zinc-800 shadow flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity z-10 cursor-pointer"
              >
                <ChevronRight className="w-3 h-3" />
              </button>

              {/* Dot Indicators */}
              <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 z-10 bg-black/30 backdrop-blur-xs px-1 py-0.5 rounded-full">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActiveImgIdx(i);
                    }}
                    className={`rounded-full transition-all cursor-pointer ${
                      activeImgIdx === i 
                        ? 'w-1.5 h-1.5 bg-white' 
                        : 'w-1 h-1 bg-white/50 hover:bg-white/80'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <h5 className="text-[11px] font-bold text-zinc-900 line-clamp-1">{product.title}</h5>
          <p className="text-[10px] text-zinc-500 line-clamp-1">{product.description || 'Catalog item'}</p>
        </div>
      </div>

      <div className="pt-1.5 border-t border-zinc-100 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-zinc-900">₹{product.price.toLocaleString('en-IN')}</span>
          <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
            In Stock
          </span>
        </div>

        {product.source_url ? (
          <a
            href={product.source_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              fetch('/api/ai-mode/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  event: 'buy_now_click',
                  product_id: product.id,
                  source_url: product.source_url,
                  deployment_id: deploymentId,
                  query
                })
              }).catch(() => {});
            }}
            className="w-full text-[10px] font-bold py-1.5 px-2 rounded-lg text-white flex items-center justify-center gap-1 shadow-xs transition cursor-pointer"
            style={{ backgroundColor: primaryColor }}
          >
            <ShoppingBag className="w-2.5 h-2.5" />
            <span>Buy Now</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}
