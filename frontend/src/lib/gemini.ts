export async function generateDomainNames(count: number = 20, prompt: string = ''): Promise<string[]> {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ count, prompt }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate domain names');
  }

  const data = await response.json();
  return data.domains;
}

// Parallel generation: start fast and full requests simultaneously
// Returns fast results immediately, full results as a promise
export async function generateDomainNamesParallel(
  fastCount: number,
  fullCount: number,
  prompt: string
): Promise<{ fast: string[]; fullPromise: Promise<string[]> }> {
  // Start both requests simultaneously
  const fastPromise = generateDomainNames(fastCount, prompt);
  const fullPromise = generateDomainNames(fullCount, prompt);

  // Wait for fast results, return full as promise
  const fast = await fastPromise;
  return { fast, fullPromise };
}
