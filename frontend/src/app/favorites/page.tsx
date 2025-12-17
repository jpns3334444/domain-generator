'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Heart, Copy, Download, Trash2, Check, ArrowLeft } from 'lucide-react';
import { SavedDomain } from '@/types/conversation';
import { getSavedDomains, removeDomain, exportFavoritesCSV } from '@/lib/preferences';
import { getAffiliateUrl } from '@/lib/pricing';
import { trackEvent, AnalyticsEvents } from '@/lib/analytics';

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<SavedDomain[]>([]);
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');

  useEffect(() => {
    setFavorites(getSavedDomains());
    trackEvent('favorites_page_viewed');
  }, []);

  const sortedFavorites = useMemo(() => {
    return [...favorites].sort((a, b) => {
      if (sortBy === 'date') return b.savedAt - a.savedAt;
      return a.domain.localeCompare(b.domain);
    });
  }, [favorites, sortBy]);

  const handleCopyDomain = async (domain: string) => {
    try {
      await navigator.clipboard.writeText(domain);
      setCopiedDomain(domain);
      setTimeout(() => setCopiedDomain(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyAll = async () => {
    const domains = favorites.map(f => f.domain).join('\n');
    try {
      await navigator.clipboard.writeText(domains);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
      trackEvent('favorites_copied_all', { count: favorites.length });
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleExportCSV = () => {
    const csv = exportFavoritesCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'favorite-domains.csv';
    a.click();
    URL.revokeObjectURL(url);
    trackEvent('favorites_exported', { count: favorites.length });
  };

  const handleRemove = (domain: string) => {
    const updated = removeDomain(domain);
    setFavorites(updated);
    trackEvent(AnalyticsEvents.DOMAIN_SAVED, { domain, isSaved: false, source: 'favorites_page' });
  };

  const handleAffiliateClick = (domain: string) => {
    trackEvent(AnalyticsEvents.AFFILIATE_CLICK, {
      domain,
      registrar: 'namecheap',
      source: 'favorites_page',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="p-2 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-800"
                title="Back to home"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <Heart className="w-6 h-6 text-ids-red" fill="currentColor" />
                <h1 className="text-xl font-bold text-white">Favorite Domains</h1>
                <span className="text-zinc-500">({favorites.length})</span>
              </div>
            </div>

            {/* Action buttons */}
            {favorites.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyAll}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  {copiedAll ? (
                    <>
                      <Check className="w-4 h-4 text-ids-green" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {favorites.length === 0 ? (
          <div className="text-center py-20">
            <Heart className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">No favorites yet</h2>
            <p className="text-zinc-500 mb-6">Save domains you like by clicking the heart icon</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 text-ids-cyan hover:text-ids-cyan-hover transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Start searching for domains
            </Link>
          </div>
        ) : (
          <>
            {/* Sort controls */}
            <div className="flex items-center gap-4 mb-6">
              <span className="text-zinc-500 text-sm">Sort by:</span>
              <button
                onClick={() => setSortBy('date')}
                className={`text-sm px-3 py-1 rounded transition-colors ${
                  sortBy === 'date'
                    ? 'text-white bg-zinc-800'
                    : 'text-zinc-500 hover:text-white'
                }`}
              >
                Date
              </button>
              <button
                onClick={() => setSortBy('name')}
                className={`text-sm px-3 py-1 rounded transition-colors ${
                  sortBy === 'name'
                    ? 'text-white bg-zinc-800'
                    : 'text-zinc-500 hover:text-white'
                }`}
              >
                Name
              </button>
            </div>

            {/* Favorites grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {sortedFavorites.map(({ domain, savedAt }) => (
                <div
                  key={domain}
                  className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <a
                      href={getAffiliateUrl(domain)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:text-ids-cyan font-medium transition-colors truncate flex-1 mr-2"
                      onClick={() => handleAffiliateClick(domain)}
                    >
                      {domain}
                    </a>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyDomain(domain)}
                        className="p-1.5 text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-zinc-700"
                        title="Copy domain"
                      >
                        {copiedDomain === domain ? (
                          <Check className="w-4 h-4 text-ids-green" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleRemove(domain)}
                        className="p-1.5 text-zinc-500 hover:text-ids-red opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-zinc-700"
                        title="Remove from favorites"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-zinc-500 text-xs mt-2">
                    Saved {formatRelativeTime(savedAt)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
