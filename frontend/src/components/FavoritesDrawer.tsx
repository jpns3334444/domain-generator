'use client';

import { useState, useEffect } from 'react';
import { Heart, X, Copy, Check, ExternalLink, Trash2 } from 'lucide-react';
import { SavedDomain } from '@/types/conversation';
import { getSavedDomains, removeDomain, exportFavoritesCSV } from '@/lib/preferences';
import { getAffiliateUrl } from '@/lib/pricing';
import { trackEvent, AnalyticsEvents } from '@/lib/analytics';

interface FavoritesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onFavoritesChange?: (count: number) => void;
}

export default function FavoritesDrawer({ isOpen, onClose, onFavoritesChange }: FavoritesDrawerProps) {
  const [favorites, setFavorites] = useState<SavedDomain[]>([]);
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);

  // Load favorites when drawer opens
  useEffect(() => {
    if (isOpen) {
      const saved = getSavedDomains();
      // Sort by most recent first
      setFavorites(saved.sort((a, b) => b.savedAt - a.savedAt));
      trackEvent('favorites_drawer_opened', { count: saved.length });
    }
  }, [isOpen]);

  const handleRemove = (domain: string) => {
    const updated = removeDomain(domain);
    setFavorites(updated.sort((a, b) => b.savedAt - a.savedAt));
    onFavoritesChange?.(updated.length);
    trackEvent(AnalyticsEvents.DOMAIN_SAVED, { domain, isSaved: false, source: 'drawer' });
  };

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

  const handleAffiliateClick = (domain: string) => {
    trackEvent(AnalyticsEvents.AFFILIATE_CLICK, {
      domain,
      registrar: 'namecheap',
      source: 'favorites_drawer',
    });
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-96 max-w-[90vw] bg-zinc-900 border-l border-zinc-800 z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-ids-red" fill="currentColor" />
            <h2 className="text-lg font-semibold text-white">Favorites</h2>
            <span className="text-zinc-500 text-sm">({favorites.length})</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white transition-colors rounded hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar */}
        {favorites.length > 0 && (
          <div className="flex items-center gap-2 p-3 border-b border-zinc-800">
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {favorites.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500">No favorites yet</p>
              <p className="text-zinc-600 text-sm mt-1">
                Click the heart icon on any domain to save it
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {favorites.slice(0, 10).map(({ domain }) => (
                <div
                  key={domain}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-800/50 group"
                >
                  <a
                    href={getAffiliateUrl(domain)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:text-ids-cyan transition-colors flex-1 truncate"
                    onClick={() => handleAffiliateClick(domain)}
                  >
                    {domain}
                  </a>
                  <div className="flex items-center gap-0.5">
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
              ))}
            </div>
          )}
        </div>

        {/* Footer - See more link */}
        {favorites.length > 0 && (
          <div className="p-4 border-t border-zinc-800">
            <a
              href="/favorites"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 text-ids-cyan hover:text-ids-cyan-hover transition-colors text-sm font-medium"
            >
              See more...
            </a>
          </div>
        )}
      </div>
    </>
  );
}
