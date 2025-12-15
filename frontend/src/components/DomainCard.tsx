'use client';

import { Crown, Tag } from 'lucide-react';
import { formatPrice, getAffiliateUrl } from '@/lib/pricing';

interface DomainCardProps {
  domain: string;
  available: boolean | null; // null = loading
  premium?: boolean;
  premiumPrice?: number;
  aftermarket?: boolean;
  error?: string;
}

export default function DomainCard({ domain, available, premium, premiumPrice, aftermarket, error }: DomainCardProps) {
  const statusColor = available === null
    ? 'bg-zinc-600' // Loading
    : available
      ? premium
        ? 'bg-amber-500' // Available but premium priced
        : 'bg-mauve' // Available standard price
      : premium || aftermarket
        ? 'bg-amber-500' // Premium/Aftermarket (taken)
        : 'bg-zinc-500'; // Taken

  const getButtonText = () => {
    if (available === null) return 'Searching...';
    if (error) return 'Error';
    if (premium && premiumPrice) return `${formatPrice(premiumPrice)}`;
    if (available) return 'Register';
    if (aftermarket) return 'Buy';
    return 'Taken';
  };

  const getButtonStyle = () => {
    if (available === null) return 'bg-zinc-700 text-zinc-400 cursor-wait';
    if (error) return 'bg-red-600/50 text-red-200 cursor-not-allowed';
    if (available && premium) return 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer';
    if (available) return 'bg-mauve hover:bg-mauve-hover text-white cursor-pointer';
    if (premium || aftermarket) return 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer';
    return 'bg-zinc-700 text-zinc-400 cursor-default';
  };

  const isClickable = available || premium || aftermarket;
  const buttonClasses = `px-4 py-1.5 rounded text-sm font-medium transition-colors ${getButtonStyle()}`;

  return (
    <div className="flex items-center justify-between py-2 px-1 group">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${statusColor} ${available === null ? 'animate-pulse' : ''}`} />
        <span className="text-zinc-300 group-hover:text-white transition-colors">
          {domain}
        </span>
        {/* Premium price badge - only show for available premium domains */}
        {available && premium && premiumPrice && (
          <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
            <Crown className="w-3 h-3" />
            Premium
          </span>
        )}
        {/* Aftermarket badge */}
        {aftermarket && !premium && (
          <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
            <Tag className="w-3 h-3" />
            For Sale
          </span>
        )}
      </div>
      {isClickable && !error ? (
        <a
          href={getAffiliateUrl(domain)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses}
        >
          {getButtonText()}
        </a>
      ) : (
        <button
          className={buttonClasses}
          disabled={available === null || (!available && !premium && !aftermarket)}
        >
          {getButtonText()}
        </button>
      )}
    </div>
  );
}
