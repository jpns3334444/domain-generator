'use client';

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import SearchBar from '@/components/SearchBar';
import TldSelector from '@/components/TldSelector';
import DomainList, { DomainResult } from '@/components/DomainList';
import { generateDomainNamesParallel } from '@/lib/gemini';
import { checkDomainsWithLimit } from '@/lib/whois';

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

const TARGET_DISPLAY = 15; // Number of available domains to display
const GENERATE_COUNT = 100; // Generate 100 names per batch for better coverage

export default function Home() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [domains, setDomains] = useState<DomainResult[]>([]);
  const [selectedTlds, setSelectedTlds] = useState<string[]>(['com']);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [primaryDomain, setPrimaryDomain] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string>('');

  // Queue of domain names waiting to be shown
  const pendingQueueRef = useRef<string[]>([]);
  // Track which domains are currently being checked
  const checkingDomainsRef = useRef<Set<string>>(new Set());
  // Store available domains found beyond the 15 shown (for Load More)
  const [leftoverDomains, setLeftoverDomains] = useState<DomainResult[]>([]);

  // Helper to check a single domain and update state
  const checkAndUpdateDomain = useCallback(async (domainName: string) => {
    if (checkingDomainsRef.current.has(domainName)) return;
    checkingDomainsRef.current.add(domainName);

    try {
      await checkDomainsWithLimit([domainName], (result) => {
        setDomains((prev) => {
          // Check if this domain is currently displayed
          const isDisplayed = prev.some(d => d.domain === result.domain);

          if (isDisplayed) {
            // Update the displayed domain's status
            const updated = prev.map(d =>
              d.domain === result.domain
                ? { ...d, available: result.available, premium: result.premium, aftermarket: result.aftermarket, error: result.error }
                : d
            );

            // If unavailable, add a replacement from leftovers or queue
            if (result.available === false) {
              const visibleCount = updated.filter(d => d.available === true || d.available === null).length;
              if (visibleCount < TARGET_DISPLAY) {
                // Try leftovers first (already checked, available)
                setLeftoverDomains((leftovers) => {
                  if (leftovers.length > 0) {
                    const [nextLeftover, ...remaining] = leftovers;
                    setDomains((curr) => [...curr, nextLeftover]);
                    return remaining;
                  }
                  return leftovers;
                });
              }
            }

            return updated;
          } else {
            // This is a queue item - if available, store as leftover
            if (result.available === true) {
              setLeftoverDomains((leftovers) => [...leftovers, {
                domain: result.domain,
                available: true,
                premium: result.premium,
                aftermarket: result.aftermarket,
                error: result.error,
              }]);
            }
            return prev;
          }
        });
      });
    } finally {
      checkingDomainsRef.current.delete(domainName);
    }
  }, []);

  const handleGenerate = useCallback(async (prompt: string, append: boolean = false) => {
    console.log(`[Generate] === Generation Started ===`);

    setIsGenerating(true);
    setHasGenerated(true);

    // Store the prompt for "Load More" functionality (only on fresh generation)
    if (!append) {
      setLastPrompt(prompt);
      setDomains([]);
      setPrimaryDomain(null);
      pendingQueueRef.current = [];
      checkingDomainsRef.current.clear();
      setLeftoverDomains([]);
    }

    // Use stored prompt when appending, otherwise use provided prompt
    const activePrompt = append ? lastPrompt : prompt;

    try {
      // === PHASE 1: Generate domain names with Gemini ===
      console.log(`[Generate] Starting Gemini generation...`);
      const { fast: fastNames, fullPromise } = await generateDomainNamesParallel(10, GENERATE_COUNT, activePrompt);
      console.log(`[Generate] Got ${fastNames.length} fast names`);

      // Set primary domain from first fast name
      if (!append && fastNames.length > 0) {
        setPrimaryDomain(`${fastNames[0]}.${selectedTlds[0] || 'com'}`);
      }

      // Create domain list from fast names
      const allDomains: string[] = [];
      for (const name of fastNames) {
        for (const tld of selectedTlds) {
          allDomains.push(`${name}.${tld}`);
        }
      }

      // === PHASE 2: Show first 15 domains immediately with pending status ===
      const initialDomains = allDomains.slice(0, TARGET_DISPLAY);
      const queueDomains = allDomains.slice(TARGET_DISPLAY);

      // Add initial domains to display
      const initialResults: DomainResult[] = initialDomains.map(domain => ({
        domain,
        available: null, // pending
      }));

      if (append) {
        setDomains((prev) => [...prev, ...initialResults]);
      } else {
        setDomains(initialResults);
      }

      // Store rest in queue
      pendingQueueRef.current = [...pendingQueueRef.current, ...queueDomains];
      console.log(`[Generate] Showing ${initialDomains.length} domains, ${queueDomains.length} in queue`);

      // === PHASE 3: Start checking availability for displayed domains ===
      initialDomains.forEach(domain => {
        checkAndUpdateDomain(domain);
      });

      // === PHASE 4: Wait for full names and add to queue ===
      const fullNames = await fullPromise;
      console.log(`[Generate] Got ${fullNames.length} full names`);

      // Dedupe against fast names
      const fastNameSet = new Set(fastNames.map(n => n.toLowerCase()));
      const additionalNames = fullNames.filter(n => !fastNameSet.has(n.toLowerCase()));

      // Add additional names to queue
      const additionalDomains: string[] = [];
      for (const name of additionalNames) {
        for (const tld of selectedTlds) {
          additionalDomains.push(`${name}.${tld}`);
        }
      }
      pendingQueueRef.current = [...pendingQueueRef.current, ...additionalDomains];
      console.log(`[Generate] Added ${additionalDomains.length} more to queue, total queue: ${pendingQueueRef.current.length}`);

      // Check ALL queue items - they'll become leftovers for Load More
      pendingQueueRef.current.forEach(domain => checkAndUpdateDomain(domain));

    } catch (error) {
      console.error('Generation failed:', error);
      alert('Failed to generate domains. Please check your Gemini API key.');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedTlds, lastPrompt, checkAndUpdateDomain]);

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
    pendingQueueRef.current = [];
    checkingDomainsRef.current.clear();
    setLeftoverDomains([]);
    setPrimaryDomain(`${cleanName}.${selectedTlds[0] || 'com'}`);

    // Create domain list for all selected TLDs
    const domainNames = selectedTlds.map((tld) => `${cleanName}.${tld}`);

    // Check availability - show all results for search (no filtering)
    await checkDomainsWithLimit(domainNames, (result) => {
      setDomains((prev) => [...prev, result]);
    });

    setIsGenerating(false);
  }, [selectedTlds]);

  // Handle Load More - use leftovers first, then generate more
  const handleLoadMore = useCallback(() => {
    if (leftoverDomains.length > 0) {
      // Show from leftovers (already checked, available)
      const toShow = leftoverDomains.slice(0, TARGET_DISPLAY);
      const remaining = leftoverDomains.slice(TARGET_DISPLAY);

      setDomains((prev) => [...prev, ...toShow]);
      setLeftoverDomains(remaining);
      console.log(`[Load More] Showing ${toShow.length} from leftovers, ${remaining.length} remaining`);

      // If leftovers are getting low, generate more
      if (remaining.length < TARGET_DISPLAY) {
        handleGenerate('', true);
      }
    } else {
      // No leftovers, generate more
      handleGenerate('', true);
    }
  }, [leftoverDomains, handleGenerate]);

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
                <div className="w-5 h-5 border-2 border-mauve border-t-transparent rounded-full animate-spin" />
                <span>Generating domain names with AI...</span>
              </div>
            </div>
          )}

          {/* Progress indicator while generating */}
          {isGenerating && domains.length > 0 && (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-3 text-zinc-400">
                <div className="w-4 h-4 border-2 border-mauve border-t-transparent rounded-full animate-spin" />
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

          <DomainList domains={domains} isLoading={isGenerating} />

          {/* Load More button - always show after generation */}
          {hasGenerated && !isGenerating && (
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
