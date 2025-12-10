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

  const takenCount = domains.filter(d => d.available === false).length;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-zinc-400">
          Domain extensions
          <span className="text-zinc-600 ml-2">({takenCount} taken)</span>
        </h3>
        <span className="text-mauve text-sm cursor-pointer hover:text-mauve-hover">See all</span>
      </div>

      {/* Three column grid that fills row by row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1">
        {domains.map((domain) => (
          <DomainCard
            key={domain.domain}
            domain={domain.domain}
            available={domain.available}
            error={domain.error}
          />
        ))}
      </div>
    </div>
  );
}
