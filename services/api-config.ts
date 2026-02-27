import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'dslm_server_url';
const BUILD_TIME_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

let cachedUrl: string | null = null;

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

export async function setApiBaseUrl(url: string | null): Promise<void> {
  if (url) {
    const normalized = url.replace(/\/+$/, '');
    await SecureStore.setItemAsync(STORAGE_KEY, normalized);
    cachedUrl = normalized;
  } else {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    cachedUrl = BUILD_TIME_URL;
  }
}

export function getApiBaseUrlSync(): string {
  return cachedUrl || BUILD_TIME_URL;
}
