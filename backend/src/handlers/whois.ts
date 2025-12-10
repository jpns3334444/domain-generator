import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

interface DomainrStatusResponse {
  status: Array<{
    domain: string;
    zone: string;
    status: string;
    summary?: string;
  }>;
}

interface DomainResult {
  domain: string;
  available: boolean;
  premium?: boolean;
  aftermarket?: boolean;
  status?: string;
  error?: string;
}

// Parse Domainr status string into our format
function parseStatus(statusString: string): { available: boolean; premium: boolean; aftermarket: boolean } {
  const statuses = statusString.split(' ');

  // Check for availability - 'inactive' or 'undelegated' means available
  const available = statuses.includes('inactive') || statuses.includes('undelegated');

  // Check for premium pricing
  const premium = statuses.includes('premium');

  // Check for aftermarket/for sale
  const aftermarket = statuses.includes('priced') || statuses.includes('marketed');

  return { available, premium, aftermarket };
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

  const domain = event.queryStringParameters?.domain;

  if (!domain) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing domain parameter' }),
    };
  }

  // Validate domain format
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
  if (!domainRegex.test(domain)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid domain format' }),
    };
  }

  const rapidApiKey = process.env.RAPIDAPI_KEY;

  if (!rapidApiKey) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'RAPIDAPI_KEY not configured' }),
    };
  }

  try {
    const response = await fetch(
      `https://domainr.p.rapidapi.com/v2/status?domain=${encodeURIComponent(domain)}`,
      {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': 'domainr.p.rapidapi.com',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Domainr API error: ${response.status}`);
    }

    const data: DomainrStatusResponse = await response.json();

    if (!data.status || data.status.length === 0) {
      throw new Error('No status returned from Domainr');
    }

    const domainStatus = data.status[0];
    const { available, premium, aftermarket } = parseStatus(domainStatus.status);

    const result: DomainResult = {
      domain: domainStatus.domain,
      available,
      premium,
      aftermarket,
      status: domainStatus.status,
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        domain,
        available: false,
        error: `Domain lookup failed: ${errorMessage}`,
      }),
    };
  }
};
