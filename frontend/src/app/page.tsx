'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import SearchBar from '@/components/SearchBar';
import TldSelector from '@/components/TldSelector';
import DomainList, { DomainResult } from '@/components/DomainList';
import ThinkingPanel from '@/components/ThinkingPanel';
import { generateDomainNames } from '@/lib/gemini';
import { streamDomainGeneration } from '@/lib/gemini-stream';
import { checkDomainsBatch } from '@/lib/whois';
import { saveDomain, getSavedDomains, removeDomain } from '@/lib/preferences';
import { ConversationMessage } from '@/types/conversation';

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
const GENERATION_BUFFER = 0; // Generate more when reserve drops below this (roughly one Load More worth)

export default function Home() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [domains, setDomains] = useState<DomainResult[]>([]); // ALL domains, flat array
  const [selectedTlds, setSelectedTlds] = useState<string[]>(['com']);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [primaryDomain, setPrimaryDomain] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState(DOMAINS_PER_LOAD); // How many available+pending to show

  // Thinking state
  const [thinkingText, setThinkingText] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  // Feedback/Steering state
  const [feedbackInput, setFeedbackInput] = useState('');
  const [likedDomains, setLikedDomains] = useState<Set<string>>(new Set());
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);

  // Saved domains state
  const [savedDomains, setSavedDomains] = useState<Set<string>>(new Set());

  // Load saved domains on mount
  useEffect(() => {
    async function loadSavedDomains() {
      const saved = await getSavedDomains();
      setSavedDomains(new Set(saved.map(s => s.domain)));
    }
    loadSavedDomains();
  }, []);

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

  // Handle streaming generation with thinking display
  const handleGenerateStream = useCallback(async (prompt: string, feedback?: string) => {
    console.log(`[GenerateStream] === Streaming Generation Started ===`);

    setIsGenerating(true);
    setIsThinking(true);
    setHasGenerated(true);
    setThinkingText('');

    // Always do a fresh load (clear existing domains)
    setDomains([]);
    setVisibleCount(DOMAINS_PER_LOAD);
    setPrimaryDomain(null);

    if (!feedback) {
      // New generation - also reset prompt and conversation
      setLastPrompt(prompt);
      setLikedDomains(new Set());
      setConversationHistory([]);
    }

    const collectedNames: string[] = [];
    const pendingChecks: string[] = [];

    try {
      for await (const event of streamDomainGeneration({
        prompt: feedback ? lastPrompt : prompt,
        count: GENERATE_COUNT,
        feedback,
        likedDomains: Array.from(likedDomains),
        conversationHistory,
      })) {
        if (event.type === 'thinking') {
          setThinkingText(event.content || '');
        } else if (event.type === 'domain' && event.name) {
          collectedNames.push(event.name);

          // Create domain entries for all TLDs
          for (const tld of selectedTlds) {
            const fullDomain = `${event.name}.${tld}`;
            pendingChecks.push(fullDomain);

            // Add to domains state immediately
            setDomains(prev => [...prev, { domain: fullDomain, available: null }]);

            // Set primary domain if this is the first one
            if (collectedNames.length === 1 && tld === selectedTlds[0]) {
              setPrimaryDomain(fullDomain);
            }
          }

          // Check availability in batches as names come in
          if (pendingChecks.length >= 10) {
            const batchToCheck = [...pendingChecks];
            pendingChecks.length = 0;

            checkDomainsBatch(batchToCheck).then(results => {
              setDomains(prev => prev.map(d => {
                const result = results.find(r => r.domain === d.domain);
                return result ? { ...d, ...result } : d;
              }));
            }).catch(console.error);
          }
        } else if (event.type === 'done') {
          setIsThinking(false);
        } else if (event.type === 'error') {
          console.error('Stream error:', event.error);
        }
      }

      // Check remaining pending domains
      if (pendingChecks.length > 0) {
        const results = await checkDomainsBatch(pendingChecks);
        setDomains(prev => prev.map(d => {
          const result = results.find(r => r.domain === d.domain);
          return result ? { ...d, ...result } : d;
        }));
      }

      // Update conversation history
      if (feedback) {
        setConversationHistory(prev => [
          ...prev.slice(-8), // Keep last 4 exchanges (8 messages)
          { role: 'user', content: feedback, timestamp: Date.now() },
          { role: 'model', content: `Generated: ${collectedNames.slice(0, 5).join(', ')}...`, timestamp: Date.now() },
        ]);
      } else {
        setConversationHistory([
          { role: 'user', content: prompt, timestamp: Date.now() },
          { role: 'model', content: `Generated: ${collectedNames.slice(0, 5).join(', ')}...`, timestamp: Date.now() },
        ]);
      }

    } catch (error) {
      console.error('Stream generation failed:', error);
      setIsThinking(false);
    } finally {
      setIsGenerating(false);
      setIsThinking(false);
    }
  }, [selectedTlds, lastPrompt, likedDomains, conversationHistory]);

  // Handle refinement with feedback
  const handleRefine = useCallback(() => {
    if (!feedbackInput.trim()) return;

    const feedback = feedbackInput;
    setFeedbackInput('');
    handleGenerateStream(lastPrompt, feedback);
  }, [feedbackInput, lastPrompt, handleGenerateStream]);

  // Handle save/unsave domain
  const handleSaveDomain = useCallback(async (domain: string) => {
    const isCurrentlySaved = savedDomains.has(domain);

    if (isCurrentlySaved) {
      // Unsave: remove from server and local state
      const success = await removeDomain(domain);
      if (success) {
        setSavedDomains(prev => {
          const next = new Set(prev);
          next.delete(domain);
          return next;
        });
        // Also remove from liked domains for steering
        setLikedDomains(prev => {
          const next = new Set(prev);
          next.delete(domain);
          return next;
        });
      }
    } else {
      // Save: add to server and local state
      const success = await saveDomain(domain);
      if (success) {
        setSavedDomains(prev => new Set(prev).add(domain));
        // Also add to liked domains for steering
        setLikedDomains(prev => new Set(prev).add(domain));
      }
    }
  }, [savedDomains]);

  // Handle removing a liked domain (without affecting saved status)
  const handleRemoveLiked = useCallback((domain: string) => {
    setLikedDomains(prev => {
      const next = new Set(prev);
      next.delete(domain);
      return next;
    });
  }, []);


  return (
    <div className="min-h-screen bg-background">
      <span className="hidden">Impact-Site-Verification: 664bdf39-f63c-4758-82b9-3a5adfcc8ca0</span>

      {/* Hero Section - centered before generation */}
      {!hasGenerated && (
        <div className="flex flex-col items-center justify-center min-h-screen">
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
          <SearchBar
            onGenerate={handleGenerateStream}
            onSearch={handleSearch}
            isGenerating={isGenerating}
            compact={false}
          />
          <div className="mt-6">
            <TldSelector
              selectedTlds={selectedTlds}
              onTldChange={setSelectedTlds}
            />
          </div>
        </div>
      )}

      {/* Compact header - top left after generation */}
      {hasGenerated && (
        <div className="px-12 pt-6 pb-4">
          <SearchBar
            onGenerate={handleGenerateStream}
            onSearch={handleSearch}
            isGenerating={isGenerating}
            compact={true}
            tldSelector={
              <TldSelector
                selectedTlds={selectedTlds}
                onTldChange={setSelectedTlds}
                compact={true}
              />
            }
          />
        </div>
      )}

      {/* Results Section */}
      {hasGenerated && (
        <div className="pb-12">
          {/* Thinking Panel - shows AI interpretation and refine input */}
          {(isThinking || thinkingText || primaryDomain || (!isGenerating && domains.length > 0)) && (
            <ThinkingPanel
              thinkingText={thinkingText}
              isThinking={isThinking}
              primaryDomain={primaryDomain}
              feedbackValue={feedbackInput}
              onFeedbackChange={setFeedbackInput}
              onRefine={handleRefine}
              disabled={isGenerating}
              likedDomains={Array.from(likedDomains)}
              onRemoveLiked={handleRemoveLiked}
              showFeedback={!isGenerating && domains.length > 0}
            />
          )}

          <DomainList
            domains={visibleDomains}
            unavailableDomains={unavailableDomains}
            isLoading={isGenerating}
            onSaveDomain={handleSaveDomain}
            savedDomains={savedDomains}
            showSaveButton={true}
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
