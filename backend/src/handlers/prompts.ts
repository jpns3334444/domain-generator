import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, ScanCommand, PutItemCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { randomUUID } from 'crypto';

const dynamodb = new DynamoDBClient({});
const PROMPTS_TABLE = process.env.PROMPTS_TABLE || 'domain-generator-prompts';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const PROMPT_THRESHOLD = 500;

interface GeminiResponse {
  candidates: {
    content: {
      parts: {
        text: string;
      }[];
    };
  }[];
}

async function getPromptCount(): Promise<number> {
  try {
    const command = new DescribeTableCommand({ TableName: PROMPTS_TABLE });
    const response = await dynamodb.send(command);
    return response.Table?.ItemCount || 0;
  } catch (error) {
    console.error('Error getting prompt count:', error);
    return 0;
  }
}

async function getRandomPromptFromDB(): Promise<string | null> {
  try {
    // Scan with a limit and random start
    const command = new ScanCommand({
      TableName: PROMPTS_TABLE,
      Limit: 100,
    });
    const response = await dynamodb.send(command);

    if (response.Items && response.Items.length > 0) {
      const randomIndex = Math.floor(Math.random() * response.Items.length);
      return response.Items[randomIndex].prompt?.S || null;
    }
    return null;
  } catch (error) {
    console.error('Error getting random prompt from DB:', error);
    return null;
  }
}

async function generatePromptsFromGemini(): Promise<string[]> {
  if (!GEMINI_API_KEY) {
    console.error('Gemini API key not configured');
    return [];
  }

  const prompt = `Generate 10 unique, short prompts that someone might type when looking for a domain name for their business. These should be 3-6 words each.

Examples of good prompts:
- "real estate agency"
- "fitness app startup"
- "two words like redfin"
- "coffee shop brand"
- "tech consulting firm"
- "creative word mashup"
- "short and memorable"
- "photography portfolio"
- "online learning platform"
- "eco friendly products"

Return ONLY the prompts, one per line, with no numbering, explanations, or other text.`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 1.5,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 512,
        },
      }),
    });

    if (!response.ok) {
      console.error('Gemini API error:', await response.text());
      return [];
    }

    const data = await response.json() as GeminiResponse;
    if (!data.candidates || data.candidates.length === 0) {
      return [];
    }

    const text = data.candidates[0].content.parts[0].text;
    const prompts = text
      .split('\n')
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line && line.length > 2 && line.length < 50);

    return prompts;
  } catch (error) {
    console.error('Error generating prompts from Gemini:', error);
    return [];
  }
}

async function storePromptsInDB(prompts: string[]): Promise<void> {
  for (const prompt of prompts) {
    try {
      const command = new PutItemCommand({
        TableName: PROMPTS_TABLE,
        Item: {
          id: { S: randomUUID() },
          prompt: { S: prompt },
          createdAt: { S: new Date().toISOString() },
        },
      });
      await dynamodb.send(command);
    } catch (error) {
      console.error('Error storing prompt:', error);
    }
  }
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    const promptCount = await getPromptCount();
    let selectedPrompt: string | null = null;

    if (promptCount >= PROMPT_THRESHOLD) {
      // 90% chance to use existing prompt, 10% chance to generate new
      const shouldGenerateNew = Math.random() < 0.1;

      if (shouldGenerateNew) {
        const newPrompts = await generatePromptsFromGemini();
        if (newPrompts.length > 0) {
          // Store all generated prompts
          await storePromptsInDB(newPrompts);
          // Return one of the new prompts
          selectedPrompt = newPrompts[Math.floor(Math.random() * newPrompts.length)];
        }
      }

      // If we didn't generate new or generation failed, get from DB
      if (!selectedPrompt) {
        selectedPrompt = await getRandomPromptFromDB();
      }
    } else {
      // Under threshold - always generate new prompts
      const newPrompts = await generatePromptsFromGemini();
      if (newPrompts.length > 0) {
        await storePromptsInDB(newPrompts);
        selectedPrompt = newPrompts[Math.floor(Math.random() * newPrompts.length)];
      } else {
        // Fallback to DB if generation fails
        selectedPrompt = await getRandomPromptFromDB();
      }
    }

    // Final fallback
    if (!selectedPrompt) {
      const fallbacks = [
        'real estate company',
        'tech startup',
        'fitness brand',
        'creative agency',
        'online store',
      ];
      selectedPrompt = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        prompt: selectedPrompt,
        totalPrompts: promptCount,
      }),
    };
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get prompt' }),
    };
  }
};
