import { NextRequest } from 'next/server';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent';

interface ConversationMessage {
  role: 'user' | 'model';
  content: string;
}

interface StreamRequest {
  count?: number;
  prompt?: string;
  feedback?: string;
  likedDomains?: string[];
  conversationHistory?: ConversationMessage[];
  existingNames?: string[];
}

function buildPrompt(request: StreamRequest): string {
  const { count = 20, prompt = '', feedback, likedDomains = [], existingNames = [] } = request;

  const avoidNamesText = existingNames.length > 0
    ? `\n\nIMPORTANT: Do NOT generate any of these names (already used): ${existingNames.slice(0, 100).join(', ')}`
    : '';

  // If there's feedback, build a steering prompt
  if (feedback) {
    const likedContext = likedDomains.length > 0
      ? `\n\nThe user liked these domain names: ${likedDomains.join(', ')}`
      : '';

    return `You are a creative domain name generator. The user previously asked for domain names${prompt ? ` related to "${prompt}"` : ''}.${likedContext}${avoidNamesText}

The user has provided this feedback: "${feedback}"

Based on this feedback, generate ${count} NEW domain names that better match what the user wants.

First, briefly explain (2-3 sentences on a single line starting with "THINKING:") how you interpret the feedback and your approach.

Then list the domain names, one per line, starting with "DOMAINS:" on its own line.

Requirements for domain names:
- Names should be short (4-12 characters)
- All lowercase, no hyphens or numbers
- Mix of made-up words, combinations, and creative spellings
- Easy to type and remember

Example format:
THINKING: Based on your feedback, I'll focus on shorter two-syllable names similar to "nexora" with a modern tech feel.
DOMAINS:
nexify
zyncro
cloudex`;
  }

  // Standard generation prompt
  if (prompt.trim()) {
    return `You are a creative domain name generator.${avoidNamesText}

Generate ${count} unique, creative, and memorable domain names (without the TLD extension) for a business related to: "${prompt}"

First, briefly explain (2-3 sentences on a single line starting with "THINKING:") how you interpret this request and your approach to generating names.

Then list the domain names, one per line, starting with "DOMAINS:" on its own line.

Requirements:
- Names should be short (4-12 characters)
- Names should be relevant to or evoke the theme: "${prompt}"
- Mix of made-up words, combinations, and creative spellings
- Should be easy to type and remember
- No hyphens or numbers
- All lowercase

Example format:
THINKING: For a tech startup, I'll focus on short, punchy names that sound innovative and modern.
DOMAINS:
nexify
cloudex
bytehub`;
  }

  // Random generation
  return `You are a creative domain name generator.${avoidNamesText}

Generate ${count} unique, creative, and memorable domain names (without the TLD extension).

First, briefly explain (2-3 sentences on a single line starting with "THINKING:") your approach to generating diverse, interesting names.

Then list the domain names, one per line, starting with "DOMAINS:" on its own line.

Requirements:
- Names should be short (4-12 characters)
- Mix of made-up words, combinations, and creative spellings
- Should be easy to type and remember
- Include a variety of styles: tech-sounding, modern, catchy, professional
- No hyphens or numbers
- All lowercase

Example format:
THINKING: I'll create a mix of coined words and creative combinations that work across different industries.
DOMAINS:
nexify
cloudex
bytehub`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Gemini API key not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: StreamRequest = await request.json();
    const prompt = buildPrompt(body);

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}&alt=sse`, {
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
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate domain names' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create a TransformStream to process Gemini's SSE and emit our own events
    const encoder = new TextEncoder();
    let buffer = '';
    let phase: 'thinking' | 'domains' | 'done' = 'thinking';
    let thinkingBuffer = '';
    let sentThinking = false;

    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        buffer += text;

        // Process complete SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;

            try {
              const data = JSON.parse(jsonStr);
              const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

              if (!content) continue;

              // Process the content based on phase
              const contentToProcess = content;

              for (const char of contentToProcess) {
                if (phase === 'thinking') {
                  thinkingBuffer += char;

                  // Check if we've hit the DOMAINS: marker
                  if (thinkingBuffer.includes('DOMAINS:')) {
                    // Extract thinking text (everything before DOMAINS:)
                    const thinkingText = thinkingBuffer.split('DOMAINS:')[0]
                      .replace(/^THINKING:\s*/i, '')
                      .trim();

                    if (thinkingText && !sentThinking) {
                      controller.enqueue(encoder.encode(
                        `data: ${JSON.stringify({ type: 'thinking', content: thinkingText })}\n\n`
                      ));
                      sentThinking = true;
                    }

                    phase = 'domains';
                    thinkingBuffer = thinkingBuffer.split('DOMAINS:')[1] || '';
                  }
                } else if (phase === 'domains') {
                  thinkingBuffer += char;

                  // Check for complete domain names (newline-separated)
                  if (char === '\n' || char === '\r') {
                    const domainName = thinkingBuffer.trim().toLowerCase();
                    thinkingBuffer = '';

                    // Validate domain name
                    if (domainName &&
                        /^[a-z]+$/.test(domainName) &&
                        domainName.length >= 3 &&
                        domainName.length <= 15 &&
                        !domainName.includes(' ') &&
                        !domainName.includes('.')) {
                      controller.enqueue(encoder.encode(
                        `data: ${JSON.stringify({ type: 'domain', name: domainName })}\n\n`
                      ));
                    }
                  }
                }
              }
            } catch {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      },
      flush(controller) {
        // Process any remaining content in buffer
        if (thinkingBuffer.trim()) {
          const domainName = thinkingBuffer.trim().toLowerCase();
          if (domainName &&
              /^[a-z]+$/.test(domainName) &&
              domainName.length >= 3 &&
              domainName.length <= 15) {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'domain', name: domainName })}\n\n`
            ));
          }
        }
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'done' })}\n\n`
        ));
      }
    });

    // Pipe Gemini's response through our transform
    const readable = response.body!.pipeThrough(transformStream);

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Stream generation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate domain names' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
