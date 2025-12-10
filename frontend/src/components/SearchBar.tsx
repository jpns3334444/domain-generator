'use client';

import { Sparkles } from 'lucide-react';

interface SearchBarProps {
  onGenerate: () => void;
  isGenerating: boolean;
  compact?: boolean;
}

export default function SearchBar({ onGenerate, isGenerating, compact = false }: SearchBarProps) {
  return (
    <div className={`w-full max-w-2xl mx-auto ${compact ? '' : 'px-4'}`}>
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="Random"
            className="flex-1 bg-transparent text-white text-lg placeholder-zinc-500 outline-none py-2"
            disabled
          />
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
