import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as net from 'net';

// WHOIS servers for different TLDs
const WHOIS_SERVERS: Record<string, string> = {
  com: 'whois.verisign-grs.com',
  net: 'whois.verisign-grs.com',
  org: 'whois.pir.org',
  io: 'whois.nic.io',
  ai: 'whois.nic.ai',
  dev: 'whois.nic.google',
  app: 'whois.nic.google',
  co: 'whois.nic.co',
  xyz: 'whois.nic.xyz',
  tech: 'whois.nic.tech',
};

interface WhoisResult {
  domain: string;
  available: boolean;
  raw?: string;
  error?: string;
}

async function queryWhois(domain: string, server: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let data = '';

    socket.setTimeout(10000);

    socket.connect(43, server, () => {
      socket.write(`${domain}\r\n`);
    });

    socket.on('data', (chunk) => {
      data += chunk.toString();
    });

    socket.on('end', () => {
      resolve(data);
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('WHOIS query timed out'));
    });

    socket.on('error', (err) => {
      reject(err);
    });
  });
}

function parseAvailability(whoisResponse: string, tld: string): boolean {
  const response = whoisResponse.toLowerCase();

  // Common patterns indicating domain is NOT registered (i.e., available)
  const availablePatterns = [
    'no match for',
    'not found',
    'no data found',
    'no entries found',
    'domain not found',
    'status: free',
    'status: available',
    'no object found',
    'object does not exist',
  ];

  // Check if any available pattern matches
  for (const pattern of availablePatterns) {
    if (response.includes(pattern)) {
      return true;
    }
  }

  // If we got a response with registration info, it's taken
  const takenPatterns = [
    'domain name:',
    'registrar:',
    'creation date:',
    'registry domain id:',
    'updated date:',
  ];

  for (const pattern of takenPatterns) {
    if (response.includes(pattern)) {
      return false;
    }
  }

  // Default to unavailable if we can't determine
  return false;
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

  // Extract TLD
  const parts = domain.split('.');
  const tld = parts[parts.length - 1].toLowerCase();
  const whoisServer = WHOIS_SERVERS[tld];

  if (!whoisServer) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: `Unsupported TLD: .${tld}` }),
    };
  }

  try {
    const whoisResponse = await queryWhois(domain, whoisServer);
    const available = parseAvailability(whoisResponse, tld);

    const result: WhoisResult = {
      domain,
      available,
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
        error: `WHOIS lookup failed: ${errorMessage}`,
      }),
    };
  }
};
