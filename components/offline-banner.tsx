import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSync } from '../contexts/sync-context';
import { Colors } from '../constants/colors';
import { ThemedText } from './themed-text';

export function OfflineBanner() {
  const { isOnline, isSyncing, lastSyncTime } = useSync();

  if (isOnline && !isSyncing) {
    return null;
  }

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never synced';
    const now = new Date();
    const diff = now.getTime() - lastSyncTime.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Last sync: just now';
    if (minutes < 60) return `Last sync: ${minutes}m ago`;
    if (hours < 24) return `Last sync: ${hours}h ago`;
    return `Last sync: ${lastSyncTime.toLocaleDateString()}`;
  };

  if (isSyncing) {
    return (
      <View style={[styles.banner, styles.syncingBanner]}>
        <View style={styles.content}>
          <View style={styles.syncingIndicator}>
            <View style={styles.syncingDot} />
          </View>
          <ThemedText style={styles.text}>Syncing...</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.banner, styles.offlineBanner]}>
      <View style={styles.content}>
        <View style={styles.offlineIndicator}>
          <View style={styles.offlineDot} />
        </View>
        <View>
          <ThemedText style={styles.text}>Offline Mode</ThemedText>
          <ThemedText style={styles.subtext}>{formatLastSync()}</ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  offlineBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 68, 68, 0.3)',
  },
  syncingBanner: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(59, 130, 246, 0.3)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  offlineIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  syncingIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.blue,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  subtext: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
