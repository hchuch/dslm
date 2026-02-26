import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'dslm_server_url';
const BUILD_TIME_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

let cachedUrl: string | null = null;

/**
 * Get the API base URL. Checks for a user-configured override first,
 * then falls back to the build-time EXPO_PUBLIC_API_URL, then localhost.
 */
export async function getApiBaseUrl(): Promise<string> {
  if (cachedUrl) return cachedUrl;

  try {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    if (stored) {
      cachedUrl = stored;
      return stored;
    }
  } catch {
    // SecureStore may fail in some environments
  }

  cachedUrl = BUILD_TIME_URL;
  return BUILD_TIME_URL;
}

/**
 * Set a custom server URL (persists across app restarts).
 * Pass null to reset to default.
 */
export async function setApiBaseUrl(url: string | null): Promise<void> {
  if (url) {
    // Normalize: remove trailing slash
    const normalized = url.replace(/\/+$/, '');
    await SecureStore.setItemAsync(STORAGE_KEY, normalized);
    cachedUrl = normalized;
  } else {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    cachedUrl = BUILD_TIME_URL;
  }
}

/**
 * Synchronous getter - returns cached value or build-time default.
 * Call getApiBaseUrl() at least once before using this.
 */
export function getApiBaseUrlSync(): string {
  return cachedUrl || BUILD_TIME_URL;
}
