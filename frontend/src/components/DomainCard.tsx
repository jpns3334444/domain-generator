'use client';

import { Heart } from 'lucide-react';
import { formatPrice, getAffiliateUrl } from '@/lib/pricing';
import { trackEvent, AnalyticsEvents } from '@/lib/analytics';

interface DomainCardProps {
  domain: string;
  available: boolean | null; // null = loading
  premium?: boolean;
  premiumPrice?: number;
  aftermarket?: boolean;
  error?: string;
  onSave?: (domain: string) => void;
  isSaved?: boolean;
  showSaveButton?: boolean;
}

export default function DomainCard({
  domain,
  available,
  premium,
  premiumPrice,
  aftermarket,
  error,
  onSave,
  isSaved = false,
  showSaveButton = false,
}: DomainCardProps) {
  // IDS-style status dots: green for available, orange for taken, amber for searching
  const statusColor = available === null
    ? 'bg-amber-400' // Searching
    : available
      ? 'bg-ids-green' // Available
      : 'bg-ids-orange'; // Taken

  const getButtonContent = () => {
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
    if (available && premium) return 'bg-zinc-800 hover:bg-zinc-700 text-ids-green cursor-pointer';
    if (available) return 'bg-zinc-800 hover:bg-zinc-700 text-ids-green cursor-pointer';
    if (premium || aftermarket) return 'bg-zinc-800 hover:bg-zinc-700 text-ids-cyan cursor-pointer';
    return 'bg-zinc-800 text-zinc-600 cursor-default';
  };

  const isClickable = available || premium || aftermarket;
  const buttonClasses = `px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${getButtonStyle()}`;

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onSave) {
      onSave(domain);
    }
  };

  const handleAffiliateClick = () => {
    const status = available ? (premium ? 'premium' : 'available') : (aftermarket ? 'aftermarket' : 'taken');
    trackEvent(AnalyticsEvents.AFFILIATE_CLICK, {
      domain,
      registrar: 'namecheap',
      status,
    });
  };

  return (
    <div className="flex items-center justify-between py-1.5 px-1 group">
      <div className="flex items-center gap-2.5">
        <div className={`w-2 h-2 rounded-full ${statusColor} ${available === null ? 'animate-pulse' : ''}`} />
        <span className="text-white">
          {domain}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {showSaveButton && (
          <button
            onClick={handleSave}
            className={`p-1.5 rounded transition-colors ${
              isSaved
                ? 'text-ids-red'
                : 'text-zinc-500 hover:text-ids-red opacity-0 group-hover:opacity-100'
            }`}
            title={isSaved ? 'Saved' : 'Save to favorites'}
          >
            <Heart size={16} fill={isSaved ? 'currentColor' : 'none'} />
          </button>
        )}
        {isClickable && !error ? (
          <a
            href={getAffiliateUrl(domain)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses}
            onClick={handleAffiliateClick}
          >
            {getButtonContent()}
          </a>
        ) : (
          <button
            className={buttonClasses}
            disabled={available === null || (!available && !premium && !aftermarket)}
          >
            {getButtonContent()}
          </button>
        )}
      </div>
    </div>
  );
}
