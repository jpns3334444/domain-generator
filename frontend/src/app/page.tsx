'use client';

import { useState, useCallback } from 'react';
import SearchBar from '@/components/SearchBar';
import TldSelector from '@/components/TldSelector';
import DomainList, { DomainResult } from '@/components/DomainList';
import { generateDomainNames } from '@/lib/gemini';
import { checkDomainAvailability } from '@/lib/whois';

export default function Home() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [domains, setDomains] = useState<DomainResult[]>([]);
  const [selectedTlds, setSelectedTlds] = useState<string[]>(['com']);
  const [hasGenerated, setHasGenerated] = useState(false);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setDomains([]);
    setHasGenerated(true);

    try {
      // Generate domain names using Gemini
      const generatedNames = await generateDomainNames(15);

      // Create domain entries for each name + TLD combination
      const allDomains: DomainResult[] = [];
      for (const name of generatedNames) {
        for (const tld of selectedTlds) {
          allDomains.push({
            domain: `${name}.${tld}`,
            available: null, // Loading state
          });
        }
      }

      setDomains(allDomains);

      // Check availability for each domain
      for (const domainResult of allDomains) {
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
  }, [selectedTlds]);

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div className={`flex flex-col items-center justify-center ${hasGenerated ? 'pt-12 pb-8' : 'min-h-screen'}`}>
        {!hasGenerated && (
          <>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 text-center">
              Domain name search
            </h1>
            <p className="text-zinc-400 text-lg md:text-xl text-center max-w-2xl mb-12 px-4">
              The fastest domain search tool on the internet. Generate random domain names
              with AI and check availability instantly.
            </p>
          </>
        )}

        <SearchBar
          onGenerate={handleGenerate}
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
          {/* Subheading when generating */}
          {domains.length === 0 && isGenerating && (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-3 text-zinc-400">
                <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <span>Generating domain names with AI...</span>
              </div>
            </div>
          )}

          {/* Search millions tagline */}
          {domains.length > 0 && (
            <div className="text-center mb-8">
              <p className="text-purple-500 text-sm uppercase tracking-wider font-medium">
                AI-Generated Domain Names
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">
                Found {domains.length} possibilities
              </h2>
            </div>
          )}

          <DomainList domains={domains} isLoading={isGenerating} />

          {/* Generate more button */}
          {domains.length > 0 && !isGenerating && (
            <div className="text-center mt-12">
              <button
                onClick={handleGenerate}
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
              >
                Generate More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
