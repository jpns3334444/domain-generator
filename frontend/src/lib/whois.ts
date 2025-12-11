export interface WhoisResult {
  domain: string;
  available: boolean;
  premium?: boolean;
  aftermarket?: boolean;
  status?: string;
  error?: string;
}

const WHOIS_API_URL = process.env.NEXT_PUBLIC_WHOIS_API_URL || '';
const WHOIS_BATCH_API_URL = WHOIS_API_URL ? `${WHOIS_API_URL}/batch` : '';

export async function checkDomainAvailability(domain: string): Promise<WhoisResult> {
  if (!WHOIS_API_URL) {
    // Fallback: simulate response for development without backend
    console.warn('WHOIS API URL not configured, using mock response');
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));
    const available = Math.random() > 0.5; // 50% chance of being available
    return {
      domain,
      available,
      premium: !available && Math.random() > 0.8, // 20% of taken are premium
      aftermarket: !available && Math.random() > 0.9, // 10% of taken are aftermarket
    };
  }

  try {
    const response = await fetch(`${WHOIS_API_URL}?domain=${encodeURIComponent(domain)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Domain API error: ${response.status} - ${errorText}`);
    }

    const data: WhoisResult = await response.json();
    return data;
  } catch (error) {
    return {
      domain,
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Batch size for batch API calls
const BATCH_SIZE = 30;

// Concurrency for parallel batch requests
const CONCURRENCY = 25;

// Concurrency limit for individual domain checks (AWS Lambda account limit is 10)
const INDIVIDUAL_CONCURRENCY = 8;

// Check multiple domains with concurrency limiting (streams results as they complete)
export async function checkDomainsWithLimit(
  domains: string[],
  onResult: (result: WhoisResult) => void
): Promise<void> {
  const queue = [...domains];
  const inFlight: Promise<void>[] = [];

  while (queue.length > 0 || inFlight.length > 0) {
    // Fill up to INDIVIDUAL_CONCURRENCY
    while (inFlight.length < INDIVIDUAL_CONCURRENCY && queue.length > 0) {
      const domain = queue.shift()!;
      const promise = checkDomainAvailability(domain)
        .then(onResult)
        .catch((error) => {
          onResult({
            domain,
            available: false,
            error: error instanceof Error ? error.message : 'Check failed',
          });
        });
      inFlight.push(promise);
    }

    // Wait for at least one to complete
    if (inFlight.length > 0) {
      await Promise.race(inFlight);
      // Remove completed promises
      for (let i = inFlight.length - 1; i >= 0; i--) {
        const status = await Promise.race([
          inFlight[i].then(() => 'done'),
          Promise.resolve('pending'),
        ]);
        if (status === 'done') {
          inFlight.splice(i, 1);
        }
      }
    }
  }
}

// Check domains using hybrid approach: individual for quick feedback + batch for efficiency
export async function checkDomainsHybrid(
  domains: string[],
  onResult: (result: WhoisResult) => void,
  individualCount: number = 5,
  maxBatchSize: number = 40
): Promise<void> {
  console.log(`[Hybrid] Starting check for ${domains.length} domains`);

  // Split domains: first few for individual streaming, rest for sequential batches
  const individualDomains = domains.slice(0, individualCount);
  const batchDomains = domains.slice(individualCount);

  // Split batch domains into chunks
  const batches: string[][] = [];
  for (let i = 0; i < batchDomains.length; i += maxBatchSize) {
    batches.push(batchDomains.slice(i, i + maxBatchSize));
  }

  console.log(`[Hybrid] ${individualDomains.length} individual + ${batches.length} batches (${batches.map(b => b.length).join(', ')} domains each)`);

  // Run individual checks (streaming) - these appear first for quick feedback
  const individualPromise = checkDomainsWithLimit(individualDomains, (result) => {
    console.log(`[Individual] ${result.domain}: ${result.available ? 'available' : 'taken'}`);
    onResult(result);
  });

  // Run batch checks SEQUENTIALLY to avoid Lambda throttling (account limit is 10)
  const batchPromise = (async () => {
    for (let idx = 0; idx < batches.length; idx++) {
      const batch = batches[idx];
      try {
        const results = await checkDomainsBatch(batch);
        console.log(`[Batch ${idx}] Completed with ${results.length} results`);
        results.forEach(onResult);
      } catch (error) {
        console.error(`[Batch ${idx}] Failed:`, error);
        // On batch failure, report error for each domain
        batch.forEach(domain => {
          onResult({
            domain,
            available: false,
            error: error instanceof Error ? error.message : 'Batch check failed',
          });
        });
      }
    }
  })();

  // Wait for both individual and batch to complete
  await Promise.all([individualPromise, batchPromise]);
  console.log(`[Hybrid] All checks complete`);
}

// Check multiple domains via batch API
export async function checkDomainsBatch(domains: string[]): Promise<WhoisResult[]> {
  if (!WHOIS_BATCH_API_URL) {
    // Fallback: simulate responses for development
    console.warn('WHOIS Batch API URL not configured, using mock responses');
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));
    return domains.map((domain) => {
      const available = Math.random() > 0.5;
      return {
        domain,
        available,
        premium: !available && Math.random() > 0.8,
        aftermarket: !available && Math.random() > 0.9,
      };
    });
  }

  try {
    const response = await fetch(WHOIS_BATCH_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Batch API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.results as WhoisResult[];
  } catch (error) {
    // Fallback to individual errors
    return domains.map((domain) => ({
      domain,
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
  }
}

export async function checkDomainsParallel(
  domains: string[],
  onResult: (result: WhoisResult) => void
): Promise<void> {
  // Split domains into batches
  const batches: string[][] = [];
  for (let i = 0; i < domains.length; i += BATCH_SIZE) {
    batches.push(domains.slice(i, i + BATCH_SIZE));
  }

  // Process batches with concurrency limit
  const queue = [...batches];
  const inProgress: Promise<void>[] = [];

  while (queue.length > 0 || inProgress.length > 0) {
    // Start new batch requests up to concurrency limit
    while (inProgress.length < CONCURRENCY && queue.length > 0) {
      const batch = queue.shift()!;
      const promise = checkDomainsBatch(batch)
        .then((results) => {
          results.forEach(onResult);
        })
        .catch((error) => {
          // On batch failure, report error for each domain in batch
          batch.forEach((domain) => {
            onResult({
              domain,
              available: false,
              error: error.message,
            });
          });
        });

      inProgress.push(promise);
    }

    // Wait for at least one to complete
    if (inProgress.length > 0) {
      await Promise.race(inProgress);
      // Remove completed promises
      for (let i = inProgress.length - 1; i >= 0; i--) {
        const status = await Promise.race([
          inProgress[i].then(() => 'fulfilled'),
          Promise.resolve('pending'),
        ]);
        if (status === 'fulfilled') {
          inProgress.splice(i, 1);
        }
      }
    }
  }
}

// Legacy function for compatibility
export async function checkMultipleDomains(
  baseName: string,
  tlds: string[],
  onResult: (result: WhoisResult) => void
): Promise<void> {
  const domains = tlds.map((tld) => `${baseName}.${tld}`);
  return checkDomainsParallel(domains, onResult);
}
