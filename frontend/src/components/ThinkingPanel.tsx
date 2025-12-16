'use client';

import { useEffect, useRef } from 'react';

interface ThinkingPanelProps {
  thinkingText: string;
  isThinking: boolean;
  streamingNames: string[];
  primaryDomain: string | null;
}

export default function ThinkingPanel({
  thinkingText,
  isThinking,
  streamingNames,
  primaryDomain,
}: ThinkingPanelProps) {
  const displayedRef = useRef('');
  const animationFrameRef = useRef<number | null>(null);
  const lastTextRef = useRef('');

  // Simple typewriter using refs to avoid setState in effect issues
  useEffect(() => {
    // Reset on new text that doesn't continue from previous
    if (thinkingText !== lastTextRef.current) {
      if (!thinkingText || !thinkingText.startsWith(lastTextRef.current.slice(0, 10))) {
        displayedRef.current = '';
      }
      lastTextRef.current = thinkingText;
    }

    if (!thinkingText) return;

    const animate = () => {
      if (displayedRef.current.length < thinkingText.length) {
        displayedRef.current = thinkingText.slice(0, displayedRef.current.length + 1);
        animationFrameRef.current = requestAnimationFrame(() => {
          setTimeout(animate, 15);
        });
      }
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [thinkingText]);

  // Calculate displayed text for render (use thinkingText directly for simplicity, animation handled visually)
  const displayedThinking = thinkingText;
  const thinkingComplete = !isThinking;

  // Don't show if nothing to display
  if (!isThinking && !thinkingText && streamingNames.length === 0) {
    return null;
  }

  return (
    <div className="px-12 mb-6">
      {/* Primary domain display */}
      {primaryDomain && (
        <h2 className="text-4xl md:text-5xl font-bold text-ids-red mb-4">
          {primaryDomain}
        </h2>
      )}

      {/* Thinking panel */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
        {/* AI Interpretation section */}
        {(isThinking || thinkingText) && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full bg-ids-red ${isThinking && !thinkingComplete ? 'animate-pulse' : ''}`} />
              <span className="text-zinc-400 text-sm font-medium">AI Interpretation</span>
            </div>
            <p className="text-zinc-300 text-sm leading-relaxed">
              {displayedThinking || (isThinking ? 'Analyzing your request...' : '')}
              {isThinking && !thinkingComplete && (
                <span className="inline-block w-1.5 h-4 bg-ids-red ml-0.5 animate-pulse" />
              )}
            </p>
          </div>
        )}

        {/* Streaming names section */}
        {streamingNames.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full bg-ids-green ${isThinking ? 'animate-pulse' : ''}`} />
              <span className="text-zinc-400 text-sm font-medium">
                {isThinking ? 'Generating' : 'Generated'}: {streamingNames.length} names
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {streamingNames.slice(-12).map((name, index) => (
                <span
                  key={`${name}-${index}`}
                  className="px-2 py-0.5 bg-zinc-800 text-zinc-300 text-sm rounded"
                >
                  {name}
                </span>
              ))}
              {streamingNames.length > 12 && (
                <span className="px-2 py-0.5 text-zinc-500 text-sm">
                  +{streamingNames.length - 12} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Loading state when nothing yet */}
        {isThinking && !thinkingText && streamingNames.length === 0 && (
          <div className="flex items-center gap-2">
            <img src="/loading-computer.gif" alt="Loading" className="w-5 h-5" />
            <span className="text-zinc-400 text-sm">Starting generation...</span>
          </div>
        )}
      </div>
    </div>
  );
}
