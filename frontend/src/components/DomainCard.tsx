'use client';

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
  // IDS-style status dots: green for available, orange for taken, gray for searching
  const statusColor = available === null
    ? 'bg-zinc-500' // Searching
    : available
      ? 'bg-ids-green' // Available
      : 'bg-ids-orange'; // Taken

  const getButtonText = () => {
    if (available === null) return 'Searching...';
    if (error) return 'Error';
    if (available && premium && premiumPrice) return `${formatPrice(premiumPrice)}`;
    if (available) return 'Continue';
    if (aftermarket) return 'Make offer';
    return 'Taken';
  };

  const getButtonStyle = () => {
    if (available === null) return 'bg-zinc-800 text-zinc-500 cursor-wait';
    if (error) return 'bg-zinc-800 text-red-400 cursor-not-allowed';
    if (available && premium) return 'bg-zinc-700 hover:bg-zinc-600 text-ids-green cursor-pointer';
    if (available) return 'bg-zinc-700 hover:bg-zinc-600 text-ids-green cursor-pointer';
    if (premium || aftermarket) return 'bg-zinc-700 hover:bg-zinc-600 text-ids-cyan cursor-pointer';
    return 'bg-zinc-800 text-zinc-600 cursor-default';
  };

  const isClickable = available || premium || aftermarket;
  const buttonClasses = `px-3 py-1 rounded text-sm font-medium transition-colors ${getButtonStyle()}`;

  return (
    <div className="flex items-center justify-between py-1.5 px-1 group">
      <div className="flex items-center gap-2.5">
        <div className={`w-2 h-2 rounded-full ${statusColor} ${available === null ? 'animate-pulse' : ''}`} />
        <span className="text-zinc-400 group-hover:text-white transition-colors">
          {domain}
        </span>
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
