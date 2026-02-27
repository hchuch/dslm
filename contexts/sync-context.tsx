import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  addSyncStatusListener,
  checkOnlineStatus,
  fullSync,
  getSyncStatus,
  initializeSyncService,
  pushIfOnline,
  startSyncPolling,
  stopSyncPolling,
  sync,
  type SyncStatus,
} from '../services/sync-service';
import { useAuth } from './auth-context';

interface SyncContextValue {
  // Status
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingChangesCount: number;
  lastError: string | null;

  // Actions
  sync: () => Promise<void>;
  fullSync: () => Promise<void>;
  checkOnline: () => Promise<boolean>;
  notifyChange: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const initialized = useRef(false);
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: true,
    isSyncing: false,
    lastSyncTime: null,
    pendingChangesCount: 0,
    lastSyncVersion: 0,
    lastError: null,
  });

  useEffect(() => {
    const unsubscribe = addSyncStatusListener(setStatus);
    return () => {
      unsubscribe();
      stopSyncPolling();
    };
  }, []);

  // Always fullSync first on auth to ensure local DB has all data before polling
  useEffect(() => {
    if (!isAuthenticated) return;

    (async () => {
      if (!initialized.current) {
        await initializeSyncService();
        initialized.current = true;
      }
      await fullSync();
      startSyncPolling(10000);
    })();

    return () => {
      stopSyncPolling();
    };
  }, [isAuthenticated]);

  const handleSync = useCallback(async () => {
    await sync();
  }, []);

  const handleFullSync = useCallback(async () => {
    await fullSync();
  }, []);

  const handleCheckOnline = useCallback(async () => {
    return checkOnlineStatus();
  }, []);

  const handleNotifyChange = useCallback(async () => {
    await pushIfOnline();
  }, []);

  const value: SyncContextValue = {
    isOnline: status.isOnline,
    isSyncing: status.isSyncing,
    lastSyncTime: status.lastSyncTime,
    pendingChangesCount: status.pendingChangesCount,
    lastError: status.lastError,
    sync: handleSync,
    fullSync: handleFullSync,
    checkOnline: handleCheckOnline,
    notifyChange: handleNotifyChange,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error('useSync must be used within SyncProvider');
  }
  return ctx;
}
