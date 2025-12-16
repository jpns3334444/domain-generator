'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Search } from 'lucide-react';

interface SearchBarProps {
  onGenerate: (prompt: string) => void;
  onSearch: (baseName: string) => void;
  isGenerating: boolean;
  compact?: boolean;
}

type Mode = 'generate' | 'search';

const TYPING_SPEED = 50;
const DELETING_SPEED = 80; // Slower deletion
const PAUSE_BEFORE_DELETE = 3000; // 3 seconds
const PAUSE_BEFORE_TYPE = 300;

export default function SearchBar({ onGenerate, onSearch, isGenerating, compact = false }: SearchBarProps) {
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
    setShowTooltip(false);
    localStorage.setItem('tooltip-dismissed', 'true');
  }, []);

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
    dismissTooltip();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  // Maintain focus when mode changes
  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    // Keep focus on input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  return (
    <div className={`w-full ${compact ? 'max-w-4xl' : 'max-w-2xl mx-auto px-4'}`}>
      <div className={`bg-zinc-900 rounded-xl ${compact ? 'px-4 py-3' : 'p-4'} border border-zinc-800`}>
        {/* Single line: Input + Mode buttons + Action button */}
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'generate' ? placeholder : 'Enter domain name...'}
            className="flex-1 bg-transparent text-white text-lg placeholder-zinc-500 outline-none caret-mauve min-w-0"
            autoComplete="off"
            spellCheck={false}
          />

          {/* Mode buttons */}
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => handleModeChange('generate')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode === 'generate'
                  ? 'bg-mauve text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Generate
            </button>
            <button
              onClick={() => handleModeChange('search')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode === 'search'
                  ? 'bg-mauve text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
              }`}
            >
              <Search className="w-4 h-4" />
              Search
            </button>
          </div>

          {/* Action button */}
          <div className="relative shrink-0">
            {showTooltip && mode === 'generate' && !compact && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 w-56 animate-fade-in z-10">
                <div className="bg-zinc-800 text-zinc-300 text-sm p-3 rounded-lg shadow-lg border border-zinc-700">
                  <p>Click with no prompt to generate random domain names</p>
                  <div className="absolute top-1/2 -translate-y-1/2 -left-2 w-0 h-0 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-zinc-800" />
                </div>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={isGenerating || (mode === 'search' && !inputValue.trim())}
              className="shimmer-button bg-mauve hover:bg-mauve-hover disabled:bg-mauve-disabled disabled:cursor-not-allowed text-white px-5 py-1.5 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
