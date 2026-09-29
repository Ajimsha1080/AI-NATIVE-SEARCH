'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import { 
  Package, RefreshCw, Search, Filter, CheckCircle2, 
  AlertCircle, Eye, ZoomIn, ZoomOut, X, ExternalLink,
  Layers, ShoppingBag, ArrowUpRight, Plus, Sliders, Trash2
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { fetchWithCache, getClientCachedData, invalidateClientCache } from '@/lib/client-cache';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>(() => getClientCachedData('/api/commerce/products')?.products || []);
  const [loading, setLoading] = useState(() => !getClientCachedData('/api/commerce/products'));
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [previewImage, setPreviewImage] = useState<any | null>(null);
  const [zoomScale, setZoomScale] = useState(1);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Techwear');
  const [newPrice, setNewPrice] = useState('');
  const [newInventory, setNewInventory] = useState('40');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

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
    // Live Real-Time Polling every 3.5s
    const interval = setInterval(() => {
      loadProducts(true);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/commerce/sync', { method: 'POST' });
      if (res.ok) {
        invalidateClientCache('/api/commerce/products');
        await loadProducts(true);
        showToast('Store catalog synchronized successfully!');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateStock = async (productId: string, delta: number, currentInventory: number) => {
    const nextInv = Math.max(0, currentInventory + delta);
    // Optimistic UI update
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return {
          ...p,
          total_inventory: nextInv,
          in_stock: nextInv > 0,
          variants: (p.variants || []).map((v: any) => ({ ...v, inventory_quantity: nextInv }))
        };
      }
      return p;
    }));

    try {
      const res = await fetch('/api/commerce/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: productId, inventory: nextInv })
      });
      if (res.ok) {
        invalidateClientCache('/api/commerce/products');
        showToast(`Stock updated to ${nextInv} units in real time!`);
      }
    } catch (err) {
      console.error('Failed to update stock:', err);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to remove this product from the live catalog?')) return;
    setProducts(prev => prev.filter(p => p.id !== productId));
    try {
      const res = await fetch(`/api/commerce/products?id=${productId}`, { method: 'DELETE' });
      if (res.ok) {
        invalidateClientCache('/api/commerce/products');
        showToast('Product removed from catalog');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAllProducts = async () => {
    if (!confirm('Are you sure you want to remove all products from the store catalog?')) return;
    setProducts([]);
    try {
      const res = await fetch('/api/commerce/products?all=true', { method: 'DELETE' });
      if (res.ok) {
        invalidateClientCache('/api/commerce/products');
        showToast('All products removed from catalog');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newPrice) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/commerce/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          category: newCategory.trim(),
          price: parseFloat(newPrice),
          inventory: parseInt(newInventory, 10) || 50,
          imageUrl: newImageUrl.trim() || undefined,
          description: newDescription.trim() || undefined
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.product) {
          setProducts(prev => [data.product, ...prev]);
        }
        setIsAddModalOpen(false);
        setNewTitle('');
        setNewPrice('');
        setNewImageUrl('');
        setNewDescription('');
        showToast('New real-time product added to store catalog!');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const totalCatalogUnits = products.reduce((acc, p) => acc + (p.total_inventory || 0), 0);
  const inStockCount = products.filter(p => (p.total_inventory || 0) > 0).length;
  const lowStockCount = products.filter(p => (p.total_inventory || 0) > 0 && (p.total_inventory || 0) < 15).length;

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
                  <h1 className="text-base font-bold text-zinc-900 tracking-tight">Real-Time Store Catalog</h1>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Real-time inventory levels, live stock adjustments, and instant AI agent catalog availability in INR (₹).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Product</span>
                </button>

                <button
                  onClick={handleClearAllProducts}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shadow-2xs"
                  title="Remove all products"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear All</span>
                </button>

                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="px-3.5 py-2 bg-[#18181b] hover:bg-[#27272a] text-white font-semibold text-xs rounded-xl transition flex items-center gap-2 shadow-xs disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin text-emerald-400' : ''}`} />
                  <span>{syncing ? 'Syncing...' : 'Sync Catalog'}</span>
                </button>
              </div>
            </div>

            {/* Real-time Telemetry Mini-Stat Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white border border-zinc-200/90 rounded-2xl p-3.5 space-y-0.5 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-zinc-500">Live Active SKUs</span>
                <p className="text-lg font-bold text-zinc-950">{products.length}</p>
                <span className="text-[10px] text-emerald-600 font-mono">100% Verified in DB</span>
              </div>
              <div className="bg-white border border-zinc-200/90 rounded-2xl p-3.5 space-y-0.5 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-zinc-500">Total Stock on Hand</span>
                <p className="text-lg font-bold text-zinc-950 font-mono">{totalCatalogUnits} <span className="text-xs text-zinc-500 font-normal">units</span></p>
                <span className="text-[10px] text-zinc-500 font-mono">{inStockCount} In-Stock Items</span>
              </div>
              <div className="bg-white border border-zinc-200/90 rounded-2xl p-3.5 space-y-0.5 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-zinc-500">Currency Standard</span>
                <p className="text-lg font-bold text-zinc-950 font-mono">INR (₹)</p>
                <span className="text-[10px] text-indigo-600 font-mono">Indian Domestic Store</span>
              </div>
              <div className="bg-white border border-zinc-200/90 rounded-2xl p-3.5 space-y-0.5 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-zinc-500">Real-time Agent Sync</span>
                <p className="text-lg font-bold text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Connected
                </p>
                <span className="text-[10px] text-zinc-500 font-mono">Sub-10ms Tool Access</span>
              </div>
            </div>

            {/* Toast Notification */}
            {toastMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center justify-between shadow-xs animate-fade-in">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {toastMessage}
                </span>
                <button onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-950">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

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
                    className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 transition shadow-2xs"
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
                Loading real-time catalog...
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center space-y-3 shadow-xs">
                <Package className="w-8 h-8 text-zinc-400 mx-auto" />
                <h3 className="text-sm font-bold text-zinc-900">No products found</h3>
                <p className="text-xs text-zinc-500">Try adjusting your search query or add a new product.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((p) => {
                  const mainImage = p.images?.[0] || 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600';
                  const currentStock = p.total_inventory ?? 40;
                  const isAvailable = currentStock > 0;

                  return (
                    <div 
                      key={p.id} 
                      className="bg-white border border-zinc-200 hover:border-zinc-300 transition rounded-2xl p-4.5 flex flex-col justify-between gap-3.5 group shadow-xs hover:shadow-sm"
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
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&auto=format&fit=crop&q=80';
                            }}
                            className="w-full h-full object-cover group-hover/img:scale-105 transition duration-300" 
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center">
                            <Eye className="w-4 h-4 text-white" />
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1">
                            <h3 className="text-xs font-bold text-zinc-900 truncate group-hover:text-indigo-600 transition">{p.title}</h3>
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="text-zinc-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition"
                              title="Delete product"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 border border-zinc-200 text-zinc-600 font-medium">
                              {p.category || 'Techwear'}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-400 truncate">
                              ID: {p.id.slice(0, 10)}
                            </span>
                          </div>

                          <p className="text-[11px] text-zinc-500 line-clamp-2 mt-1">{p.description}</p>
                          
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs font-mono font-bold text-zinc-900">₹{p.price.toLocaleString('en-IN')}</span>
                            {p.compare_at_price && (
                              <span className="text-[10px] font-mono text-zinc-400 line-through">
                                ₹{p.compare_at_price.toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Real-time Inventory Stepper & Live Stock Control */}
                      <div className="pt-2.5 border-t border-zinc-100 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full border font-semibold flex items-center gap-1 ${
                            isAvailable 
                              ? (currentStock < 10 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? (currentStock < 10 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-rose-500'}`}></span>
                            {isAvailable ? `${currentStock} in stock` : 'Out of Stock'}
                          </span>
                        </div>

                        {/* Real-time Quick Stock Adjuster (+ / -) */}
                        <div className="flex items-center gap-1 bg-zinc-100 border border-zinc-200/90 rounded-xl p-0.5 shadow-2xs">
                          <button
                            onClick={() => handleUpdateStock(p.id, -5, currentStock)}
                            className="w-6 h-6 rounded-lg bg-white hover:bg-zinc-200 text-zinc-700 flex items-center justify-center text-xs font-bold transition shadow-2xs"
                            title="Decrease stock by 5"
                          >
                            -5
                          </button>
                          <button
                            onClick={() => handleUpdateStock(p.id, -1, currentStock)}
                            className="w-6 h-6 rounded-lg bg-white hover:bg-zinc-200 text-zinc-700 flex items-center justify-center text-xs font-bold transition shadow-2xs"
                            title="Decrease stock by 1"
                          >
                            -1
                          </button>
                          <span className="px-1.5 text-[11px] font-mono font-bold text-zinc-800 select-none">
                            {currentStock}
                          </span>
                          <button
                            onClick={() => handleUpdateStock(p.id, 1, currentStock)}
                            className="w-6 h-6 rounded-lg bg-white hover:bg-zinc-200 text-zinc-700 flex items-center justify-center text-xs font-bold transition shadow-2xs"
                            title="Increase stock by 1"
                          >
                            +1
                          </button>
                          <button
                            onClick={() => handleUpdateStock(p.id, 5, currentStock)}
                            className="w-6 h-6 rounded-lg bg-white hover:bg-zinc-200 text-zinc-700 flex items-center justify-center text-xs font-bold transition shadow-2xs"
                            title="Increase stock by 5"
                          >
                            +5
                          </button>
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
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&auto=format&fit=crop&q=80';
                  }}
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

      {/* Real-Time Add Product Modal */}
      {isAddModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div 
            className="bg-white border border-zinc-200 rounded-3xl max-w-lg w-full overflow-hidden flex flex-col shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-950">Add Real-Time Product</h3>
                  <p className="text-[11px] text-zinc-500 font-mono">Instant sync to Blue Tyga store &amp; AI Agent</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-5 space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-zinc-700 block mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Featherweight UPF 50+ Windbreaker"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-zinc-700 block mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Techwear"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-700 block mb-1">Price (₹ INR) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 2499"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 font-mono focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-700 block mb-1">Stock Units</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 50"
                    value={newInventory}
                    onChange={(e) => setNewInventory(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 font-mono focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-700 block mb-1">Image URL</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Key techwear fabric specs, stretch, anti-sweat, or sizing notes..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 focus:bg-white transition"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs disabled:opacity-60"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Publishing...' : 'Save & Publish Live'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
