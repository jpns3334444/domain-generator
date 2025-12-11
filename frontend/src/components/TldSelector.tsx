'use client';

interface TldSelectorProps {
  selectedTlds: string[];
  onTldChange: (tlds: string[]) => void;
}

const AVAILABLE_TLDS = [
  { tld: 'com', label: '.com', popular: true },
  { tld: 'net', label: '.net', popular: true },
  { tld: 'org', label: '.org', popular: true },
  { tld: 'io', label: '.io', popular: true },
  { tld: 'ai', label: '.ai', popular: true },
  { tld: 'dev', label: '.dev', popular: false },
  { tld: 'app', label: '.app', popular: false },
  { tld: 'co', label: '.co', popular: false },
  { tld: 'xyz', label: '.xyz', popular: false },
  { tld: 'tech', label: '.tech', popular: false },
];

export default function TldSelector({ selectedTlds, onTldChange }: TldSelectorProps) {
  const toggleTld = (tld: string) => {
    if (selectedTlds.includes(tld)) {
      // Don't allow deselecting the last TLD
      if (selectedTlds.length > 1) {
        onTldChange(selectedTlds.filter((t) => t !== tld));
      }
    } else {
      onTldChange([...selectedTlds, tld]);
    }
  };

  const selectAll = () => {
    onTldChange(AVAILABLE_TLDS.map((t) => t.tld));
  };

  const selectPopular = () => {
    onTldChange(AVAILABLE_TLDS.filter((t) => t.popular).map((t) => t.tld));
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-zinc-400 text-sm">Check extensions:</span>
        <div className="flex gap-2">
          <button
            onClick={selectPopular}
            className="text-xs text-mauve hover:text-mauve-hover transition-colors"
          >
            Popular
          </button>
          <span className="text-zinc-600">|</span>
          <button
            onClick={selectAll}
            className="text-xs text-mauve hover:text-mauve-hover transition-colors"
          >
            All
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {AVAILABLE_TLDS.map(({ tld, label }) => {
          const isSelected = selectedTlds.includes(tld);
          return (
            <button
              key={tld}
              onClick={() => toggleTld(tld)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-mauve text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { AVAILABLE_TLDS };
