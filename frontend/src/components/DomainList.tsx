'use client';

import DomainCard from './DomainCard';

export interface DomainResult {
  domain: string;
  available: boolean | null;
  error?: string;
}

interface DomainListProps {
  domains: DomainResult[];
  isLoading: boolean;
}

export default function DomainList({ domains, isLoading }: DomainListProps) {
  if (domains.length === 0 && !isLoading) {
    return null;
  }

  // Group domains into columns
  const availableDomains = domains.filter(d => d.available === true);
  const takenDomains = domains.filter(d => d.available === false);
  const checkingDomains = domains.filter(d => d.available === null);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 mt-8">
      {/* Stats bar */}
      <div className="flex items-center gap-6 mb-6 text-sm">
        <span className="text-zinc-400">
          <span className="text-green-500 font-semibold">{availableDomains.length}</span> available
        </span>
        <span className="text-zinc-400">
          <span className="text-blue-500 font-semibold">{takenDomains.length}</span> taken
        </span>
        {checkingDomains.length > 0 && (
          <span className="text-zinc-400">
            <span className="text-zinc-500 font-semibold">{checkingDomains.length}</span> checking...
          </span>
        )}
      </div>

      {/* Three column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Available domains */}
        <div>
          <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            Available ({availableDomains.length})
          </h3>
          <div className="space-y-1">
            {availableDomains.map((domain) => (
              <DomainCard
                key={domain.domain}
                domain={domain.domain}
                available={domain.available}
                error={domain.error}
              />
            ))}
            {availableDomains.length === 0 && !isLoading && (
              <p className="text-zinc-600 text-sm">No available domains yet</p>
            )}
          </div>
        </div>

        {/* Taken domains */}
        <div>
          <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            Taken ({takenDomains.length})
          </h3>
          <div className="space-y-1">
            {takenDomains.map((domain) => (
              <DomainCard
                key={domain.domain}
                domain={domain.domain}
                available={domain.available}
                error={domain.error}
              />
            ))}
            {takenDomains.length === 0 && !isLoading && (
              <p className="text-zinc-600 text-sm">No taken domains yet</p>
            )}
          </div>
        </div>

        {/* Checking domains */}
        <div>
          <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse" />
            Checking ({checkingDomains.length})
          </h3>
          <div className="space-y-1">
            {checkingDomains.map((domain) => (
              <DomainCard
                key={domain.domain}
                domain={domain.domain}
                available={domain.available}
                error={domain.error}
              />
            ))}
            {checkingDomains.length === 0 && !isLoading && (
              <p className="text-zinc-600 text-sm">All domains checked</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
