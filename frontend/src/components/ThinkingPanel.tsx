'use client';

import { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import GearSpinner from './GearSpinner';

interface ThinkingPanelProps {
  thinkingText: string;
  isThinking: boolean;
  // Feedback props
  feedbackValue: string;
  onFeedbackChange: (value: string) => void;
  onRefine: () => void;
  disabled: boolean;
  likedDomains: string[];
  onRemoveLiked: (domain: string) => void;
  showFeedback: boolean;
}

export default function ThinkingPanel({
  thinkingText,
  isThinking,
  feedbackValue,
  onFeedbackChange,
  onRefine,
  disabled,
  likedDomains,
  onRemoveLiked,
  showFeedback,
}: ThinkingPanelProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && feedbackValue.trim()) {
      e.preventDefault();
      onRefine();
    }
  };

  // Don't show if nothing to display
  if (!isThinking && !thinkingText && !showFeedback) {
    return null;
  }

  return (
    <div
      className={`
        fixed z-50 transition-all duration-300 ease-in-out
        bottom-4 right-4 left-4 md:left-auto md:w-96
        ${isCollapsed ? 'translate-y-[calc(100%-44px)]' : ''}
      `}
    >
      {/* Collapse toggle header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full bg-zinc-900 border border-zinc-800 border-b-0 rounded-t-lg px-4 py-2.5 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
      >
        <span className="text-zinc-400 text-sm font-medium flex items-center gap-2">
          {isThinking ? (
            <GearSpinner size="sm" className="text-base" />
          ) : (
            <span className="text-amber-400 font-mono text-base">⚙</span>
          )}
          Make your prompt better
        </span>
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Panel content */}
      <div className="bg-zinc-900 border border-zinc-800 border-t-0 rounded-b-lg p-4 shadow-lg">
        {/* AI Interpretation section */}
        {(isThinking || thinkingText) && (
          <div className={showFeedback ? 'mb-4' : ''}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-zinc-400 text-sm font-medium">AI Interpretation</span>
            </div>
            <p className="text-zinc-300 text-sm leading-relaxed">
              {thinkingText || 'Analyzing your request...'}
              {isThinking && (
                <span className="inline-block w-1.5 h-4 bg-amber-400 ml-0.5 animate-pulse" />
              )}
            </p>
          </div>
        )}

        {/* Feedback/Refine section */}
        {showFeedback && (
          <>
            {/* Liked domains chips */}
            {likedDomains.length > 0 && (
              <div className="mb-3">
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
                  value={feedbackValue}
                  onChange={(e) => onFeedbackChange(e.target.value)}
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
                onClick={onRefine}
                disabled={disabled || !feedbackValue.trim()}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  disabled || !feedbackValue.trim()
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-ids-red hover:bg-ids-red/80 text-white cursor-pointer'
                }`}
              >
                Refine
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
