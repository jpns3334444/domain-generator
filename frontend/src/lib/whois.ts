export interface WhoisResult {
  domain: string;
  available: boolean;
  error?: string;
}

const WHOIS_API_URL = process.env.NEXT_PUBLIC_WHOIS_API_URL || '';

export async function checkDomainAvailability(domain: string): Promise<WhoisResult> {
  if (!WHOIS_API_URL) {
    // Fallback: simulate response for development without backend
    console.warn('WHOIS API URL not configured, using mock response');
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));
    return {
      domain,
      available: Math.random() > 0.7, // 30% chance of being available
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
      throw new Error(`WHOIS API error: ${response.status} - ${errorText}`);
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

export async function checkMultipleDomains(
  baseName: string,
  tlds: string[],
  onResult: (result: WhoisResult) => void
): Promise<void> {
  // Check domains in parallel with a concurrency limit
  const CONCURRENCY = 3;
  const domains = tlds.map((tld) => `${baseName}.${tld}`);

  const queue = [...domains];
  const inProgress: Promise<void>[] = [];

  while (queue.length > 0 || inProgress.length > 0) {
    // Start new requests up to concurrency limit
    while (inProgress.length < CONCURRENCY && queue.length > 0) {
      const domain = queue.shift()!;
      const promise = checkDomainAvailability(domain)
        .then(onResult)
        .catch((error) => {
          onResult({
            domain,
            available: false,
            error: error.message,
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
