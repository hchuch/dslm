import * as SecureStore from 'expo-secure-store';
import {
  bulkImportData,
  clearPendingChanges,
  deleteCTB,
  deleteItem,
  getClientId,
  getLastSyncTime,
  getLastSyncVersion,
  getPendingChanges,
  getPendingChangesCount,
  setLastSyncTime,
  setLastSyncVersion,
  type PendingChange,
} from './local-db';

import { getApiBaseUrl, getApiBaseUrlSync } from './api-config';

export interface SyncResult {
  success: boolean;
  syncedChanges: number;
  pulledChanges: number;
  currentVersion: number;
  errors: string[];
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingChangesCount: number;
  lastSyncVersion: number;
  lastError: string | null;
}

let syncStatus: SyncStatus = {
  isOnline: true,
  isSyncing: false,
  lastSyncTime: null,
  pendingChangesCount: 0,
  lastSyncVersion: 0,
  lastError: null,
};

let statusListeners: Array<(status: SyncStatus) => void> = [];
let dataChangeListeners: Array<() => void> = [];

export function addSyncStatusListener(listener: (status: SyncStatus) => void): () => void {
  statusListeners.push(listener);
  listener(syncStatus); // Notify immediately with current status
  return () => {
    statusListeners = statusListeners.filter((l) => l !== listener);
  };
}

/**
 * Register a callback that fires when sync pulls new data from the server.
 * Used by InventoryProvider to reload UI state after remote changes arrive.
 */
export function addDataChangeListener(listener: () => void): () => void {
  dataChangeListeners.push(listener);
  return () => {
    dataChangeListeners = dataChangeListeners.filter((l) => l !== listener);
  };
}

function notifyDataChanged(): void {
  dataChangeListeners.forEach((listener) => listener());
}

function notifyStatusChange(): void {
  statusListeners.forEach((listener) => listener(syncStatus));
}

function updateStatus(updates: Partial<SyncStatus>): void {
  syncStatus = { ...syncStatus, ...updates };
  notifyStatusChange();
}

export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

async function getAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync('authToken');
  } catch {
    return null;
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${getApiBaseUrlSync()}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Check if the server is reachable
 */
export async function checkOnlineStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBaseUrlSync()}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const isOnline = response.ok;
    updateStatus({ isOnline, lastError: isOnline ? null : 'Server unreachable' });
    return isOnline;
  } catch (error) {
    updateStatus({ isOnline: false, lastError: 'Network error' });
    return false;
  }
}

/**
 * Perform a full sync (initial sync or recovery)
 */
export async function fullSync(): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    syncedChanges: 0,
    pulledChanges: 0,
    currentVersion: 0,
    errors: [],
  };

  updateStatus({ isSyncing: true });

  try {
    // First, push any pending changes
    const pushResult = await pushChanges();
    result.syncedChanges = pushResult.syncedChanges;
    result.errors.push(...pushResult.errors);

    // Then pull all data from server
    const data = await apiRequest<{
      categories: any[];
      stacks: any[];
      ctbs: any[];
      items: any[];
      historyEntries: any[];
      currentVersion: number;
    }>('/api/sync/full');

    await bulkImportData(data);
    await setLastSyncVersion(data.currentVersion);
    await setLastSyncTime(new Date());

    // Notify listeners that new data has arrived from full sync
    notifyDataChanged();

    result.pulledChanges = (data.ctbs?.length || 0) + (data.items?.length || 0);
    result.currentVersion = data.currentVersion;
    result.success = true;

    updateStatus({
      isSyncing: false,
      lastSyncTime: new Date(),
      lastSyncVersion: data.currentVersion,
      pendingChangesCount: 0,
      lastError: null,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Full sync failed';
    result.errors.push(errorMessage);
    updateStatus({
      isSyncing: false,
      lastError: errorMessage,
    });
  }

  return result;
}

/**
 * Pull changes from server since last sync version
 */
export async function pullChanges(): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    syncedChanges: 0,
    pulledChanges: 0,
    currentVersion: 0,
    errors: [],
  };

  try {
    const lastVersion = await getLastSyncVersion();

    const data = await apiRequest<{
      changes: Array<{
        tableName: string;
        recordId: string;
        operation: string;
        changeData: Record<string, unknown>;
        syncVersion: number;
      }>;
      currentVersion: number;
    }>(`/api/sync/changes?since=${lastVersion}`);

    if (data.changes.length > 0) {
      // Apply changes to local database
      for (const change of data.changes) {
        await applyServerChange(change);
        result.pulledChanges++;
      }

      // Notify listeners that new data has arrived
      notifyDataChanged();
    }

    await setLastSyncVersion(data.currentVersion);
    await setLastSyncTime(new Date());

    result.currentVersion = data.currentVersion;
    result.success = true;

    updateStatus({
      lastSyncTime: new Date(),
      lastSyncVersion: data.currentVersion,
      lastError: null,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Pull changes failed';
    result.errors.push(errorMessage);
    updateStatus({ lastError: errorMessage });
  }

  return result;
}

/**
 * Push pending local changes to server
 */
export async function pushChanges(): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    syncedChanges: 0,
    pulledChanges: 0,
    currentVersion: 0,
    errors: [],
  };

  try {
    const pendingChanges = await getPendingChanges();

    if (pendingChanges.length === 0) {
      result.success = true;
      return result;
    }

    const clientId = await getClientId();

    const response = await apiRequest<{
      results: Array<{
        success: boolean;
        localId: string;
        serverId?: string;
        error?: string;
      }>;
      currentVersion: number;
    }>('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({
        clientId,
        changes: pendingChanges.map((change) => ({
          tableName: change.tableName,
          operation: change.operation,
          localId: change.recordId,
          data: change.data,
        })),
      }),
    });

    // Process results
    const successfulIds: number[] = [];

    for (let i = 0; i < response.results.length; i++) {
      const res = response.results[i];
      const change = pendingChanges[i];

      if (res.success) {
        successfulIds.push(change.id);
        result.syncedChanges++;
      } else if (res.error) {
        result.errors.push(`${change.tableName}/${change.recordId}: ${res.error}`);
      }
    }

    // Clear successfully synced changes
    if (successfulIds.length > 0) {
      await clearPendingChanges(successfulIds);
    }

    await setLastSyncVersion(response.currentVersion);
    result.currentVersion = response.currentVersion;
    result.success = result.errors.length === 0;

    const pendingCount = await getPendingChangesCount();
    updateStatus({
      pendingChangesCount: pendingCount,
      lastSyncVersion: response.currentVersion,
      lastError: result.errors.length > 0 ? result.errors[0] : null,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Push changes failed';
    result.errors.push(errorMessage);
    updateStatus({ lastError: errorMessage });
  }

  return result;
}

