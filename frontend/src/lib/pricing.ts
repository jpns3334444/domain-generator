export interface PricingResult {
  domain: string;
  premium: boolean;
  premiumPrice?: number;
}

const WHOIS_API_URL = process.env.NEXT_PUBLIC_WHOIS_API_URL || '';
const PRICING_API_URL = WHOIS_API_URL ? WHOIS_API_URL.replace('/whois', '/pricing') : '';

export const AFFILIATE_ID = process.env.NEXT_PUBLIC_NAMECHEAP_AFFILIATE_ID || '';

// Format price for display
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

// Get affiliate URL for domain purchase
export function getAffiliateUrl(domain: string): string {
  const searchUrl = `https://www.namecheap.com/domains/registration/results.aspx?domain=${encodeURIComponent(domain)}`;

  if (AFFILIATE_ID) {
    // Impact Radius format for Namecheap
    return `https://namecheap.pxf.io/c/${AFFILIATE_ID}/386170/5618?u=${encodeURIComponent(searchUrl)}`;
  }
  return searchUrl;
}

// Batch check pricing for multiple domains
export async function checkPricingBatch(domains: string[]): Promise<PricingResult[]> {
  if (!PRICING_API_URL || domains.length === 0) {
    // No API configured or no domains - return non-premium for all
    return domains.map(d => ({ domain: d, premium: false }));
  }

  try {
    const response = await fetch(PRICING_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains }),
    });

    if (!response.ok) {
      console.warn('Pricing API error:', response.status);
      return domains.map(d => ({ domain: d, premium: false }));
    }

    const data = await response.json();
    return data.results as PricingResult[];
  } catch (error) {
    console.warn('Pricing check failed:', error);
    return domains.map(d => ({ domain: d, premium: false }));
  }
}
