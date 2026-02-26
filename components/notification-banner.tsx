import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../constants/colors';
import { ThemedText } from './themed-text';

export type NotificationType = 'incoming' | 'warning' | 'success';

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  onPress?: () => void;
};

type Props = {
  notification: Notification | null;
  onDismiss: () => void;
};

const TYPE_CONFIG: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; color: string; bgColor: string }> = {
  incoming: {
    icon: 'rocket',
    color: Colors.blue,
    bgColor: 'rgba(15, 111, 255, 0.25)',
  },
  warning: {
    icon: 'warning',
    color: '#FF9F0A',
    bgColor: 'rgba(255, 159, 10, 0.25)',
  },
  success: {
    icon: 'checkmark-circle',
    color: Colors.success,
    bgColor: 'rgba(50, 215, 75, 0.25)',
  },
};

export function NotificationBanner({ notification, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (notification) {
      // Animate in from top
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after 4s
      timerRef.current = setTimeout(() => {
        dismissBanner();
      }, 4000);
    } else {
      translateY.setValue(-120);
      opacity.setValue(0);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notification]);

  const dismissBanner = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismissRef.current();
    });
  };

  if (!notification) return null;

  const config = TYPE_CONFIG[notification.type];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + 8,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Pressable
        style={styles.pressable}
        onPress={() => {
          notification.onPress?.();
          dismissBanner();
        }}
      >
        <View style={[styles.iconContainer, { backgroundColor: config.bgColor }]}>
          <Ionicons name={config.icon} size={18} color={config.color} />
        </View>

        <View style={styles.textContainer}>
          <ThemedText style={styles.title} numberOfLines={1}>
            {notification.title}
          </ThemedText>
          {notification.message && (
            <ThemedText style={styles.message} numberOfLines={1}>
              {notification.message}
            </ThemedText>
          )}
        </View>

        <Pressable style={styles.closeButton} onPress={dismissBanner} hitSlop={8}>
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.5)" />
        </Pressable>
      </Pressable>

      {/* Accent line at top */}
      <View style={[styles.accentLine, { backgroundColor: config.color }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  message: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  closeButton: {
    padding: 4,
  },
});
