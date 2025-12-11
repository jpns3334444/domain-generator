'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import DomainCard from './DomainCard';

export interface DomainResult {
  domain: string;
  available: boolean | null;
  premium?: boolean;
  aftermarket?: boolean;
  error?: string;
}

interface DomainListProps {
  domains: DomainResult[];
  isLoading: boolean;
}

export default function DomainList({ domains, isLoading }: DomainListProps) {
  const [showUnavailable, setShowUnavailable] = useState(false);

  if (domains.length === 0 && !isLoading) {
    return null;
  }

  // Split domains into categories
  const availableDomains = domains.filter(d => d.available === true);
  const unavailableDomains = domains.filter(d => d.available === false);
  const loadingDomains = domains.filter(d => d.available === null);

  const availableCount = availableDomains.length;
  const unavailableCount = unavailableDomains.length;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-zinc-400">
          Available domains
          {availableCount > 0 && (
            <span className="text-mauve ml-2">({availableCount} found)</span>
          )}
        </h3>
      </div>

      {/* Available domains grid - only show confirmed available */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1">
        {availableDomains.map((domain) => (
          <DomainCard
            key={domain.domain}
            domain={domain.domain}
            available={domain.available}
            premium={domain.premium}
            aftermarket={domain.aftermarket}
            error={domain.error}
          />
        ))}
      </div>

      {/* Unavailable domains - collapsible section */}
      {unavailableCount > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowUnavailable(!showUnavailable)}
            className="flex items-center gap-2 text-zinc-500 text-sm hover:text-zinc-400 transition-colors"
          >
            {showUnavailable ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <span>{unavailableCount} unavailable</span>
          </button>

          {showUnavailable && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1 mt-3 opacity-60">
              {unavailableDomains.map((domain) => (
                <DomainCard
                  key={domain.domain}
                  domain={domain.domain}
                  available={domain.available}
                  premium={domain.premium}
                  aftermarket={domain.aftermarket}
                  error={domain.error}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
