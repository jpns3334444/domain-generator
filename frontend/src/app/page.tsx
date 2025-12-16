'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import SearchBar from '@/components/SearchBar';
import TldSelector from '@/components/TldSelector';
import DomainList, { DomainResult } from '@/components/DomainList';
import { generateDomainNames } from '@/lib/gemini';
import { checkDomainsBatch } from '@/lib/whois';

const DotLottiePlayer = dynamic(
  () => import('@dotlottie/react-player').then((mod) => mod.DotLottiePlayer),
  {
    ssr: false,
    loading: () => (
      <img
        src="/animation-placeholder.png"
        alt=""
        width={600}
        height={450}
        className="w-full h-full object-contain object-top"
      />
    )
  }
);

const GENERATE_COUNT = 50; // Generate 50 names per batch
const DOMAINS_PER_LOAD = 15; // Show 15 more domains per "Load More"
const GENERATION_BUFFER = 15; // Generate more when reserve drops below this (roughly one Load More worth)

export default function Home() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [domains, setDomains] = useState<DomainResult[]>([]); // ALL domains, flat array
  const [selectedTlds, setSelectedTlds] = useState<string[]>(['com']);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [primaryDomain, setPrimaryDomain] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState(DOMAINS_PER_LOAD); // How many available+pending to show

  const handleGenerate = useCallback(async (prompt: string, append: boolean = false) => {
    console.log(`[Generate] === Generation Started === (append: ${append})`);

    setIsGenerating(true);
    setHasGenerated(true);

    if (!append) {
      setLastPrompt(prompt);
      setDomains([]);
      setVisibleCount(DOMAINS_PER_LOAD);
      setPrimaryDomain(null);
    }

    const activePrompt = append ? lastPrompt : prompt;

    try {
      // Generate domain names with Gemini
      console.log(`[Generate] Starting Gemini generation...`);
      const names = await generateDomainNames(GENERATE_COUNT, activePrompt);
      console.log(`[Generate] Got ${names.length} names`);

      // Create domain list with all TLD combinations
      const newDomains: DomainResult[] = [];
      for (const name of names) {
        for (const tld of selectedTlds) {
          newDomains.push({
            domain: `${name}.${tld}`,
            available: null, // pending
          });
        }
      }

      // Set primary domain from first name
      if (!append && newDomains.length > 0) {
        setPrimaryDomain(newDomains[0].domain);
      }

      // Add all new domains to state immediately (they show as "Searching...")
      setDomains(prev => [...prev, ...newDomains]);
      console.log(`[Generate] Added ${newDomains.length} domains to state`);

      // Check all domains in batches
      const allDomainsToCheck = newDomains.map(d => d.domain);
      const BATCH_SIZE = 50;

      for (let i = 0; i < allDomainsToCheck.length; i += BATCH_SIZE) {
        const batch = allDomainsToCheck.slice(i, i + BATCH_SIZE);

        try {
          const results = await checkDomainsBatch(batch);
          const availableCount = results.filter(r => r.available === true).length;
          const unavailableCount = results.filter(r => r.available === false).length;
          console.log(`[Batch ${Math.floor(i / BATCH_SIZE) + 1}] Checked ${batch.length}: ${availableCount} available, ${unavailableCount} unavailable`);

          // Update domain statuses in state
          setDomains(prev => {
            const updated = prev.map(d => {
              const result = results.find(r => r.domain === d.domain);
              if (result) {
                return { ...d, ...result };
              }
              return d;
            });
            // Log current totals
            const totalAvailable = updated.filter(d => d.available === true).length;
            const totalPending = updated.filter(d => d.available === null).length;
            const totalUnavailable = updated.filter(d => d.available === false).length;
            console.log(`[State] Total: ${totalAvailable} available, ${totalPending} pending, ${totalUnavailable} unavailable`);
            return updated;
          });
        } catch (error) {
          console.error('Batch check failed:', error);
          // Mark batch as errored
          setDomains(prev => prev.map(d => {
            if (batch.includes(d.domain)) {
              return { ...d, available: false, error: 'Check failed' };
            }
            return d;
          }));
        }
      }

    } catch (error) {
      console.error('Generation failed:', error);
      alert('Failed to generate domains. Please check your Gemini API key.');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedTlds, lastPrompt]);

  const handleSearch = useCallback(async (baseName: string) => {
    setIsGenerating(true);
    setHasGenerated(true);

    // Clean the base name (remove any TLD if user included it)
    const cleanName = baseName.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!cleanName) {
      setIsGenerating(false);
      return;
    }

    // Clear previous results for search mode
    setDomains([]);
    setVisibleCount(DOMAINS_PER_LOAD);
    setPrimaryDomain(`${cleanName}.${selectedTlds[0] || 'com'}`);

    // Create domain list for all selected TLDs
    const domainNames = selectedTlds.map((tld) => `${cleanName}.${tld}`);

    // Show domains as pending first
    setDomains(domainNames.map(domain => ({ domain, available: null })));

    // Check availability using batch API
    try {
      const results = await checkDomainsBatch(domainNames);
      setDomains(results);
    } catch (error) {
      console.error('Search failed:', error);
      setDomains(domainNames.map(domain => ({
        domain,
        available: false,
        error: error instanceof Error ? error.message : 'Check failed',
      })));
    }

    setIsGenerating(false);
  }, [selectedTlds]);

  // Derived values - split domains by status
  const availableOrPending = domains.filter(d => d.available === true || d.available === null);
  const unavailableDomains = domains.filter(d => d.available === false);
  const visibleDomains = availableOrPending.slice(0, visibleCount);
  const hasMoreToShow = availableOrPending.length > visibleCount;

  // Handle Load More - instant UI update, generate more if needed
  const handleLoadMore = useCallback(() => {
    const newVisibleCount = visibleCount + DOMAINS_PER_LOAD;
    setVisibleCount(newVisibleCount);

    // Calculate reserve (what's left after showing)
    const reserve = availableOrPending.length - newVisibleCount;
    const showing = Math.min(newVisibleCount, availableOrPending.length);
    const hidden = Math.max(0, availableOrPending.length - newVisibleCount);

    console.log(`[Load More] visibleCount: ${newVisibleCount}, showing: ${showing}, hidden: ${hidden}, unavailable: ${unavailableDomains.length}, reserve: ${reserve}`);

    // Only generate more if reserve drops below buffer
    if (reserve < GENERATION_BUFFER && !isGenerating && lastPrompt) {
      console.log(`[Load More] Reserve (${reserve}) < buffer (${GENERATION_BUFFER}), generating more...`);
      handleGenerate(lastPrompt, true);
    }
  }, [visibleCount, availableOrPending.length, unavailableDomains.length, isGenerating, lastPrompt, handleGenerate]);

  return (
    <div className="min-h-screen bg-black">
      <span className="hidden">Impact-Site-Verification: 664bdf39-f63c-4758-82b9-3a5adfcc8ca0</span>
      {/* Hero Section */}
      <div className={`flex flex-col items-center justify-center ${hasGenerated ? 'pt-8 pb-4' : 'min-h-screen'}`}>
        {!hasGenerated && (
          <>
            <div className="w-96 h-96 -mb-32">
              <DotLottiePlayer
                src="/animation.lottie"
                autoplay
                loop
              />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 text-center">
              Generate Domain Names
            </h1>
            <p className="text-zinc-400 text-lg md:text-xl text-center max-w-2xl mb-12 px-4">
              Create unique domain names with AI. Describe your business or generate random names,
              then instantly check availability.
            </p>
          </>
        )}

        <SearchBar
          onGenerate={handleGenerate}
          onSearch={handleSearch}
          isGenerating={isGenerating}
          compact={hasGenerated}
        />

        <div className="mt-6">
          <TldSelector
            selectedTlds={selectedTlds}
            onTldChange={setSelectedTlds}
          />
        </div>
      </div>

      {/* Results Section */}
      {hasGenerated && (
        <div className="pb-12">
          {/* Loading state */}
          {domains.length === 0 && isGenerating && (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-3 text-zinc-400">
                <img src="/loading-computer.gif" alt="Loading" className="w-6 h-6" />
                <span>Generating domain names with AI...</span>
              </div>
            </div>
          )}

          {/* Progress indicator while generating */}
          {isGenerating && domains.length > 0 && (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-3 text-zinc-400">
                <img src="/loading-computer.gif" alt="Loading" className="w-5 h-5" />
                <span>Finding available domains...</span>
              </div>
            </div>
          )}

          {/* Primary domain display */}
          {primaryDomain && !isGenerating && (
            <div className="max-w-6xl mx-auto px-4 mb-8">
              <h2 className="text-4xl md:text-5xl font-bold text-mauve mb-4">
                {primaryDomain}
              </h2>
              <div className="flex flex-wrap gap-2">
                <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 text-sm transition-colors">
                  <span>Bookmark</span>
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 text-sm transition-colors">
                  <span>Copy URL</span>
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 text-sm transition-colors">
                  <span>Pronounce</span>
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 text-sm transition-colors">
                  <span>Appraise</span>
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 text-sm transition-colors">
                  <span>See More</span>
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 text-sm transition-colors">
                  <span>...</span>
                </button>
              </div>
            </div>
          )}

          <DomainList
            domains={visibleDomains}
            unavailableDomains={unavailableDomains}
            isLoading={isGenerating}
          />

          {/* Load More button - show when there's more to display OR we can generate more */}
          {hasGenerated && !isGenerating && (hasMoreToShow || lastPrompt) && (
            <div className="text-center mt-12">
              <button
                onClick={handleLoadMore}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
