import { NextResponse } from 'next/server';

// Construct prompts URL from the WHOIS URL
const WHOIS_URL = process.env.NEXT_PUBLIC_WHOIS_API_URL || '';
const PROMPTS_API_URL = WHOIS_URL ? WHOIS_URL.replace('/whois', '/prompts') : '';

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
  // Try the AWS Lambda endpoint first
  if (PROMPTS_API_URL) {
    try {
      const response = await fetch(PROMPTS_API_URL, {
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
