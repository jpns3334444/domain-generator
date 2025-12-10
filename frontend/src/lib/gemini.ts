const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

interface GeminiResponse {
  candidates: {
    content: {
      parts: {
        text: string;
      }[];
    };
  }[];
}

export async function generateDomainNames(count: number = 20): Promise<string[]> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

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
        temperature: 1.2, // Higher temperature for more creative/random results
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data: GeminiResponse = await response.json();

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('No response from Gemini');
  }

  const text = data.candidates[0].content.parts[0].text;

  // Parse the response - split by newlines and clean up
  const domainNames = text
    .split('\n')
    .map((line) => line.trim().toLowerCase())
    .filter((line) => {
      // Filter out empty lines and invalid names
      if (!line) return false;
      if (line.includes(' ')) return false;
      if (line.includes('.')) return false; // Remove any accidental TLDs
      if (!/^[a-z]+$/.test(line)) return false; // Only letters
      if (line.length < 3 || line.length > 15) return false;
      return true;
    });

  return domainNames;
}
