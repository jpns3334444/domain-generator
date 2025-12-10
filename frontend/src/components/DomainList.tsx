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

  // Split domains into three columns
  const third = Math.ceil(domains.length / 3);
  const leftColumn = domains.slice(0, third);
  const middleColumn = domains.slice(third, third * 2);
  const rightColumn = domains.slice(third * 2);

  const takenCount = domains.filter(d => d.available === false).length;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 mt-8">
      {/* Three column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Left column */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-400">
              Domain extensions
              <span className="text-zinc-600 ml-2">({takenCount} taken)</span>
            </h3>
          </div>
          <div className="space-y-1">
            {leftColumn.map((domain) => (
              <DomainCard
                key={domain.domain}
                domain={domain.domain}
                available={domain.available}
                error={domain.error}
              />
            ))}
          </div>
        </div>

        {/* Middle column */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-400 invisible">Extensions</h3>
            <span className="text-purple-400 text-sm cursor-pointer hover:text-purple-300">See all</span>
          </div>
          <div className="space-y-1">
            {middleColumn.map((domain) => (
              <DomainCard
                key={domain.domain}
                domain={domain.domain}
                available={domain.available}
                error={domain.error}
              />
            ))}
          </div>
        </div>

        {/* Right column - Premium domains */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-400">Premium domains</h3>
            <span className="text-purple-400 text-sm cursor-pointer hover:text-purple-300">See all</span>
          </div>
          <div className="space-y-1">
            {rightColumn.map((domain) => (
              <DomainCard
                key={domain.domain}
                domain={domain.domain}
                available={domain.available}
                error={domain.error}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
