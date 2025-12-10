'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Search } from 'lucide-react';

interface SearchBarProps {
  onGenerate: (prompt: string) => void;
  onSearch: (baseName: string) => void;
  isGenerating: boolean;
  compact?: boolean;
}

type Mode = 'generate' | 'search';

const TYPING_SPEED = 50;
const DELETING_SPEED = 30;
const PAUSE_BEFORE_DELETE = 5000;
const PAUSE_BEFORE_TYPE = 500;

export default function SearchBar({ onGenerate, onSearch, isGenerating, compact = false }: SearchBarProps) {
  const [mode, setMode] = useState<Mode>('generate');
  const [inputValue, setInputValue] = useState('');
  const [placeholder, setPlaceholder] = useState('Random');
  const [showTooltip, setShowTooltip] = useState(true);
  const [isTypingPlaceholder, setIsTypingPlaceholder] = useState(false);

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

  // Fetch and animate placeholder
  useEffect(() => {
    if (mode !== 'generate' || inputValue) return;

    let timeoutId: NodeJS.Timeout;
    let currentPrompt = 'Random';
    let charIndex = currentPrompt.length;
    let isDeleting = false;
    let isPaused = false;

    const fetchNewPrompt = async (): Promise<string> => {
      try {
        const response = await fetch('/api/placeholder-prompts');
        if (response.ok) {
          const data = await response.json();
          return data.prompt || 'Random';
        }
      } catch (error) {
        console.error('Failed to fetch prompt:', error);
      }
      return 'Random';
    };

    const animate = async () => {
      if (isPaused) {
        isPaused = false;
        if (isDeleting) {
          timeoutId = setTimeout(animate, PAUSE_BEFORE_TYPE);
        } else {
          timeoutId = setTimeout(animate, PAUSE_BEFORE_DELETE);
        }
        return;
      }

      if (isDeleting) {
        if (charIndex > 0) {
          charIndex--;
          setPlaceholder(currentPrompt.slice(0, charIndex));
          timeoutId = setTimeout(animate, DELETING_SPEED);
        } else {
          // Done deleting, fetch new prompt and start typing
          isDeleting = false;
          setIsTypingPlaceholder(true);
          currentPrompt = await fetchNewPrompt();
          charIndex = 0;
          isPaused = true;
          timeoutId = setTimeout(animate, PAUSE_BEFORE_TYPE);
        }
      } else {
        if (charIndex < currentPrompt.length) {
          charIndex++;
          setPlaceholder(currentPrompt.slice(0, charIndex));
          timeoutId = setTimeout(animate, TYPING_SPEED);
        } else {
          // Done typing, pause then delete
          setIsTypingPlaceholder(false);
          isDeleting = true;
          isPaused = true;
          timeoutId = setTimeout(animate, PAUSE_BEFORE_DELETE);
        }
      }
    };

    // Start animation after initial pause
    timeoutId = setTimeout(animate, PAUSE_BEFORE_DELETE);

    return () => clearTimeout(timeoutId);
  }, [mode, inputValue]);

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

  return (
    <div className={`w-full max-w-2xl mx-auto ${compact ? '' : 'px-4'}`}>
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        {/* Search Input */}
        <div className="flex items-center gap-4 mb-4">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'generate' ? placeholder : 'Enter domain name...'}
            className="flex-1 bg-transparent text-white text-lg placeholder-zinc-500 outline-none py-2"
          />
        </div>

        {/* Mode buttons and action */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('generate')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'generate'
                  ? 'bg-purple-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Generate
            </button>
            <button
              onClick={() => setMode('search')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'search'
                  ? 'bg-purple-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
              }`}
            >
              <Search className="w-4 h-4" />
              Search
            </button>
          </div>

          {/* Action button with tooltip */}
          <div className="relative">
            {/* Tooltip */}
            {showTooltip && mode === 'generate' && (
              <div className="absolute bottom-full right-0 mb-2 w-64 animate-fade-in">
                <div className="bg-zinc-800 text-zinc-300 text-sm p-3 rounded-lg shadow-lg border border-zinc-700">
                  <p>Click with no prompt to generate random domain names</p>
                  <div className="absolute -bottom-2 right-6 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-zinc-800" />
                </div>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={isGenerating || (mode === 'search' && !inputValue.trim())}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              {mode === 'generate' ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  {isGenerating ? 'Generating...' : 'Generate'}
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Search
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
