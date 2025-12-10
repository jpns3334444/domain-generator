import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const dynamodb = new DynamoDBClient({});
const PROMPTS_TABLE = process.env.PROMPTS_TABLE || 'domain-generator-prompts';

const FALLBACK_PROMPTS = [
  'real estate company',
  'tech startup',
  'fitness brand',
  'creative agency',
  'online store',
];

async function getRandomPrompt(): Promise<string> {
  try {
    const command = new ScanCommand({
      TableName: PROMPTS_TABLE,
      Limit: 100,
    });
    const response = await dynamodb.send(command);

    if (response.Items && response.Items.length > 0) {
      const randomIndex = Math.floor(Math.random() * response.Items.length);
      return response.Items[randomIndex].prompt?.S || FALLBACK_PROMPTS[0];
    }
  } catch (error) {
    console.error('Error getting random prompt from DB:', error);
  }

  return FALLBACK_PROMPTS[Math.floor(Math.random() * FALLBACK_PROMPTS.length)];
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

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    const prompt = await getRandomPrompt();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ prompt }),
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
