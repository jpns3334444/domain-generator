'use client';

import { useState } from 'react';
import { Search, Grid, Sparkles, Star } from 'lucide-react';

interface SearchBarProps {
  onGenerate: () => void;
  isGenerating: boolean;
  compact?: boolean;
}

type TabType = 'search' | 'extensions' | 'generator' | 'premium';

export default function SearchBar({ onGenerate, isGenerating, compact = false }: SearchBarProps) {
  const [activeTab, setActiveTab] = useState<TabType>('generator');

  const tabs = [
    { id: 'search' as TabType, label: 'Search', icon: Search },
    { id: 'extensions' as TabType, label: 'Extensions', icon: Grid },
    { id: 'generator' as TabType, label: 'Generator', icon: Sparkles },
    { id: 'premium' as TabType, label: 'Premium', icon: Star },
  ];

  return (
    <div className={`w-full max-w-2xl mx-auto ${compact ? '' : 'px-4'}`}>
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        {/* Search Input */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Start typing here..."
            className="w-full bg-transparent text-white text-lg placeholder-zinc-500 outline-none py-2"
            disabled={activeTab === 'generator'}
          />
          {activeTab === 'generator' && (
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
