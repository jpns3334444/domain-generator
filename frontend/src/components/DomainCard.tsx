'use client';

interface DomainCardProps {
  domain: string;
  available: boolean | null; // null = loading
  error?: string;
}

export default function DomainCard({ domain, available, error }: DomainCardProps) {
  const statusColor = available === null
    ? 'bg-zinc-600' // Loading
    : available
      ? 'bg-green-500' // Available
      : 'bg-blue-500'; // Taken

  const buttonText = available === null
    ? 'Checking...'
    : available
      ? 'Continue'
      : 'Lookup';

  const buttonStyle = available === null
    ? 'bg-zinc-700 text-zinc-400 cursor-wait'
    : available
      ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
      : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer';

  return (
    <div className="flex items-center justify-between py-2 px-1 group">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${statusColor} ${available === null ? 'animate-pulse' : ''}`} />
        <span className="text-zinc-300 group-hover:text-white transition-colors">
          {domain}
        </span>
      </div>
      <button
        className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${buttonStyle}`}
        disabled={available === null}
      >
        {error ? 'Error' : buttonText}
      </button>
    </div>
  );
}
