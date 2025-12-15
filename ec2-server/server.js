const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Namecheap API credentials
const API_USER = 'aeller1';
const API_KEY = '414f64ea25a74423b0b1ca8aa0ea1a5a';
const CLIENT_IP = '34.206.220.243';

// Parse Namecheap XML response for domain availability
function parseNamecheapResponse(xml, requestedDomains) {
  const results = [];

  // Match each DomainCheckResult
  const domainPattern = /<DomainCheckResult\s+([^>]+)>/g;
  let match;

  while ((match = domainPattern.exec(xml)) !== null) {
    const attrs = match[1];

    // Extract attributes
    const domainMatch = attrs.match(/Domain="([^"]+)"/);
    const availableMatch = attrs.match(/Available="([^"]+)"/);
    const premiumMatch = attrs.match(/IsPremiumName="([^"]+)"/);
    const priceMatch = attrs.match(/PremiumRegistrationPrice="([^"]+)"/);

    if (domainMatch) {
      const domain = domainMatch[1].toLowerCase();
      const available = availableMatch ? availableMatch[1] === 'true' : false;
      const isPremium = premiumMatch ? premiumMatch[1] === 'true' : false;
      const price = priceMatch ? parseFloat(priceMatch[1]) : undefined;

      results.push({
        domain,
        available,
        premium: isPremium,
        premiumPrice: price
      });
    }
  }

  // Check for any domains not in response (API error case)
  for (const domain of requestedDomains) {
    const found = results.find(r => r.domain.toLowerCase() === domain.toLowerCase());
    if (!found) {
      results.push({
        domain: domain.toLowerCase(),
        available: false,
        error: 'Not in API response'
      });
    }
  }

  return results;
}

// Check for API errors in XML response
function checkApiError(xml) {
  const errorMatch = xml.match(/<Error[^>]*>([^<]+)<\/Error>/);
  if (errorMatch) {
    return errorMatch[1];
  }

  // Check Status attribute
  const statusMatch = xml.match(/Status="([^"]+)"/);
  if (statusMatch && statusMatch[1] === 'ERROR') {
    const errorsMatch = xml.match(/<Errors>([\s\S]*?)<\/Errors>/);
    if (errorsMatch) {
      const msgMatch = errorsMatch[1].match(/<Error[^>]*>([^<]+)<\/Error>/);
      return msgMatch ? msgMatch[1] : 'Unknown API error';
    }
    return 'API returned error status';
  }

  return null;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Single domain check (GET /whois?domain=example.com)
app.get('/whois', async (req, res) => {
  const domain = req.query.domain;

  if (!domain) {
    return res.status(400).json({ error: 'Missing domain parameter' });
  }

  try {
    const params = new URLSearchParams({
      ApiUser: API_USER,
      ApiKey: API_KEY,
      UserName: API_USER,
      Command: 'namecheap.domains.check',
      ClientIp: CLIENT_IP,
      DomainList: domain
    });

    const response = await fetch(`https://api.namecheap.com/xml.response?${params}`);
    const xml = await response.text();

    // Check for API errors
    const apiError = checkApiError(xml);
    if (apiError) {
      console.error('Namecheap API error:', apiError);
      return res.status(500).json({ domain, available: false, error: apiError });
    }

    const results = parseNamecheapResponse(xml, [domain]);
    const result = results.find(r => r.domain.toLowerCase() === domain.toLowerCase());

    res.json(result || { domain, available: false, error: 'Domain not found in response' });
  } catch (error) {
    console.error('Error checking domain:', error);
    res.status(500).json({ domain, available: false, error: error.message });
  }
});

// Batch domain check (POST /whois/batch)
app.post('/whois/batch', async (req, res) => {
  const { domains } = req.body;

  if (!Array.isArray(domains) || domains.length === 0) {
    return res.status(400).json({ error: 'Missing or empty domains array' });
  }

  if (domains.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 domains per batch' });
  }

  try {
    const params = new URLSearchParams({
      ApiUser: API_USER,
      ApiKey: API_KEY,
      UserName: API_USER,
      Command: 'namecheap.domains.check',
      ClientIp: CLIENT_IP,
      DomainList: domains.join(',')
    });

    console.log(`[Batch] Checking ${domains.length} domains...`);
    const start = Date.now();

    const response = await fetch(`https://api.namecheap.com/xml.response?${params}`);
    const xml = await response.text();

    console.log(`[Batch] API response in ${Date.now() - start}ms`);

    // Check for API errors
    const apiError = checkApiError(xml);
    if (apiError) {
      console.error('Namecheap API error:', apiError);
      return res.status(500).json({
        error: apiError,
        results: domains.map(d => ({ domain: d, available: false, error: apiError }))
      });
    }

    const results = parseNamecheapResponse(xml, domains);

    console.log(`[Batch] Returning ${results.length} results`);
    res.json({ results });
  } catch (error) {
    console.error('Error checking domains:', error);
    res.status(500).json({
      error: error.message,
      results: domains.map(d => ({ domain: d, available: false, error: error.message }))
    });
  }
});

// Pricing endpoint (POST /pricing) - same as batch but focuses on pricing info
app.post('/pricing', async (req, res) => {
  const { domains } = req.body;

  if (!Array.isArray(domains) || domains.length === 0) {
    return res.status(400).json({ error: 'Missing or empty domains array' });
  }

  if (domains.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 domains per batch' });
  }

  try {
    const params = new URLSearchParams({
      ApiUser: API_USER,
      ApiKey: API_KEY,
      UserName: API_USER,
      Command: 'namecheap.domains.check',
      ClientIp: CLIENT_IP,
      DomainList: domains.join(',')
    });

    const response = await fetch(`https://api.namecheap.com/xml.response?${params}`);
    const xml = await response.text();

    // Check for API errors
    const apiError = checkApiError(xml);
    if (apiError) {
      console.error('Namecheap API error:', apiError);
      return res.json({
        results: domains.map(d => ({ domain: d, premium: false }))
      });
    }

    const results = parseNamecheapResponse(xml, domains);

    // Return pricing-focused response
    res.json({
      results: results.map(r => ({
        domain: r.domain,
        premium: r.premium || false,
        premiumPrice: r.premiumPrice
      }))
    });
  } catch (error) {
    console.error('Error checking pricing:', error);
    res.json({
      results: domains.map(d => ({ domain: d, premium: false }))
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Namecheap API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
