'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface FeedbackInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  disabled: boolean;
  likedDomains: string[];
  onRemoveLiked: (domain: string) => void;
}

export default function FeedbackInput({
  value,
  onChange,
  onSubmit,
  onClear,
  disabled,
  likedDomains,
  onRemoveLiked,
}: FeedbackInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="px-12 mb-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        {/* Liked domains chips */}
        {likedDomains.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-zinc-400 text-sm font-medium">Liked domains:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {likedDomains.map((domain) => (
                <span
                  key={domain}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-ids-red/20 text-ids-red text-sm rounded group"
                >
                  <span className="text-ids-red">&#9829;</span>
                  {domain}
                  <button
                    onClick={() => onRemoveLiked(domain)}
                    className="ml-0.5 text-ids-red/60 hover:text-ids-red transition-colors"
                    title="Remove from liked"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Feedback input */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder="Refine: e.g., 'shorter names' or 'more like nexora'"
              className={`w-full px-4 py-2.5 bg-zinc-800 border rounded-lg text-white placeholder-zinc-500 text-sm transition-colors outline-none ${
                isFocused ? 'border-ids-red' : 'border-zinc-700'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
          <button
            onClick={onSubmit}
            disabled={disabled || !value.trim()}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              disabled || !value.trim()
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-ids-red hover:bg-ids-red/80 text-white cursor-pointer'
            }`}
          >
            Refine
          </button>
          {(value.trim() || likedDomains.length > 0) && (
            <button
              onClick={onClear}
              disabled={disabled}
              className="px-3 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-white transition-colors"
              title="Clear feedback and liked domains"
            >
              Clear
            </button>
          )}
        </div>

        {/* Helper text */}
        <p className="mt-2 text-xs text-zinc-500">
          Describe what you want different, or click the heart on domains you like for context.
        </p>
      </div>
    </div>
  );
}
