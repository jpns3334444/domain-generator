import { SavedDomain } from '@/types/conversation';

const FAVORITES_STORAGE_KEY = 'domain-generator-favorites';

// Get all saved domains from localStorage
export function getSavedDomains(): SavedDomain[] {
  if (typeof window === 'undefined') return [];

  const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as SavedDomain[];
  } catch {
    return [];
  }
}

// Save a domain to localStorage (returns updated list)
export function saveDomain(domain: string): SavedDomain[] {
  if (typeof window === 'undefined') return [];

  const current = getSavedDomains();

  // Prevent duplicates
  if (current.some(d => d.domain === domain)) {
    return current;
  }

  const updated = [...current, { domain, savedAt: Date.now() }];
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

// Remove a domain from localStorage (returns updated list)
export function removeDomain(domain: string): SavedDomain[] {
  if (typeof window === 'undefined') return [];

  const current = getSavedDomains();
  const updated = current.filter(d => d.domain !== domain);
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

// Check if a domain is saved
export function isDomainSaved(domain: string): boolean {
  return getSavedDomains().some(d => d.domain === domain);
}

// Get count of favorites (for badge)
export function getFavoritesCount(): number {
  return getSavedDomains().length;
}

// Export favorites as CSV string
export function exportFavoritesCSV(): string {
  const domains = getSavedDomains();
  const header = 'Domain,Saved At\n';
  const rows = domains.map(d =>
    `${d.domain},${new Date(d.savedAt).toISOString()}`
  ).join('\n');
  return header + rows;
}
