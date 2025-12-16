import { SavedDomain } from '@/types/conversation';

const USER_ID_KEY = 'domain-generator-user-id';

function generateUserId(): string {
  return 'user_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function getUserId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = generateUserId();
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_WHOIS_API_URL || '';
}

export async function saveDomain(domain: string): Promise<boolean> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    console.warn('WHOIS API URL not configured');
    return false;
  }

  const userId = getUserId();
  if (!userId) return false;

  try {
    const response = await fetch(`${apiUrl}/preferences/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      },
      body: JSON.stringify({ domain }),
    });

    if (!response.ok) {
      console.error('Failed to save domain:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error saving domain:', error);
    return false;
  }
}

export async function getSavedDomains(): Promise<SavedDomain[]> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    console.warn('WHOIS API URL not configured');
    return [];
  }

  const userId = getUserId();
  if (!userId) return [];

  try {
    const response = await fetch(`${apiUrl}/preferences`, {
      method: 'GET',
      headers: {
        'X-User-Id': userId,
      },
    });

    if (!response.ok) {
      console.error('Failed to get saved domains:', await response.text());
      return [];
    }

    const data = await response.json();
    return data.domains || [];
  } catch (error) {
    console.error('Error getting saved domains:', error);
    return [];
  }
}

export async function removeDomain(domain: string): Promise<boolean> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    console.warn('WHOIS API URL not configured');
    return false;
  }

  const userId = getUserId();
  if (!userId) return false;

  try {
    const response = await fetch(`${apiUrl}/preferences/${encodeURIComponent(domain)}`, {
      method: 'DELETE',
      headers: {
        'X-User-Id': userId,
      },
    });

    if (!response.ok) {
      console.error('Failed to remove domain:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error removing domain:', error);
    return false;
  }
}
