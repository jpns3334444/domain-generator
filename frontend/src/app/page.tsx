'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import SearchBar from '@/components/SearchBar';
import TldSelector from '@/components/TldSelector';
import DomainList, { DomainResult } from '@/components/DomainList';
import { generateDomainNames } from '@/lib/gemini';
import { checkDomainAvailability } from '@/lib/whois';

const DotLottiePlayer = dynamic(
  () => import('@dotlottie/react-player').then((mod) => mod.DotLottiePlayer),
  { ssr: false }
);

export default function Home() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [domains, setDomains] = useState<DomainResult[]>([]);
  const [selectedTlds, setSelectedTlds] = useState<string[]>(['com']);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [primaryDomain, setPrimaryDomain] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string>('');

  const handleGenerate = useCallback(async (prompt: string, append: boolean = false) => {
    setIsGenerating(true);
    const isFirstGeneration = !hasGenerated;
    setHasGenerated(true);

    // Store the prompt for "Load More" functionality (only on fresh generation)
    if (!append) {
      setLastPrompt(prompt);
      setDomains([]);
      setPrimaryDomain(null);
    }

    // Use stored prompt when appending, otherwise use provided prompt
    const activePrompt = append ? lastPrompt : prompt;

    try {
      // Generate domain names using Gemini
      const generatedNames = await generateDomainNames(15, activePrompt);

      if ((isFirstGeneration || !append) && generatedNames.length > 0) {
        setPrimaryDomain(`${generatedNames[0]}.com`);
      }

      // Create domain entries for each name + TLD combination
      const newDomains: DomainResult[] = [];
      for (const name of generatedNames) {
        for (const tld of selectedTlds) {
          newDomains.push({
            domain: `${name}.${tld}`,
            available: null, // Loading state
          });
        }
      }

      // Append new domains to existing ones
      setDomains((prev) => [...prev, ...newDomains]);

      // Check availability for each domain
      for (const domainResult of newDomains) {
        try {
          const result = await checkDomainAvailability(domainResult.domain);
          setDomains((prev) =>
            prev.map((d) =>
              d.domain === result.domain
                ? { ...d, available: result.available, error: result.error }
                : d
            )
          );
        } catch (error) {
          setDomains((prev) =>
            prev.map((d) =>
              d.domain === domainResult.domain
                ? { ...d, available: false, error: 'Check failed' }
                : d
            )
          );
        }
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
    const isFirstSearch = !hasGenerated;
    setHasGenerated(true);

    // Clean the base name (remove any TLD if user included it)
    const cleanName = baseName.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!cleanName) {
      setIsGenerating(false);
      return;
    }

    if (isFirstSearch) {
      setPrimaryDomain(`${cleanName}.${selectedTlds[0] || 'com'}`);
    }

    // Create domain entries for each selected TLD
    const newDomains: DomainResult[] = selectedTlds.map((tld) => ({
      domain: `${cleanName}.${tld}`,
      available: null,
    }));

    // Append new domains
    setDomains((prev) => [...prev, ...newDomains]);

    // Check availability for each domain
    for (const domainResult of newDomains) {
      try {
        const result = await checkDomainAvailability(domainResult.domain);
        setDomains((prev) =>
          prev.map((d) =>
            d.domain === result.domain
              ? { ...d, available: result.available, error: result.error }
              : d
          )
        );
      } catch (error) {
        setDomains((prev) =>
          prev.map((d) =>
            d.domain === domainResult.domain
              ? { ...d, available: false, error: 'Check failed' }
              : d
          )
        );
      }
    }

    setIsGenerating(false);
  }, [selectedTlds, hasGenerated]);

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div className={`flex flex-col items-center justify-center ${hasGenerated ? 'pt-8 pb-4' : 'min-h-screen'}`}>
        {!hasGenerated && (
          <>
            <div className="w-96 h-96 mb-2">
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
                <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <span>Generating domain names with AI...</span>
              </div>
            </div>
          )}

          {/* Primary domain display */}
          {primaryDomain && (
            <div className="max-w-6xl mx-auto px-4 mb-8">
              <h2 className="text-4xl md:text-5xl font-bold text-green-500 mb-4">
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
                onClick={() => handleGenerate('', true)}
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
