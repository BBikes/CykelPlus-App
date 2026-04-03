const DEFAULT_BASE_URL = 'https://api.c1st.com/api';

export function getBikedeskBaseUrl(): string {
  const configured = process.env.BIKEDESK_API_URL?.trim();
  if (!configured) return DEFAULT_BASE_URL;
  const normalized = configured.replace(/\/+$/, '');
  if (normalized.includes('app.bikedesk.dk') || normalized.endsWith('/api/v1')) {
    return DEFAULT_BASE_URL;
  }
  return normalized;
}

export function getBikedeskAuthHeaders(): Record<string, string> {
  const apiKey = process.env.BIKEDESK_API_KEY?.trim();
  if (!apiKey) throw new Error('BIKEDESK_API_KEY mangler');
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}
