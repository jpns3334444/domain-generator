'use client';

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import SearchBar from '@/components/SearchBar';
import TldSelector from '@/components/TldSelector';
import DomainList, { DomainResult } from '@/components/DomainList';
import { generateDomainNames } from '@/lib/gemini';
import { checkDomainsHybrid, checkDomainsWithLimit } from '@/lib/whois';

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
  const [leftoverDomains, setLeftoverDomains] = useState<DomainResult[]>([]);

  // Use ref to track counts across async updates
  const displayedCountRef = useRef(0);

  const handleGenerate = useCallback(async (prompt: string, append: boolean = false) => {
    setIsGenerating(true);
    setHasGenerated(true);

    // Store the prompt for "Load More" functionality (only on fresh generation)
    if (!append) {
      setLastPrompt(prompt);
      setDomains([]);
      setPrimaryDomain(null);
      setLeftoverDomains([]);
      displayedCountRef.current = 0;
    }

    // Use stored prompt when appending, otherwise use provided prompt
    const activePrompt = append ? lastPrompt : prompt;

    try {
      // Generate domain names using Gemini (100 names for better coverage)
      const geminiStart = performance.now();
      const generatedNames = await generateDomainNames(GENERATE_COUNT, activePrompt);
      console.log(`[Timing] Gemini API: ${(performance.now() - geminiStart).toFixed(0)}ms for ${generatedNames.length} names`);

      // Set primary domain from first name
      if (!append && generatedNames.length > 0) {
        setPrimaryDomain(`${generatedNames[0]}.com`);
      }

      // Create domain list for all name + TLD combinations
      const allDomains: string[] = [];
      for (const name of generatedNames) {
        for (const tld of selectedTlds) {
          allDomains.push(`${name}.${tld}`);
        }
      }

      // Track available domains as they come in
      const availableResults: DomainResult[] = [];
      let totalChecked = 0;

      // Check availability using hybrid approach (7 individual + batches of 30)
      const whoisStart = performance.now();
      console.log(`[Page] Starting hybrid check for ${allDomains.length} domains`);

      await checkDomainsHybrid(allDomains, (result) => {
        totalChecked++;
        console.log(`[Page] Result: ${result.domain} available=${result.available} (type: ${typeof result.available})`);

        if (result.available === true) {
          availableResults.push(result);
          console.log(`[Page] Adding to display: ${result.domain} (displayed: ${displayedCountRef.current}/${TARGET_DISPLAY})`);

          // Only add to displayed domains if under target
          if (displayedCountRef.current < TARGET_DISPLAY) {
            displayedCountRef.current++;
            const newResult: DomainResult = {
              domain: result.domain,
              available: true,
              premium: result.premium,
              aftermarket: result.aftermarket,
              error: result.error,
            };
            setDomains((prev) => {
              console.log(`[Page] setDomains called, prev length: ${prev.length}`);
              return [...prev, newResult];
            });
          }
        }
      });

      console.log(`[Timing] All whois checks: ${(performance.now() - whoisStart).toFixed(0)}ms for ${allDomains.length} domains`);
      console.log(`[Results] Found ${availableResults.length} available domains`);

      // Store leftovers (available domains beyond what we displayed)
      const currentDisplayed = displayedCountRef.current;
      const newLeftovers = availableResults.slice(currentDisplayed);
      if (newLeftovers.length > 0) {
        setLeftoverDomains((prev) => [...prev, ...newLeftovers]);
        console.log(`[Leftovers] Stored ${newLeftovers.length} domains for Load More`);
      }

    } catch (error) {
      console.error('Generation failed:', error);
      alert('Failed to generate domains. Please check your Gemini API key.');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedTlds, hasGenerated, lastPrompt]);

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
    setLeftoverDomains([]);
    displayedCountRef.current = 0;
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
      // Use leftovers first
      const toShow = leftoverDomains.slice(0, TARGET_DISPLAY);
      const remaining = leftoverDomains.slice(TARGET_DISPLAY);

      // Add to displayed domains
      setDomains((prev) => [...prev, ...toShow]);
      displayedCountRef.current += toShow.length;
      setLeftoverDomains(remaining);

      console.log(`[Load More] Showed ${toShow.length} from leftovers, ${remaining.length} remaining`);

      // If we showed less than target and need more, generate more
      if (toShow.length < TARGET_DISPLAY) {
        handleGenerate('', true);
      }
    } else {
      // No leftovers, generate more
      handleGenerate('', true);
    }
  }, [leftoverDomains, handleGenerate]);

  // Count available domains for display
  const availableCount = domains.length;

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
                <span>Finding available domains... ({availableCount}/{TARGET_DISPLAY})</span>
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

          {/* Load More button */}
          {domains.length > 0 && !isGenerating && (
            <div className="text-center mt-12">
              <button
                onClick={handleLoadMore}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
              >
                Load More{leftoverDomains.length > 0 ? ` (${leftoverDomains.length} ready)` : ''}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
