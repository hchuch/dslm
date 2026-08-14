import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSync } from '../contexts/sync-context';
import { Colors } from '../constants/colors';
import { ThemedText } from './themed-text';

export function OfflineBanner() {
  const { isOnline, isSyncing, lastSyncTime, pendingChangesCount, sync, checkOnline } = useSync();
  const [, setTick] = useState(0);

  // Re-render every 30s so "last sync" timer stays accurate
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  if (isOnline && pendingChangesCount === 0) {
    return null;
  }

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never synced';
    const diff = Date.now() - lastSyncTime.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (seconds < 30) return 'just now';
    if (minutes < 1) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return lastSyncTime.toLocaleDateString();
  };

  if (!isOnline) {
    return (
      <Pressable
        style={[styles.banner, styles.offlineBanner]}
        onPress={checkOnline}
      >
        <Ionicons name="cloud-offline" size={14} color="#EF4444" />
        <ThemedText style={styles.offlineText}>Offline</ThemedText>
        {pendingChangesCount > 0 && (
          <ThemedText style={styles.pendingCountText}>
            {pendingChangesCount} change{pendingChangesCount !== 1 ? 's' : ''} queued
          </ThemedText>
        )}
        <ThemedText style={styles.subtext}>{formatLastSync()}</ThemedText>
      </Pressable>
    );
  }

  if (pendingChangesCount > 0 && !isSyncing) {
    return (
      <Pressable style={[styles.banner, styles.pendingBanner]} onPress={sync}>
        <Ionicons name="cloud-upload" size={14} color="#F59E0B" />
        <ThemedText style={styles.pendingText}>{pendingChangesCount} pending</ThemedText>
        <ThemedText style={styles.tapText}>Tap to sync</ThemedText>
      </Pressable>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  offlineBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 68, 68, 0.25)',
  },
  syncingBanner: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(59, 130, 246, 0.25)',
  },
  pendingBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.25)',
  },
  offlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  syncingText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.blue,
  },
  pendingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F59E0B',
  },
  pendingCountText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '500',
  },
  subtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 'auto',
  },
  tapText: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginLeft: 'auto',
  },
});