/**
 * Perform incremental sync (push + pull)
 */
export async function sync(): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    syncedChanges: 0,
    pulledChanges: 0,
    currentVersion: 0,
    errors: [],
  };

  // Check if already syncing
  if (syncStatus.isSyncing) {
    result.errors.push('Sync already in progress');
    return result;
  }

  // Check online status
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    result.errors.push('Offline - sync skipped');
    return result;
  }

  updateStatus({ isSyncing: true });

  try {
    // Push first, then pull
    const pushResult = await pushChanges();
    result.syncedChanges = pushResult.syncedChanges;
    result.errors.push(...pushResult.errors);

    const pullResult = await pullChanges();
    result.pulledChanges = pullResult.pulledChanges;
    result.currentVersion = pullResult.currentVersion;
    result.errors.push(...pullResult.errors);

    result.success = pushResult.success && pullResult.success;
  } finally {
    updateStatus({ isSyncing: false });
  }

  return result;
}

/**
 * Apply a change from the server to local database
 */
async function applyServerChange(change: {
  tableName: string;
  recordId: string;
  operation: string;
  changeData: Record<string, unknown>;
}): Promise<void> {
  switch (change.tableName) {
    case 'Category':
      if (change.operation === 'delete') {
        // Soft delete handled by import
      } else {
        await bulkImportData({ categories: [change.changeData] });
      }
      break;

    case 'CTB':
      if (change.operation === 'delete') {
        await deleteCTB(change.recordId);
      } else {
        await bulkImportData({ ctbs: [change.changeData] });
      }
      break;

    case 'InventoryItem':
      if (change.operation === 'delete') {
        await deleteItem(change.recordId);
      } else {
        await bulkImportData({ items: [change.changeData] });
      }
      break;

    case 'ItemHistoryEntry':
      await bulkImportData({ historyEntries: [change.changeData] });
      break;
  }
}

/**
 * Initialize sync service and update status
 */
export async function initializeSyncService(): Promise<void> {
  try {
    // Ensure API URL is loaded from SecureStore before any network calls
    await getApiBaseUrl();

    const [pendingCount, lastVersion, lastTime] = await Promise.all([
      getPendingChangesCount(),
      getLastSyncVersion(),
      getLastSyncTime(),
    ]);

    updateStatus({
      pendingChangesCount: pendingCount,
      lastSyncVersion: lastVersion,
      lastSyncTime: lastTime,
    });

    // Check online status
    await checkOnlineStatus();
  } catch (error) {
    console.error('Failed to initialize sync service:', error);
  }
}

/**
 * Start polling for changes
 */
let pollInterval: ReturnType<typeof setInterval> | null = null;

export function startSyncPolling(intervalMs: number = 30000): void {
  stopSyncPolling();

  // Start polling for incremental changes
  pollInterval = setInterval(async () => {
    if (syncStatus.isOnline && !syncStatus.isSyncing) {
      await sync();
    }
  }, intervalMs);
}

export function stopSyncPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

/**
 * Force push any pending changes (call when making local changes)
 */
export async function pushIfOnline(): Promise<void> {
  const pendingCount = await getPendingChangesCount();
  updateStatus({ pendingChangesCount: pendingCount });

  if (syncStatus.isOnline && pendingCount > 0) {
    await pushChanges();
  }
}
