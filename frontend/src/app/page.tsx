'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Heart } from 'lucide-react';
import SearchBar from '@/components/SearchBar';
import TldSelector from '@/components/TldSelector';
import DomainList, { DomainResult } from '@/components/DomainList';
import ThinkingPanel from '@/components/ThinkingPanel';
import FavoritesDrawer from '@/components/FavoritesDrawer';
import { generateDomainNames } from '@/lib/gemini';
import { streamDomainGeneration } from '@/lib/gemini-stream';
import { checkDomainsBatch } from '@/lib/whois';
import { saveDomain, getSavedDomains, removeDomain } from '@/lib/preferences';
import { ConversationMessage } from '@/types/conversation';
import { trackEvent, AnalyticsEvents } from '@/lib/analytics';

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

  // Favorites drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [favoritesCount, setFavoritesCount] = useState(0);

  // Load saved domains on mount
  useEffect(() => {
    const saved = getSavedDomains();
    setSavedDomains(new Set(saved.map(s => s.domain)));
    setFavoritesCount(saved.length);
  }, []);

  // Helper to scroll to bottom of page
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  }, []);

  const handleGenerate = useCallback(async (prompt: string, append: boolean = false) => {
    console.log(`[Generate] === Generation Started === (append: ${append})`);

    setIsGenerating(true);
    setHasGenerated(true);

    if (!append) {
      setLastPrompt(prompt);
      setDomains([]);
      setVisibleCount(DOMAINS_PER_LOAD);
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

    trackEvent(AnalyticsEvents.SEARCH_PERFORMED, {
      baseName: cleanName,
      selectedTlds,
    });

    if (!cleanName) {
      setIsGenerating(false);
      return;
    }

    // Clear previous results for search mode
    setDomains([]);
    setVisibleCount(DOMAINS_PER_LOAD);

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
    scrollToBottom();

    // Calculate reserve (what's left after showing)
    const reserve = availableOrPending.length - newVisibleCount;

    trackEvent(AnalyticsEvents.LOAD_MORE_CLICKED, {
      visibleCount: newVisibleCount,
      reserveCount: reserve,
    });
    const showing = Math.min(newVisibleCount, availableOrPending.length);
    const hidden = Math.max(0, availableOrPending.length - newVisibleCount);

    console.log(`[Load More] visibleCount: ${newVisibleCount}, showing: ${showing}, hidden: ${hidden}, unavailable: ${unavailableDomains.length}, reserve: ${reserve}`);

    // Only generate more if reserve drops below buffer
    if (reserve < GENERATION_BUFFER && !isGenerating && lastPrompt) {
      console.log(`[Load More] Reserve (${reserve}) < buffer (${GENERATION_BUFFER}), generating more...`);
      handleGenerate(lastPrompt, true);
    }
  }, [visibleCount, availableOrPending.length, unavailableDomains.length, isGenerating, lastPrompt, handleGenerate, scrollToBottom]);

  // Handle streaming generation with thinking display
  const handleGenerateStream = useCallback(async (prompt: string, feedback?: string) => {
    console.log(`[GenerateStream] === Streaming Generation Started ===`);
    const startTime = Date.now();

    trackEvent(AnalyticsEvents.GENERATION_STARTED, {
      prompt,
      selectedTlds,
      hasFeedback: !!feedback,
    });

    setIsGenerating(true);
    setIsThinking(true);
    setHasGenerated(true);
    setThinkingText('');
    scrollToBottom();

    // Always do a fresh load (clear existing domains)
    setDomains([]);
    setVisibleCount(DOMAINS_PER_LOAD);

    if (!feedback) {
      // New generation - also reset prompt and conversation
      setLastPrompt(prompt);
      setLikedDomains(new Set());
      setConversationHistory([]);
    }

    const collectedNames: string[] = [];
    const seenNames = new Set<string>();
    const pendingChecks: string[] = [];

    try {
      for await (const event of streamDomainGeneration({
        prompt: feedback ? lastPrompt : prompt,
        count: GENERATE_COUNT,
        feedback,
        likedDomains: Array.from(likedDomains),
        conversationHistory,
        existingNames: collectedNames,
      })) {
        if (event.type === 'thinking') {
          setThinkingText(event.content || '');
        } else if (event.type === 'domain' && event.name) {
          // Skip duplicates
          if (seenNames.has(event.name)) continue;
          seenNames.add(event.name);
          collectedNames.push(event.name);

          // Create domain entries for all TLDs
          for (const tld of selectedTlds) {
            const fullDomain = `${event.name}.${tld}`;
            pendingChecks.push(fullDomain);

            // Add to domains state immediately
            setDomains(prev => [...prev, { domain: fullDomain, available: null }]);
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

      // Track generation completion with metrics
      setDomains(currentDomains => {
        const availableCount = currentDomains.filter(d => d.available === true).length;
        trackEvent(AnalyticsEvents.GENERATION_COMPLETED, {
          domainCount: currentDomains.length,
          availableCount,
          durationMs: Date.now() - startTime,
        });
        return currentDomains;
      });
    }
  }, [selectedTlds, lastPrompt, likedDomains, conversationHistory, scrollToBottom]);

  // Handle refinement with feedback
  const handleRefine = useCallback(() => {
    if (!feedbackInput.trim()) return;

    trackEvent(AnalyticsEvents.FEEDBACK_SUBMITTED, {
      feedbackText: feedbackInput,
      likedDomainsCount: likedDomains.size,
    });

    const feedback = feedbackInput;
    setFeedbackInput('');
    handleGenerateStream(lastPrompt, feedback);
  }, [feedbackInput, lastPrompt, handleGenerateStream, likedDomains.size]);

  // Handle save/unsave domain
  const handleSaveDomain = useCallback((domain: string) => {
    const isCurrentlySaved = savedDomains.has(domain);

    trackEvent(AnalyticsEvents.DOMAIN_SAVED, {
      domain,
      isSaved: !isCurrentlySaved,
    });

    if (isCurrentlySaved) {
      // Unsave: remove from localStorage
      const updated = removeDomain(domain);
      setSavedDomains(new Set(updated.map(d => d.domain)));
      setFavoritesCount(updated.length);
      // Also remove from liked domains for steering
      setLikedDomains(prev => {
        const next = new Set(prev);
        next.delete(domain);
        return next;
      });
    } else {
      // Save: add to localStorage
      const updated = saveDomain(domain);
      setSavedDomains(new Set(updated.map(d => d.domain)));
      setFavoritesCount(updated.length);
      // Also add to liked domains for steering
      setLikedDomains(prev => new Set(prev).add(domain));
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

      {/* Header with favorites */}
      <header className="fixed top-0 right-0 p-4 z-30">
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="relative p-2 text-zinc-400 hover:text-ids-red transition-colors rounded-lg hover:bg-zinc-800/50"
          title="View favorites"
        >
          <Heart
            className={`w-6 h-6 ${favoritesCount > 0 ? 'text-ids-red' : ''}`}
            fill={favoritesCount > 0 ? 'currentColor' : 'none'}
          />
          {favoritesCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-ids-red text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
              {favoritesCount > 99 ? '99+' : favoritesCount}
            </span>
          )}
        </button>
      </header>

      {/* Favorites Drawer */}
      <FavoritesDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onFavoritesChange={(count) => {
          setFavoritesCount(count);
          // Also sync savedDomains set
          const saved = getSavedDomains();
          setSavedDomains(new Set(saved.map(s => s.domain)));
        }}
      />

      {/* Hero Section - always visible */}
      <div className="flex flex-col items-center justify-center pt-12 pb-8">
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

      {/* Results Section - appears below hero when generated */}
      {hasGenerated && (
        <div className="pb-12 px-12">
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

      {/* Floating AI Assistant Panel */}
      {hasGenerated && (isThinking || thinkingText || (!isGenerating && domains.length > 0)) && (
        <ThinkingPanel
          thinkingText={thinkingText}
          isThinking={isThinking}
          feedbackValue={feedbackInput}
          onFeedbackChange={setFeedbackInput}
          onRefine={handleRefine}
          disabled={isGenerating}
          likedDomains={Array.from(likedDomains)}
          onRemoveLiked={handleRemoveLiked}
          showFeedback={!isGenerating && domains.length > 0}
        />
      )}
    </div>
  );
}
