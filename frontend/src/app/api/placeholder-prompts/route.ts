import { NextResponse } from 'next/server';

// Get the prompts API URL - must be called inside handler, not at module level
// Module-level env vars can be empty on cold starts in serverless environments
function getPromptsApiUrl(): string {
  const whoisUrl = process.env.NEXT_PUBLIC_WHOIS_API_URL || '';
  // Strip /whois (and any suffix) then append /prompts
  const baseUrl = whoisUrl.replace(/\/whois(\/.*)?$/, '');
  return baseUrl ? `${baseUrl}/prompts` : '';
}

// Fallback prompts for when API is unavailable
const FALLBACK_PROMPTS = [
  'real estate company',
  'tech startup',
  'fitness brand',
  'creative agency',
  'online store',
  'coffee shop',
  'consulting firm',
  'photography studio',
  'two words like redfin',
  'short and catchy',
  'ai software tool',
  'fashion boutique',
  'food delivery app',
  'home services',
  'pet care business',
  'travel booking site',
  'healthcare platform',
  'education startup',
  'fintech company',
  'gaming studio',
];

export async function GET() {
  // Get URL fresh on each request (not at module level)
  const promptsApiUrl = getPromptsApiUrl();

  // Try the AWS Lambda endpoint first
  if (promptsApiUrl) {
    try {
      const response = await fetch(promptsApiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Don't cache, we want fresh prompts
      });

      if (response.ok) {
        const data = await response.json();
        if (data.prompt && data.prompt !== 'random business name') {
          return NextResponse.json(data);
        }
      }
    } catch (error) {
      console.error('Error fetching from Lambda:', error);
    }
  }

  // Fallback to local prompts
  const randomPrompt = FALLBACK_PROMPTS[Math.floor(Math.random() * FALLBACK_PROMPTS.length)];
  return NextResponse.json({
    prompt: randomPrompt,
  });
}
