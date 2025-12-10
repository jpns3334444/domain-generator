export async function generateDomainNames(count: number = 20): Promise<string[]> {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ count }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate domain names');
  }

  const data = await response.json();
  return data.domains;
}
