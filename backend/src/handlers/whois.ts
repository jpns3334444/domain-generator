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

// Get cached domain from DynamoDB with fast timeout
async function getCachedDomain(domain: string): Promise<CachedDomain | null> {
  try {
    const command = new GetItemCommand({
      TableName: DOMAINS_TABLE,
      Key: {
        domain: { S: domain.toLowerCase() },
      },
    });

    // Race against a 300ms timeout - if DynamoDB is slow, skip cache
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 300));
    const result = await Promise.race([
      dynamodb.send(command),
      timeoutPromise,
    ]);

    if (result === null) {
      console.log(`[Timing] ${domain}: cache lookup timed out (>300ms), skipping`);
      return null;
    }

    if (result.Item) {
      return {
        domain: result.Item.domain?.S || domain,
        available: result.Item.available?.BOOL ?? false,
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

// Fast DNS check with timeout - if no NS records, domain is likely available
async function checkDns(domain: string): Promise<'available' | 'taken' | 'unknown'> {
  const start = Date.now();
  try {
    // Race DNS against 1 second timeout (reduced from 2s - DNS should be fast)
    const timeoutPromise = new Promise<'unknown'>((resolve) =>
      setTimeout(() => resolve('unknown'), 1000)
    );
    const dnsPromise = resolveNs(domain).then(() => 'taken' as const);

    const result = await Promise.race([dnsPromise, timeoutPromise]);
    console.log(`[Timing] ${domain}: DNS ${result} in ${Date.now() - start}ms`);
    return result;
  } catch (error: unknown) {
    const err = error as { code?: string };
    const elapsed = Date.now() - start;
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      // No NS records - might be available, need to confirm with RDAP
      console.log(`[Timing] ${domain}: DNS unknown (${err.code}) in ${elapsed}ms`);
      return 'unknown';
    }
    // Other errors (timeout, etc) - treat as unknown
    console.log(`[Timing] ${domain}: DNS error (${err.code}) in ${elapsed}ms`);
    return 'unknown';
  }
}

// RDAP check for confirmation
async function checkRdap(domain: string, tld: string): Promise<DomainResult> {
  const start = Date.now();
  const rdapServer = RDAP_SERVERS[tld];

  if (!rdapServer) {
    // Fallback: if no RDAP server, rely on DNS result
    console.log(`[Timing] ${domain}: RDAP skipped (unsupported TLD) in ${Date.now() - start}ms`);
    return {
      domain,
      available: false,
      error: 'RDAP not supported for this TLD',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${rdapServer}${domain}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/rdap+json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const elapsed = Date.now() - start;

    if (response.status === 404) {
      // 404 = domain not found = available
      console.log(`[Timing] ${domain}: RDAP available (404) in ${elapsed}ms`);
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

      console.log(`[Timing] ${domain}: RDAP taken (200) in ${elapsed}ms`);
      return {
        domain,
        available: false,
        premium: isPremium,
      };
    }

    // Other status codes - treat as taken (conservative)
    console.log(`[Timing] ${domain}: RDAP taken (${response.status}) in ${elapsed}ms`);
    return {
      domain,
      available: false,
    };
  } catch (error: unknown) {
    const elapsed = Date.now() - start;
    const err = error as { name?: string; message?: string };
    if (err.name === 'AbortError') {
      console.log(`[Timing] ${domain}: RDAP timeout in ${elapsed}ms`);
      return {
        domain,
        available: false,
        error: 'RDAP timeout',
      };
    }
    console.log(`[Timing] ${domain}: RDAP error (${err.message}) in ${elapsed}ms`);
    return {
      domain,
      available: false,
      error: `RDAP error: ${err.message}`,
    };
  }
}

// Combined WHOIS check (DNS + RDAP in parallel, with short-circuit on DNS taken)
async function checkWhois(domain: string, tld: string): Promise<DomainResult> {
  const start = Date.now();

  // Start both checks in parallel
  const dnsPromise = checkDns(domain);
  const rdapPromise = checkRdap(domain, tld);

  // Wait for DNS first - if taken, we can return early without waiting for RDAP
  const dnsResult = await dnsPromise;
  if (dnsResult === 'taken') {
    console.log(`[Timing] ${domain}: WHOIS short-circuit (DNS taken) in ${Date.now() - start}ms`);
    return { domain, available: false };
  }

  // DNS inconclusive, wait for RDAP result
  const rdapResult = await rdapPromise;
  console.log(`[Timing] ${domain}: WHOIS complete (DNS=${dnsResult}, RDAP=${rdapResult.available}) in ${Date.now() - start}ms`);
  return rdapResult;
}

// Check domain with optimistic cache
async function checkDomainWithCache(domain: string, tld: string): Promise<DomainResult> {
  const start = Date.now();

  // Try cache first (100ms timeout, non-blocking on miss)
  const cached = await getCachedDomain(domain);
  if (cached) {
    console.log(`[Timing] ${domain}: cache HIT in ${Date.now() - start}ms`);
    // Fire background refresh (don't await)
    checkWhois(domain, tld).then(result => {
      if (result.available !== cached.available) {
        cacheDomainResult(domain, result.available);
      }
    }).catch(() => {});
    return { domain, available: cached.available };
  }

  // Cache miss - do whois check
  const whoisStart = Date.now();
  const whoisResult = await checkWhois(domain, tld);
  console.log(`[Timing] ${domain}: cache MISS, whois took ${Date.now() - whoisStart}ms (available: ${whoisResult.available})`);

  // Cache result (don't await)
  cacheDomainResult(domain, whoisResult.available).catch(() => {});
  return whoisResult;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;

// Single domain handler (GET /whois?domain=example.com)
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {

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

const MAX_BATCH_SIZE = 50;

// Batch domain handler (POST /whois/batch)
export const batchHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let domains: string[];
  try {
    const body = JSON.parse(event.body || '{}');
    domains = body.domains;

    if (!Array.isArray(domains) || domains.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing or empty domains array' }),
      };
    }

    if (domains.length > MAX_BATCH_SIZE) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Maximum ${MAX_BATCH_SIZE} domains per batch` }),
      };
    }
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  // Validate all domains
  const invalidDomains = domains.filter((d) => !domainRegex.test(d));
  if (invalidDomains.length > 0) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Invalid domain format',
        invalidDomains: invalidDomains.slice(0, 5), // Show first 5
      }),
    };
  }

  // Check all domains in parallel
  const results = await Promise.all(
    domains.map(async (domain) => {
      const parts = domain.split('.');
      const tld = parts[parts.length - 1].toLowerCase();
      try {
        return await checkDomainWithCache(domain, tld);
      } catch (error) {
        return {
          domain,
          available: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ results }),
  };
};
