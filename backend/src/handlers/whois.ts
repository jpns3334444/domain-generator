import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import * as dns from 'dns';
import { promisify } from 'util';

const resolveNs = promisify(dns.resolveNs);

const dynamodb = new DynamoDBClient({});
const DOMAINS_TABLE = process.env.DOMAINS_TABLE || 'domain-generator-domains';

// RDAP servers for different TLDs
const RDAP_SERVERS: Record<string, string> = {
  com: 'https://rdap.verisign.com/com/v1/domain/',
  net: 'https://rdap.verisign.com/net/v1/domain/',
  org: 'https://rdap.publicinterestregistry.org/rdap/domain/',
  io: 'https://rdap.nic.io/domain/',
  ai: 'https://rdap.nic.ai/domain/',
  dev: 'https://rdap.nic.google/domain/',
  app: 'https://rdap.nic.google/domain/',
  co: 'https://rdap.nic.co/domain/',
  xyz: 'https://rdap.nic.xyz/domain/',
  tech: 'https://rdap.nic.tech/domain/',
};

interface DomainResult {
  domain: string;
  available: boolean;
  premium?: boolean;
  aftermarket?: boolean;
  error?: string;
}

interface CachedDomain {
  domain: string;
  available: boolean;
}

// Get cached domain from DynamoDB
async function getCachedDomain(domain: string): Promise<CachedDomain | null> {
  try {
    const command = new GetItemCommand({
      TableName: DOMAINS_TABLE,
      Key: {
        domain: { S: domain.toLowerCase() },
      },
    });
    const response = await dynamodb.send(command);

    if (response.Item) {
      return {
        domain: response.Item.domain?.S || domain,
        available: response.Item.available?.BOOL ?? false,
      };
    }
    return null;
  } catch (error) {
    console.error('Cache lookup error:', error);
    return null;
  }
}

// Store domain result in DynamoDB cache
async function cacheDomainResult(domain: string, available: boolean): Promise<void> {
  try {
    const command = new PutItemCommand({
      TableName: DOMAINS_TABLE,
      Item: {
        domain: { S: domain.toLowerCase() },
        available: { BOOL: available },
      },
    });
    await dynamodb.send(command);
  } catch (error) {
    console.error('Cache write error:', error);
    // Non-fatal - continue without caching
  }
}

// Fast DNS check - if no NS records, domain is likely available
async function checkDns(domain: string): Promise<'available' | 'taken' | 'unknown'> {
  try {
    await resolveNs(domain);
    // Has NS records = definitely taken
    return 'taken';
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      // No NS records - might be available, need to confirm with RDAP
      return 'unknown';
    }
    // Other errors (timeout, etc) - treat as unknown
    return 'unknown';
  }
}

// RDAP check for confirmation
async function checkRdap(domain: string, tld: string): Promise<DomainResult> {
  const rdapServer = RDAP_SERVERS[tld];

  if (!rdapServer) {
    // Fallback: if no RDAP server, rely on DNS result
    return {
      domain,
      available: false,
      error: 'RDAP not supported for this TLD',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${rdapServer}${domain}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/rdap+json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 404) {
      // 404 = domain not found = available
      return {
        domain,
        available: true,
      };
    }

    if (response.ok) {
      // Domain exists in registry
      const data = await response.json() as { status?: string[] };

      // Check for premium/reserved status
      const status = data.status || [];
      const isPremium = status.some((s: string) =>
        s.includes('premium') || s.includes('reserved')
      );

      return {
        domain,
        available: false,
        premium: isPremium,
      };
    }

    // Other status codes - treat as taken (conservative)
    return {
      domain,
      available: false,
    };
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === 'AbortError') {
      return {
        domain,
        available: false,
        error: 'RDAP timeout',
      };
    }
    return {
      domain,
      available: false,
      error: `RDAP error: ${err.message}`,
    };
  }
}

// Combined WHOIS check (DNS + RDAP)
async function checkWhois(domain: string, tld: string): Promise<DomainResult> {
  const dnsResult = await checkDns(domain);

  if (dnsResult === 'taken') {
    return {
      domain,
      available: false,
    };
  }

  return checkRdap(domain, tld);
}

// Check domain with parallel cache lookup
async function checkDomainWithCache(domain: string, tld: string): Promise<DomainResult> {
  const [cachedResult, whoisResult] = await Promise.all([
    getCachedDomain(domain),
    checkWhois(domain, tld),
  ]);

  // Update cache if it differs or is missing (fire-and-forget)
  if (!cachedResult || cachedResult.available !== whoisResult.available) {
    cacheDomainResult(domain, whoisResult.available);
  }

  return whoisResult;
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

  try {
    const result = await checkDomainWithCache(domain, tld);

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
