'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, Layers, Package, BookOpen, Globe, Settings, ArrowRight
} from 'lucide-react';

interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandMenu({ isOpen, onClose }: CommandMenuProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const navItems = [
    { label: 'AI Mode Overview', path: '/ai-mode', icon: Layers, category: 'AI Mode' },
    { label: 'AI Search & Discovery', path: '/ai-mode/search', icon: Search, category: 'AI Mode' },
    { label: 'Product Catalog (247 Items)', path: '/products', icon: Package, category: 'Catalog' },
    { label: 'Store Knowledge & Crawler', path: '/ai-mode/knowledge', icon: BookOpen, category: 'AI Mode' },
    { label: 'Storefront Widget Deployment', path: '/ai-mode/deployment', icon: Globe, category: 'Deploy' },
    { label: 'AI Model & System Settings', path: '/ai-mode/settings', icon: Settings, category: 'Settings' },
  ];

  const allItems = navItems.filter(item => 
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (path: string) => {
    onClose();
    router.push(path);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-xl bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden divide-y divide-zinc-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Bar */}
        <div className="flex items-center px-4 py-3.5 gap-3 bg-white">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search AI Mode, Catalog, Knowledge..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none font-medium"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 bg-zinc-100 rounded border border-zinc-200 shadow-2xs">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-zinc-50">
          {allItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-400 font-medium">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="space-y-1">
              {allItems.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={`${item.path}-${idx}`}
                    onClick={() => handleSelect(item.path)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left text-zinc-700 hover:text-zinc-950 hover:bg-zinc-50 border border-transparent transition group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-zinc-100 text-zinc-600 group-hover:text-zinc-900 group-hover:bg-zinc-200 flex items-center justify-center transition">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-400 uppercase font-mono font-medium">{item.category}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-600 transition" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-zinc-50 flex items-center justify-between text-[11px] text-zinc-500 font-mono border-t border-zinc-100">
          <span>Navigate with ⌘K</span>
          <span>AI Native Search</span>
        </div>
      </div>
    </div>
  );
}
