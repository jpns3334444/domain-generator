'use client';

interface ThinkingPanelProps {
  thinkingText: string;
  isThinking: boolean;
  primaryDomain: string | null;
}

export default function ThinkingPanel({
  thinkingText,
  isThinking,
  primaryDomain,
}: ThinkingPanelProps) {
  // Don't show if nothing to display
  if (!isThinking && !thinkingText) {
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

      {/* AI Interpretation panel */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-2 h-2 rounded-full bg-ids-red ${isThinking ? 'animate-pulse' : ''}`} />
          <span className="text-zinc-400 text-sm font-medium">AI Interpretation</span>
        </div>
        <p className="text-zinc-300 text-sm leading-relaxed">
          {thinkingText || 'Analyzing your request...'}
          {isThinking && (
            <span className="inline-block w-1.5 h-4 bg-ids-red ml-0.5 animate-pulse" />
          )}
        </p>
      </div>
    </div>
  );
}
