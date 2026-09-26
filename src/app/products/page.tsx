'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import { 
  Package, RefreshCw, Search, Filter, CheckCircle2, 
  AlertCircle, Eye, ZoomIn, ZoomOut, X, ExternalLink,
  Layers, ShoppingBag, ArrowUpRight, Plus, Sliders
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { fetchWithCache, getClientCachedData } from '@/lib/client-cache';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>(() => getClientCachedData('/api/commerce/products')?.products || []);
  const [loading, setLoading] = useState(() => !getClientCachedData('/api/commerce/products'));
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [previewImage, setPreviewImage] = useState<any | null>(null);
  const [zoomScale, setZoomScale] = useState(1);

  const loadProducts = async (forceFresh = false) => {
    try {
      if (forceFresh) {
        const res = await fetch('/api/commerce/products', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data?.products) {
            setProducts(data.products);
          }
        }
      } else {
        const data = await fetchWithCache<{ products: any[] }>('/api/commerce/products');
        if (data?.products) {
          setProducts(data.products);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/commerce/sync', { method: 'POST' });
      if (res.ok) {
        await loadProducts();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const categories = ['ALL', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const filtered = products.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex h-screen bg-[#f4f5f7] text-zinc-900 font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f4f5f7]">
        <Navbar />

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Header & Synchronization Banner */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white shadow-sm shrink-0">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-base font-bold text-zinc-900 tracking-tight">Store Catalog &amp; Products</h1>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                      LIVE CATALOG SYNC
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Live inventory synchronization from Shopify &amp; WooCommerce. Real-time availability for AI agent queries.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="px-4 py-2 bg-[#18181b] hover:bg-[#27272a] text-white font-semibold text-xs rounded-xl transition flex items-center gap-2 shadow-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Syncing Catalog...' : 'Sync Store Catalog'}</span>
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by product name, category, or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 transition"
                  />
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                      selectedCategory === cat
                        ? 'bg-white text-zinc-900 border border-zinc-300 shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900 bg-zinc-100/80 border border-zinc-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Cards Grid */}
            {loading ? (
              <div className="p-12 text-center text-zinc-500 font-mono text-xs flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Loading store catalog...
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center space-y-3 shadow-xs">
                <Package className="w-8 h-8 text-zinc-400 mx-auto" />
                <h3 className="text-sm font-bold text-zinc-900">No products found</h3>
                <p className="text-xs text-zinc-500">Try adjusting your search query or category filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((p) => {
                  const mainImage = p.images?.[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600';
                  const totalStock = p.variants?.reduce((acc: number, v: any) => acc + (v.inventory_quantity || 0), 0) ?? 48;
                  const isAvailable = totalStock > 0;

                  return (
                    <div 
                      key={p.id} 
                      className="bg-white border border-zinc-200 hover:border-zinc-300 transition rounded-2xl p-4.5 flex flex-col justify-between gap-3 group shadow-xs hover:shadow-sm"
                    >
                      <div className="flex items-start gap-3.5">
                        {/* High-Res Product Thumbnail */}
                        <div 
                          onClick={() => {
                            setPreviewImage({
                              url: mainImage,
                              title: p.title,
                              price: p.price,
                              description: p.description
                            });
                            setZoomScale(1);
                          }}
                          className="w-20 h-20 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer relative group/img"
                          title="Click to view full HD image"
                        >
                          <img 
                            src={mainImage} 
                            alt={p.title} 
                            className="w-full h-full object-cover group-hover/img:scale-105 transition duration-300" 
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center">
                            <Eye className="w-4 h-4 text-white" />
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1">
                            <h3 className="text-xs font-bold text-zinc-900 truncate group-hover:text-indigo-600 transition">{p.title}</h3>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 border border-zinc-200 text-zinc-600 font-medium shrink-0">
                              {p.category || 'Footwear'}
                            </span>
                          </div>

                          <p className="text-[11px] text-zinc-500 line-clamp-2 mt-1">{p.description}</p>
                          
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs font-mono font-bold text-zinc-900">{formatCurrency(p.price)}</span>
                            {p.compare_at_price && (
                              <span className="text-[10px] font-mono text-zinc-400 line-through">
                                {formatCurrency(p.compare_at_price)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Variants & Stock Availability */}
                      <div className="pt-2.5 border-t border-zinc-100 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-500 font-mono">
                            {p.variants?.length || 1} Variant(s)
                          </span>
                          <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                            isAvailable 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {isAvailable ? `${totalStock} in stock` : 'Out of Stock'}
                          </span>
                        </div>

                        {/* Variant Pills */}
                        <div className="flex flex-wrap gap-1">
                          {p.variants?.slice(0, 4).map((v: any) => (
                            <span key={v.id} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-50 border border-zinc-200 text-zinc-700">
                              {v.title}: <strong className="text-emerald-700 font-semibold">{v.inventory_quantity}</strong>
                            </span>
                          ))}
                          {p.variants && p.variants.length > 4 && (
                            <span className="text-[10px] font-mono text-zinc-400 self-center">
                              +{p.variants.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* High-Resolution Interactive Image Lightbox Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => { setPreviewImage(null); setZoomScale(1); }}
        >
          <div 
            className="bg-white border border-zinc-200 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between bg-white">
              <div className="min-w-0 pr-4">
                <h3 className="text-sm font-bold text-zinc-900 truncate">{previewImage.title}</h3>
                {previewImage.price !== undefined && (
                  <p className="text-xs font-mono font-bold text-emerald-600 mt-0.5">{formatCurrency(previewImage.price)}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoomScale(prev => Math.max(0.6, prev - 0.25))}
                  className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono text-zinc-600 font-semibold">{Math.round(zoomScale * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoomScale(prev => Math.min(2.5, prev + 0.25))}
                  className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <a
                  href={previewImage.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                  title="Open original in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => { setPreviewImage(null); setZoomScale(1); }}
                  className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-zinc-50/70 p-6 flex items-center justify-center min-h-[300px]">
              <div 
                className="transition-transform duration-200 origin-center"
                style={{ transform: `scale(${zoomScale})` }}
              >
                <img 
                  src={previewImage.url} 
                  alt={previewImage.title} 
                  className="max-h-[55vh] max-w-full object-contain rounded-xl shadow-lg border border-zinc-200" 
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-zinc-100 bg-white flex items-center justify-between">
              <span className="text-xs text-zinc-500 line-clamp-1">{previewImage.description}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
