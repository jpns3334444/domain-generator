import { NextResponse } from 'next/server';

const PROMPTS_API_URL = process.env.NEXT_PUBLIC_WHOIS_API_URL?.replace('/whois', '/prompts') || '';

export async function GET() {
  if (!PROMPTS_API_URL) {
    // Fallback prompts for development
    const fallbacks = [
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
    ];
    return NextResponse.json({
      prompt: fallbacks[Math.floor(Math.random() * fallbacks.length)],
    });
  }

  try {
    const response = await fetch(PROMPTS_API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch prompt');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching prompt:', error);
    return NextResponse.json({
      prompt: 'random business name',
    });
  }
}
