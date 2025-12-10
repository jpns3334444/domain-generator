'use client';

import { Crown, Tag } from 'lucide-react';

interface DomainCardProps {
  domain: string;
  available: boolean | null; // null = loading
  premium?: boolean;
  aftermarket?: boolean;
  error?: string;
}

export default function DomainCard({ domain, available, premium, aftermarket, error }: DomainCardProps) {
  const statusColor = available === null
    ? 'bg-zinc-600' // Loading
    : available
      ? 'bg-green-500' // Available
      : premium || aftermarket
        ? 'bg-amber-500' // Premium/Aftermarket
        : 'bg-zinc-500'; // Taken

  const getButtonText = () => {
    if (available === null) return 'Checking...';
    if (error) return 'Error';
    if (available) return 'Register';
    if (premium) return 'Premium';
    if (aftermarket) return 'Buy';
    return 'Taken';
  };

  const getButtonStyle = () => {
    if (available === null) return 'bg-zinc-700 text-zinc-400 cursor-wait';
    if (error) return 'bg-red-600/50 text-red-200 cursor-not-allowed';
    if (available) return 'bg-green-600 hover:bg-green-700 text-white cursor-pointer';
    if (premium || aftermarket) return 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer';
    return 'bg-zinc-700 text-zinc-400 cursor-default';
  };

  return (
    <div className="flex items-center justify-between py-2 px-1 group">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${statusColor} ${available === null ? 'animate-pulse' : ''}`} />
        <span className="text-zinc-300 group-hover:text-white transition-colors">
          {domain}
        </span>
        {/* Premium/Aftermarket badges */}
        {premium && (
          <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
            <Crown className="w-3 h-3" />
            Premium
          </span>
        )}
        {aftermarket && !premium && (
          <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
            <Tag className="w-3 h-3" />
            For Sale
          </span>
        )}
      </div>
      <button
        className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${getButtonStyle()}`}
        disabled={available === null || (!available && !premium && !aftermarket)}
      >
        {getButtonText()}
      </button>
    </div>
  );
}
