'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import DomainCard from './DomainCard';

export interface DomainResult {
  domain: string;
  available: boolean | null;
  premium?: boolean;
  premiumPrice?: number;
  aftermarket?: boolean;
  error?: string;
}

interface DomainListProps {
  domains: DomainResult[]; // Already filtered to available + pending, sliced to visible limit
  unavailableDomains?: DomainResult[]; // Separate prop for unavailable
  isLoading: boolean;
  onSaveDomain?: (domain: string) => void;
  savedDomains?: Set<string>;
  showSaveButton?: boolean;
}

export default function DomainList({
  domains,
  unavailableDomains = [],
  isLoading,
  onSaveDomain,
  savedDomains = new Set(),
  showSaveButton = false,
}: DomainListProps) {
  const [showUnavailable, setShowUnavailable] = useState(false);

  if (domains.length === 0 && unavailableDomains.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="w-full px-12">
      {/* Main domains grid - available and pending only */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-12 gap-y-0">
        {domains.map((domain) => (
          <DomainCard
            key={domain.domain}
            domain={domain.domain}
            available={domain.available}
            premium={domain.premium}
            premiumPrice={domain.premiumPrice}
            aftermarket={domain.aftermarket}
            error={domain.error}
            onSave={onSaveDomain}
            isSaved={savedDomains.has(domain.domain)}
            showSaveButton={showSaveButton}
          />
        ))}
      </div>

      {/* Unavailable domains - collapsible section */}
      {unavailableDomains.length > 0 && (
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
            <span>Unavailable domains ({unavailableDomains.length})</span>
          </button>

          {showUnavailable && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-12 gap-y-0 mt-3 opacity-60">
              {unavailableDomains.map((domain) => (
                <DomainCard
                  key={domain.domain}
                  domain={domain.domain}
                  available={domain.available}
                  premium={domain.premium}
                  premiumPrice={domain.premiumPrice}
                  aftermarket={domain.aftermarket}
                  error={domain.error}
                  onSave={onSaveDomain}
                  isSaved={savedDomains.has(domain.domain)}
                  showSaveButton={showSaveButton}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
