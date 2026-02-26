import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSync } from '../contexts/sync-context';
import { Colors } from '../constants/colors';
import { ThemedText } from './themed-text';

interface SyncStatusProps {
  showLabel?: boolean;
  onPress?: () => void;
}

export function SyncStatus({ showLabel = true, onPress }: SyncStatusProps) {
  const { isOnline, isSyncing, pendingChangesCount, sync } = useSync();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (isOnline && !isSyncing) {
      sync();
    }
  };

  const getStatusIcon = () => {
    if (isSyncing) {
      return 'sync';
    }
    if (!isOnline) {
      return 'cloud-offline';
    }
    if (pendingChangesCount > 0) {
      return 'cloud-upload';
    }
    return 'cloud-done';
  };

  const getStatusColor = () => {
    if (isSyncing) {
      return Colors.blue;
    }
    if (!isOnline) {
      return '#EF4444';
    }
    if (pendingChangesCount > 0) {
      return '#F59E0B';
    }
    return '#10B981';
  };

  const getStatusText = () => {
    if (isSyncing) {
      return 'Syncing...';
    }
    if (!isOnline) {
      return 'Offline';
    }
    if (pendingChangesCount > 0) {
      return `${pendingChangesCount} pending`;
    }
    return 'Synced';
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      disabled={isSyncing}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${getStatusColor()}20` }]}>
        <Ionicons name={getStatusIcon() as any} size={16} color={getStatusColor()} />
      </View>
      {showLabel && (
        <ThemedText style={[styles.label, { color: getStatusColor() }]}>
          {getStatusText()}
        </ThemedText>
      )}
      {pendingChangesCount > 0 && (
        <View style={styles.badge}>
          <ThemedText style={styles.badgeText}>{pendingChangesCount}</ThemedText>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000',
  },
});
