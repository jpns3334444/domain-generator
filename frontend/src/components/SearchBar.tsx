'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Search } from 'lucide-react';
import GearSpinner from './GearSpinner';
import { trackEvent, AnalyticsEvents } from '@/lib/analytics';

interface SearchBarProps {
  onGenerate: (prompt: string) => void;
  onSearch: (baseName: string) => void;
  isGenerating: boolean;
  compact?: boolean;
  tldSelector?: React.ReactNode;
}

type Mode = 'generate' | 'search';

const TYPING_SPEED = 50;
const DELETING_SPEED = 80; // Slower deletion
const PAUSE_BEFORE_DELETE = 3000; // 3 seconds
const PAUSE_BEFORE_TYPE = 300;

export default function SearchBar({ onGenerate, onSearch, isGenerating, compact = false, tldSelector }: SearchBarProps) {
  const [mode, setMode] = useState<Mode>('generate');
  const [inputValue, setInputValue] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [showTooltip, setShowTooltip] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  const currentPromptRef = useRef('');
  const charIndexRef = useRef(0);
  const isDeletingRef = useRef(false);

  // Check localStorage for tooltip dismissal
  useEffect(() => {
    const dismissed = localStorage.getItem('tooltip-dismissed');
    if (dismissed === 'true') {
      setShowTooltip(false);
    }
  }, []);

  // Dismiss tooltip
  const dismissTooltip = useCallback(() => {
    if (showTooltip) {
      trackEvent(AnalyticsEvents.TOOLTIP_DISMISSED);
    }
    setShowTooltip(false);
    localStorage.setItem('tooltip-dismissed', 'true');
  }, [showTooltip]);

  // Fetch new prompt from API
  const fetchNewPrompt = useCallback(async (): Promise<string> => {
    try {
      const response = await fetch('/api/placeholder-prompts');
      if (response.ok) {
        const data = await response.json();
        return data.prompt || '';
      }
    } catch (error) {
      console.error('Failed to fetch prompt:', error);
    }
    return '';
  }, []);

  // Animation effect
  useEffect(() => {
    // Don't animate if user is typing or not in generate mode
    if (mode !== 'generate' || inputValue) {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = async () => {
      if (isDeletingRef.current) {
        if (charIndexRef.current > 0) {
          charIndexRef.current--;
          setPlaceholder(currentPromptRef.current.slice(0, charIndexRef.current));
          animationRef.current = setTimeout(animate, DELETING_SPEED);
        } else {
          // Done deleting, fetch new prompt
          isDeletingRef.current = false;
          currentPromptRef.current = await fetchNewPrompt();
          charIndexRef.current = 0;
          animationRef.current = setTimeout(animate, PAUSE_BEFORE_TYPE);
        }
      } else {
        if (charIndexRef.current < currentPromptRef.current.length) {
          charIndexRef.current++;
          setPlaceholder(currentPromptRef.current.slice(0, charIndexRef.current));
          animationRef.current = setTimeout(animate, TYPING_SPEED);
        } else {
          // Done typing, pause then start deleting
          isDeletingRef.current = true;
          animationRef.current = setTimeout(animate, PAUSE_BEFORE_DELETE);
        }
      }
    };

    // Fetch first prompt immediately and start typing
    const startAnimation = async () => {
      if (!currentPromptRef.current) {
        currentPromptRef.current = await fetchNewPrompt();
      }
      animate();
    };
    startAnimation();

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [mode, inputValue, fetchNewPrompt]);

  const handleSubmit = () => {
    dismissTooltip();
    if (mode === 'generate') {
      onGenerate(inputValue);
    } else {
      if (inputValue.trim()) {
        onSearch(inputValue.trim());
      }
    }
  };

  const handleInputFocus = () => {
    trackEvent(AnalyticsEvents.INPUT_FOCUSED, { mode });
    dismissTooltip();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  // Maintain focus when mode changes
  const handleModeChange = (newMode: Mode) => {
    trackEvent(AnalyticsEvents.MODE_CHANGED, { newMode });
    setMode(newMode);
    // Keep focus on input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  // Compact mode: IDS-style with tabs below
  if (compact) {
    return (
      <div className="w-full max-w-3xl">
        {/* Search input */}
        <div className="bg-zinc-900 rounded-full px-5 py-3 border border-zinc-800 flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'generate' ? placeholder : 'Enter domain name...'}
            className="flex-1 bg-transparent text-white text-base placeholder-zinc-500 outline-none caret-mauve"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            onClick={handleSubmit}
            disabled={isGenerating || (mode === 'search' && !inputValue.trim())}
            className="text-zinc-400 hover:text-white transition-colors disabled:text-zinc-600"
          >
            {isGenerating ? (
              <GearSpinner size="sm" className="text-xl" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </button>
        </div>
        {/* Tabs and TLD selector row */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex gap-6">
            <button
              onClick={() => handleModeChange('search')}
              className={`flex items-center gap-2 text-sm font-medium transition-colors pb-1 ${
                mode === 'search'
                  ? 'text-white border-b-2 border-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Search className="w-4 h-4" />
              Search
            </button>
            <button
              onClick={() => handleModeChange('generate')}
              className={`flex items-center gap-2 text-sm font-medium transition-colors pb-1 ${
                mode === 'generate'
                  ? 'text-white border-b-2 border-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Generator
            </button>
          </div>
          {tldSelector}
        </div>
      </div>
    );
  }

  // Landing page: input with 2 action buttons on right
  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <div className="flex items-center gap-4 mb-4">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Describe your business or enter a domain name...'}
            className="flex-1 bg-transparent text-white text-lg placeholder-zinc-500 outline-none py-2 caret-mauve"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onGenerate(inputValue)}
            disabled={isGenerating}
            className="shimmer-button bg-mauve hover:bg-mauve-hover disabled:bg-mauve-disabled disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            {isGenerating ? (
              <>
                <GearSpinner size="sm" className="text-lg" />
                Generating
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate
              </>
            )}
          </button>
          <button
            onClick={() => inputValue.trim() && onSearch(inputValue.trim())}
            disabled={isGenerating || !inputValue.trim()}
            className="bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </div>
      </div>
    </div>
  );
}
