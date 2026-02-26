import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors } from '../constants/colors';
import { ThemedText } from './themed-text';

interface PendingBadgeProps {
  isPending?: boolean;
  size?: 'small' | 'medium';
  style?: object;
}

export function PendingBadge({ isPending = false, size = 'small', style }: PendingBadgeProps) {
  if (!isPending) {
    return null;
  }

  const isSmall = size === 'small';

  return (
    <View style={[styles.badge, isSmall ? styles.badgeSmall : styles.badgeMedium, style]}>
      <View style={[styles.dot, isSmall ? styles.dotSmall : styles.dotMedium]} />
      {!isSmall && <ThemedText style={styles.text}>Pending</ThemedText>}
    </View>
  );
}

// Utility component for showing pending count
export function PendingCount({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }

  return (
    <View style={styles.countBadge}>
      <ThemedText style={styles.countText}>{count} pending</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 12,
  },
  badgeSmall: {
    width: 12,
    height: 12,
    justifyContent: 'center',
  },
  badgeMedium: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  dot: {
    borderRadius: 50,
    backgroundColor: '#F59E0B',
  },
  dotSmall: {
    width: 6,
    height: 6,
  },
  dotMedium: {
    width: 6,
    height: 6,
  },
  text: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F59E0B',
    textTransform: 'uppercase',
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
});
