import { NextResponse } from 'next/server';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

interface GeminiResponse {
  candidates: {
    content: {
      parts: {
        text: string;
      }[];
    };
  }[];
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Gemini API key not configured' },
      { status: 500 }
    );
  }

  try {
    const { count = 20 } = await request.json();

    const prompt = `Generate ${count} unique, creative, and memorable domain names (without the TLD extension).

Requirements:
- Names should be short (4-12 characters)
- Mix of made-up words, combinations, and creative spellings
- Should be easy to type and remember
- Include a variety of styles: tech-sounding, modern, catchy, professional
- No hyphens or numbers
- All lowercase

Return ONLY the domain names, one per line, with no explanations, numbering, or other text.`;

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 1.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to generate domain names' },
        { status: 500 }
      );
    }

    const data: GeminiResponse = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      return NextResponse.json(
        { error: 'No response from Gemini' },
        { status: 500 }
      );
    }

    const text = data.candidates[0].content.parts[0].text;

    // Parse the response
    const domainNames = text
      .split('\n')
      .map((line) => line.trim().toLowerCase())
      .filter((line) => {
        if (!line) return false;
        if (line.includes(' ')) return false;
        if (line.includes('.')) return false;
        if (!/^[a-z]+$/.test(line)) return false;
        if (line.length < 3 || line.length > 15) return false;
        return true;
      });

    return NextResponse.json({ domains: domainNames });
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate domain names' },
      { status: 500 }
    );
  }
}
