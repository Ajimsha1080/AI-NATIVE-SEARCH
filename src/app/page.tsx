'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Bot, ShoppingBag, ShieldCheck, ArrowRight, Zap, 
  Layers, Database, BarChart3, Rocket, MessageSquare, CheckCircle2, 
  ChevronRight, Terminal, Truck, RotateCcw, Cpu, Check, Star, 
  ExternalLink, Code2, Globe2, ShieldAlert, Play, ArrowUpRight,
  Search, Sliders, CheckCircle, Lock, Server, Sparkles, LayoutDashboard
} from 'lucide-react';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'search' | 'tracking' | 'returns'>('search');
  const [cartCount, setCartCount] = useState(1);
  const [addedItem, setAddedItem] = useState<string | null>(null);

  // ROI calculator state
  const [monthlyOrders, setMonthlyOrders] = useState(10000);
  const [supportCostPerTicket, setSupportCostPerTicket] = useState(6.5);

  const estimatedInquiries = Math.round(monthlyOrders * 0.35);
  const estimatedSavings = Math.round(estimatedInquiries * 0.72 * supportCostPerTicket);
  const conversionUpliftRevenue = Math.round(monthlyOrders * 0.08 * 145);

  const handleAddToCart = (productName: string) => {
    setAddedItem(productName);
    setCartCount(prev => prev + 1);
    setTimeout(() => setAddedItem(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-zinc-900 selection:bg-zinc-200 selection:text-zinc-900 flex flex-col font-sans relative antialiased">
      {/* Navigation */}
      <header className="border-b border-zinc-200 bg-white/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-white shadow-xs">
              <Bot className="w-4.5 h-4.5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-zinc-900">
                ShopMate
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-600 font-semibold">
                AaaS
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-600">
            <a href="#simulator" className="hover:text-zinc-900 transition">Runtime Preview</a>
            <a href="#specs" className="hover:text-zinc-900 transition">Architecture</a>
            <a href="#tools" className="hover:text-zinc-900 transition">Commerce APIs</a>
            <a href="#roi" className="hover:text-zinc-900 transition">ROI Model</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link 
              href="/auth/login"
              className="px-3 py-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 border border-zinc-200 rounded-xl transition"
            >
              Sign In
            </Link>
            <Link 
              href="/dashboard"
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition flex items-center gap-1.5 shadow-xs"
            >
              Console <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="pt-10 sm:pt-20 pb-12 sm:pb-16 px-4 sm:px-6 max-w-5xl mx-auto space-y-5 sm:space-y-6 text-center">
          
          {/* Status badge */}
          <div className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1 rounded-full bg-white border border-zinc-200 text-zinc-700 text-[11px] sm:text-xs font-mono shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-medium">Version 2.4 Production Engine</span>
            <span className="text-zinc-300 hidden sm:inline">|</span>
            <span className="text-zinc-500 hidden sm:inline">128-dim Cosine RAG + 15 Typed Tools</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-zinc-900 tracking-tight leading-[1.15] sm:leading-[1.1] max-w-4xl mx-auto">
            The Autonomous Agent Runtime for Modern E-Commerce
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-zinc-600 max-w-2xl mx-auto leading-relaxed">
            Build, test, evaluate, and deploy production commerce concierges. Query live inventory, track shipments, calculate return eligibility, and execute verified store actions with zero hallucinations.
          </p>

          {/* 3 Main UI Launch Cards */}
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto text-left">
            {/* UI 1: Merchant Console */}
            <Link 
              href="/dashboard"
              className="p-5 rounded-2xl bg-white border border-zinc-200 hover:border-zinc-300 hover:shadow-md transition-all group flex flex-col justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                  <LayoutDashboard className="w-4.5 h-4.5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                  MAIN UI 1
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 group-hover:text-zinc-700 transition-colors flex items-center gap-1">
                  Merchant Console <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  B2B dashboard, 12-stage RAG engine, agent playground, and store analytics.
                </p>
              </div>
            </Link>

            {/* UI 2: Customer Storefront Widget */}
            <Link 
              href="/embed/dep_web_01"
              target="_blank"
              className="p-5 rounded-2xl bg-white border border-zinc-200 hover:border-zinc-300 hover:shadow-md transition-all group flex flex-col justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                  <ShoppingBag className="w-4.5 h-4.5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold">
                  MAIN UI 2
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 group-hover:text-zinc-700 transition-colors flex items-center gap-1">
                  Customer Storefront <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400" />
                </h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Live customer store widget with catalog shopping, sizing help, and order tracking.
                </p>
              </div>
            </Link>

            {/* UI 3: SuperAdmin Portal */}
            <Link 
              href="/admin"
              className="p-5 rounded-2xl bg-white border border-zinc-200 hover:border-zinc-300 hover:shadow-md transition-all group flex flex-col justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                  <ShieldAlert className="w-4.5 h-4.5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-semibold">
                  MAIN UI 3
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 group-hover:text-zinc-700 transition-colors flex items-center gap-1">
                  SuperAdmin Portal <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Multi-tenant workspace operations, DB telemetry, audit logs, and security controls.
                </p>
              </div>
            </Link>
          </div>

          {/* Hard Technical Specs Bar */}
          <div className="pt-10 grid grid-cols-2 sm:grid-cols-4 gap-3.5 max-w-4xl mx-auto text-left">
            <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-2xs">
              <span className="text-[11px] font-mono text-zinc-500 uppercase block font-semibold">RAG Retrieval</span>
              <p className="text-xl font-bold text-zinc-900 font-mono mt-1">&lt; 85 ms</p>
              <span className="text-[11px] text-zinc-500">128-dim dense cosine</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-2xs">
              <span className="text-[11px] font-mono text-zinc-500 uppercase block font-semibold">Containment</span>
              <p className="text-xl font-bold text-emerald-600 font-mono mt-1">91.4%</p>
              <span className="text-[11px] text-zinc-500">Autonomous resolution</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-2xs">
              <span className="text-[11px] font-mono text-zinc-500 uppercase block font-semibold">Tool Execution</span>
              <p className="text-xl font-bold text-zinc-900 font-mono mt-1">15 APIs</p>
              <span className="text-[11px] text-zinc-500">Typed &amp; policy gated</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-2xs">
              <span className="text-[11px] font-mono text-zinc-500 uppercase block font-semibold">Database Storage</span>
              <p className="text-xl font-bold text-zinc-900 font-mono mt-1">ACID JSON</p>
              <span className="text-[11px] text-zinc-500">Tenant-isolated index</span>
            </div>
          </div>
        </section>

        {/* Live Interactive Simulator */}
        <section id="simulator" className="py-12 px-6 max-w-6xl mx-auto">
          <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
            
            {/* Window Topbar */}
            <div className="px-5 py-3.5 bg-zinc-50 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5 mr-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-300"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-300"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-300"></div>
                </div>
                <span className="text-xs font-mono text-zinc-600 font-medium">agent_runtime_preview.tsx</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
                  LIVE
                </span>
              </div>

              {/* Scenario Toggles */}
              <div className="flex items-center gap-1 bg-zinc-200/70 p-1 rounded-xl text-xs">
                <button
                  onClick={() => setActiveTab('search')}
                  className={`px-3 py-1 rounded-lg font-medium transition ${
                    activeTab === 'search' ? 'bg-white text-zinc-900 shadow-2xs font-semibold' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Product Search
                </button>
                <button
                  onClick={() => setActiveTab('tracking')}
                  className={`px-3 py-1 rounded-lg font-medium transition ${
                    activeTab === 'tracking' ? 'bg-white text-zinc-900 shadow-2xs font-semibold' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Order Tracking
                </button>
                <button
                  onClick={() => setActiveTab('returns')}
                  className={`px-3 py-1 rounded-lg font-medium transition ${
                    activeTab === 'returns' ? 'bg-white text-zinc-900 shadow-2xs font-semibold' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Return Eligibility
                </button>
              </div>
            </div>

            {/* Split Screen: Left Chat vs Right Runtime Trace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200">
              
              {/* Left (7 cols): Customer Chat & Product Output */}
              <div className="lg:col-span-7 p-6 space-y-4 bg-zinc-50/50">
                {/* User query */}
                <div className="flex items-start gap-3 justify-end">
                  <div className="bg-zinc-900 text-white rounded-2xl rounded-tr-xs px-4 py-2.5 text-xs font-medium max-w-sm shadow-2xs">
                    {activeTab === 'search' && "Find trending stylish outfits and collection"}
                    {activeTab === 'tracking' && "Where is order #10482?"}
                    {activeTab === 'returns' && "What is your exchange window policy?"}
                  </div>
                </div>

                {/* Assistant response */}
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-zinc-900 text-white flex items-center justify-center text-xs font-mono shrink-0 mt-0.5 shadow-2xs">
                    AI
                  </div>
                  <div className="space-y-3 flex-1 max-w-md">
                    <div className="bg-white border border-zinc-200 text-zinc-800 rounded-2xl rounded-tl-xs p-4 text-xs leading-relaxed space-y-2 shadow-2xs">
                      {activeTab === 'search' && (
                        <>
                          <p>Found 1 exact match in catalog inventory matching UPF 50+ Sunscreen Jacket (Size L):</p>
                          <p className="text-emerald-700 font-mono text-[11px] font-semibold">✓ In stock (24 units available in Obsidian Black)</p>
                        </>
                      )}
                      {activeTab === 'tracking' && (
                        <>
                          <p>Status for order <strong>#10482</strong>:</p>
                          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 font-mono text-[11px] space-y-1 text-zinc-700">
                            <div>Carrier: <span className="text-zinc-900 font-semibold">Bluedart Express</span></div>
                            <div>Tracking: <span className="text-zinc-600">BD-8941039821-IN</span></div>
                            <div>Status: <span className="text-emerald-700 font-bold">DELIVERED</span> (Indiranagar, Bengaluru)</div>
                          </div>
                        </>
                      )}
                      {activeTab === 'returns' && (
                        <>
                          <p>Store policy permits hassle-free exchanges and returns within <strong>7 days of delivery</strong> for items in original condition with tags attached.</p>
                          <p className="text-zinc-500">Doorstep reverse pickup via Bluedart is arranged at returns.bluetyga.com.</p>
                        </>
                      )}
                    </div>

                    {/* Interactive Product Card */}
                    {activeTab === 'search' && (
                      <div className="p-3.5 bg-white border border-zinc-200 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-200 overflow-hidden shrink-0">
                            <img 
                              src="https://images.unsplash.com/photo-1551028719-00167b16eac5?w=160&auto=format&fit=crop&q=80" 
                              alt="UPF 50+ Sunscreen Performance Jacket" 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-zinc-900">UPF 50+ Sunscreen Jacket (L)</p>
                            <p className="text-xs font-mono text-zinc-500 font-medium">₹2,499</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddToCart('UPF 50+ Sunscreen Jacket')}
                          className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          {addedItem === 'UPF 50+ Sunscreen Jacket' ? 'Added' : 'Add to Cart'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right (5 cols): Structured Execution Trace */}
              <div className="lg:col-span-5 p-5 bg-white font-mono text-[11px] space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2.5 text-zinc-500">
                  <span className="flex items-center gap-1.5 text-zinc-900 font-semibold font-sans">
                    <Terminal className="w-3.5 h-3.5 text-zinc-600" /> Execution Trace
                  </span>
                  <span className="text-emerald-600 font-semibold">238ms • 0 hallucinations</span>
                </div>

                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
                    <span className="text-zinc-500 block text-[10px] uppercase font-bold">1. Intent Classification</span>
                    <span className="text-zinc-900 font-semibold">
                      {activeTab === 'search' && 'PRODUCT_SEARCH (conf: 0.992)'}
                      {activeTab === 'tracking' && 'ORDER_TRACKING (conf: 0.989)'}
                      {activeTab === 'returns' && 'RETURN_POLICY (conf: 0.995)'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
                    <span className="text-zinc-500 block text-[10px] uppercase font-bold">2. 128-dim Vector Search</span>
                    <span className="text-zinc-700">cosine_match(query, catalog_index) = 0.884</span>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
                    <span className="text-zinc-500 block text-[10px] uppercase font-bold">3. Gated Tool Invocation</span>
                    <span className="text-emerald-700 font-semibold">
                      {activeTab === 'search' && 'product_search({ max_price: 160, size: "9" })'}
                      {activeTab === 'tracking' && 'order_lookup({ order_number: "#10482" })'}
                      {activeTab === 'returns' && 'check_return_eligibility({ window_days: 30 })'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
                    <span className="text-zinc-500 block text-[10px] uppercase font-bold">4. Grounding Gate</span>
                    <span className="text-zinc-600">Verified against ACID tenant schema. Grounded: PASSED</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Architecture Specs */}
        <section id="specs" className="py-16 px-6 max-w-7xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider font-semibold">Architecture</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
              Enterprise Agent Infrastructure
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 rounded-2xl bg-white border border-zinc-200 space-y-3 shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-900">
                <Database className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-sm font-bold text-zinc-900">128-dim Vector Retrieval</h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Dense normalized n-gram embeddings indexing store documents, warranties, and FAQs with sub-100ms cosine similarity.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-zinc-200 space-y-3 shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-900">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-sm font-bold text-zinc-900">15 Typed Commerce Tools</h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Permission-gated actions for catalog lookups, live inventory verification, cart manipulation, and human operator handoff.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-zinc-200 space-y-3 shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-900">
                <Globe2 className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-sm font-bold text-zinc-900">Multi-Channel Deployment</h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Drop-in &lt;script&gt; widget for Shopify/WooCommerce stores, sandboxed iframe endpoints, and authenticated REST APIs.
              </p>
            </div>
          </div>
        </section>

        {/* ROI Calculator */}
        <section id="roi" className="py-16 px-6 bg-white border-t border-zinc-200">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold text-zinc-900">Deflection &amp; Revenue Model</h2>
              <p className="text-xs text-zinc-600">Calculate estimated support ticket deflection and assisted conversion revenue.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#f4f5f7] border border-zinc-200 p-6 rounded-2xl">
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span className="text-zinc-600">Monthly Store Orders</span>
                    <span className="text-zinc-900 font-mono font-bold">{monthlyOrders.toLocaleString('en-US')}</span>
                  </div>
                  <input 
                    type="range" 
                    min="1000" 
                    max="100000" 
                    step="1000"
                    value={monthlyOrders} 
                    onChange={(e) => setMonthlyOrders(Number(e.target.value))}
                    className="w-full accent-zinc-900 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span className="text-zinc-600">Cost per Human Support Ticket</span>
                    <span className="text-zinc-900 font-mono font-bold">${supportCostPerTicket.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="3.0" 
                    max="15.0" 
                    step="0.5"
                    value={supportCostPerTicket} 
                    onChange={(e) => setSupportCostPerTicket(Number(e.target.value))}
                    className="w-full accent-zinc-900 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-white border border-zinc-200 text-center space-y-1 shadow-2xs">
                  <span className="text-[11px] font-mono text-zinc-500 uppercase block font-semibold">Monthly Savings</span>
                  <p className="text-2xl font-bold text-emerald-600 font-mono">${estimatedSavings.toLocaleString('en-US')}</p>
                  <span className="text-[10px] text-zinc-500">72% AI containment</span>
                </div>

                <div className="p-4 rounded-xl bg-white border border-zinc-200 text-center space-y-1 shadow-2xs">
                  <span className="text-[11px] font-mono text-zinc-500 uppercase block font-semibold">Assisted GMV</span>
                  <p className="text-2xl font-bold text-zinc-900 font-mono">${conversionUpliftRevenue.toLocaleString('en-US')}</p>
                  <span className="text-[10px] text-zinc-500">+8% conversion lift</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-6 px-6 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>All systems normal • SLA 99.98%</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="hover:text-zinc-900 transition font-medium">Console</Link>
            <Link href="/agents" className="hover:text-zinc-900 transition font-medium">Agents</Link>
            <Link href="/admin" className="hover:text-zinc-900 transition font-medium">SuperAdmin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
