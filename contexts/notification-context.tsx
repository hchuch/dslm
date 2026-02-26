import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';

import { NotificationBanner, type Notification, type NotificationType } from '../components/notification-banner';
import { useInventory } from '../hooks/use-inventory';
import { addDataChangeListener } from '../services/sync-service';
import type { InventoryItem, ItemStatus } from '../types/dslm';
import {
  sendLocalNotification,
  setupNotifications,
  setupNotificationResponseListener,
  setBadgeCount,
  type NotificationChannel,
} from '../services/native-notifications';

type NotifyFn = (type: NotificationType, title: string, message?: string, onPress?: () => void, route?: string) => void;

type NotificationContextValue = {
  notify: NotifyFn;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const TYPE_TO_CHANNEL: Record<NotificationType, NotificationChannel> = {
  incoming: 'incoming',
  warning: 'warning',
  success: 'success',
};

// Snapshot of item state for diff detection
type ItemSnapshot = { id: string; name: string; status: ItemStatus; category: string; ctbId: string; locationStack: string };

function snapshotItems(items: InventoryItem[]): Map<string, ItemSnapshot> {
  const map = new Map<string, ItemSnapshot>();
  for (const item of items) {
    map.set(item.id, {
      id: item.id,
      name: item.name,
      status: item.status,
      category: item.category,
      ctbId: item.ctbId,
      locationStack: item.location.stack,
    });
  }
  return map;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Notification[]>([]);
  const [current, setCurrent] = useState<Notification | null>(null);
  const { inventoryItems, ctbs, getExpiringItems, categories } = useInventory();
  const router = useRouter();

  // Track previous state for diff detection
  const prevIncomingCtbIdsRef = useRef<Set<string>>(new Set());
  const prevExpiringIdsRef = useRef<Set<string>>(new Set());
  const prevItemSnapshotRef = useRef<Map<string, ItemSnapshot>>(new Map());
  const prevItemCountRef = useRef<number>(0);
  const initialLoadRef = useRef(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Set up native notifications on mount
  useEffect(() => {
    setupNotifications();
    const cleanup = setupNotificationResponseListener();
    return cleanup;
  }, []);

  // Track app state for deciding in-app vs native notification
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      appStateRef.current = state;
    });
    return () => sub.remove();
  }, []);

  const notify: NotifyFn = useCallback((type, title, message, onPress, route) => {
    const isAppActive = appStateRef.current === 'active';

    if (isAppActive) {
      const notification: Notification = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        title,
        message,
        onPress,
      };
      setQueue(prev => [...prev, notification]);
    }

    sendLocalNotification(
      TYPE_TO_CHANNEL[type],
      title,
      message,
      route ? { route } : undefined,
    );
  }, []);

  // Show next notification from queue when current is dismissed
  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue(prev => prev.slice(1));
    }
  }, [current, queue]);

  const handleDismiss = useCallback(() => {
    setCurrent(null);
  }, []);

  // Listen for sync data changes
  useEffect(() => {
    const unsubscribe = addDataChangeListener(() => {});
    return unsubscribe;
  }, []);

  // === Detect new incoming CTBs ===
  useEffect(() => {
    const currentIncomingIds = new Set(
      ctbs.filter(ctb => ctb.location.stack === 'INCOMING').map(ctb => ctb.id)
    );

    if (initialLoadRef.current) {
      prevIncomingCtbIdsRef.current = currentIncomingIds;
      if (ctbs.length > 0 || inventoryItems.length > 0) {
        initialLoadRef.current = false;
      }
      return;
    }

    const newIncoming: string[] = [];
    currentIncomingIds.forEach(id => {
      if (!prevIncomingCtbIdsRef.current.has(id)) {
        newIncoming.push(id);
      }
    });

    if (newIncoming.length > 0) {
      const count = newIncoming.length;
      notify(
        'incoming',
        count === 1 ? 'New incoming shipment' : `${count} new incoming shipments`,
        count === 1 ? `CTB ${newIncoming[0]}` : `${count} CTBs en route to Gateway`,
        () => router.push('/(tabs)/incoming'),
        '/(tabs)/incoming',
      );
      setBadgeCount(currentIncomingIds.size);
    }

    prevIncomingCtbIdsRef.current = currentIncomingIds;
  }, [ctbs, notify, router]);

  // === Detect item status changes, relocations, deletions, low stock ===
  useEffect(() => {
    if (initialLoadRef.current) return;

    const prevSnapshot = prevItemSnapshotRef.current;
    const currentSnapshot = snapshotItems(inventoryItems);

    // --- Items received (incoming → stock/delivered) ---
    const received: string[] = [];
    currentSnapshot.forEach((curr, id) => {
      const prev = prevSnapshot.get(id);
      if (prev && prev.status === 'incoming' && (curr.status === 'stock' || curr.status === 'delivered')) {
        received.push(curr.name);
      }
    });
    if (received.length > 0) {
      notify(
        'success',
        received.length === 1 ? 'Shipment received' : `${received.length} items received`,
        received.length === 1 ? received[0] : `${received.slice(0, 2).join(', ')}${received.length > 2 ? ` +${received.length - 2} more` : ''}`,
        () => router.push('/(tabs)/delivered'),
        '/(tabs)/delivered',
      );
    }

    // --- Items consumed ---
    const consumed: string[] = [];
    currentSnapshot.forEach((curr, id) => {
      const prev = prevSnapshot.get(id);
      if (prev && prev.status !== 'consumed' && curr.status === 'consumed') {
        consumed.push(curr.name);
      }
    });
    if (consumed.length > 0) {
      notify(
        'success',
        consumed.length === 1 ? 'Item consumed' : `${consumed.length} items consumed`,
        consumed.length === 1 ? consumed[0] : `${consumed.slice(0, 2).join(', ')}`,
        undefined,
        '/(tabs)/logs',
      );
    }

    // --- Items marked as waste ---
    const wasted: string[] = [];
    currentSnapshot.forEach((curr, id) => {
      const prev = prevSnapshot.get(id);
      if (prev && prev.status !== 'waste' && curr.status === 'waste') {
        wasted.push(curr.name);
      }
    });
    if (wasted.length > 0) {
      notify(
        'warning',
        wasted.length === 1 ? 'Item marked as waste' : `${wasted.length} items marked as waste`,
        wasted.length === 1 ? wasted[0] : `${wasted.slice(0, 2).join(', ')}`,
        () => router.push('/(tabs)/waste'),
        '/(tabs)/waste',
      );
    }

    // --- Items relocated (moved between stacks) ---
    const relocated: string[] = [];
    currentSnapshot.forEach((curr, id) => {
      const prev = prevSnapshot.get(id);
      if (prev && prev.locationStack !== curr.locationStack && prev.locationStack !== 'INCOMING' && curr.locationStack !== 'INCOMING') {
        relocated.push(curr.name);
      }
    });
    if (relocated.length > 0) {
      notify(
        'incoming',
        relocated.length === 1 ? 'Item relocated' : `${relocated.length} items relocated`,
        relocated.length === 1 ? relocated[0] : `${relocated.slice(0, 2).join(', ')}`,
        undefined,
        '/(tabs)/logs',
      );
    }

    // --- Items deleted ---
    const deleted: string[] = [];
    prevSnapshot.forEach((prev, id) => {
      if (!currentSnapshot.has(id)) {
        deleted.push(prev.name);
      }
    });
    if (deleted.length > 0) {
      notify(
        'warning',
        deleted.length === 1 ? 'Item removed' : `${deleted.length} items removed`,
        deleted.length === 1 ? deleted[0] : `${deleted.slice(0, 2).join(', ')}`,
        undefined,
        '/(tabs)/logs',
      );
    }

    // --- Low stock warning for important categories ---
    const importantCategoryNames = new Set(
      categories.filter(cat => cat.isImportant).map(cat => cat.name)
    );
    if (importantCategoryNames.size > 0) {
      const LOW_STOCK_THRESHOLD = 3;

      for (const catName of importantCategoryNames) {
        const currentCount = inventoryItems.filter(
          i => i.category === catName && (i.status === 'stock' || i.status === 'incoming')
        ).length;
        const prevCount = Array.from(prevSnapshot.values()).filter(
          s => s.category === catName && (s.status === 'stock' || s.status === 'incoming')
        ).length;

        // Only notify when count drops to/below threshold (not on every render)
        if (currentCount <= LOW_STOCK_THRESHOLD && currentCount < prevCount && currentCount > 0) {
          const label = categories.find(c => c.name === catName)?.label ?? catName;
          notify(
            'warning',
            `Low stock: ${label}`,
            `Only ${currentCount} remaining`,
            () => router.push('/(tabs)'),
            '/(tabs)',
          );
        }
      }
    }

    prevItemSnapshotRef.current = currentSnapshot;
    prevItemCountRef.current = inventoryItems.length;
  }, [inventoryItems, categories, notify, router]);

  // === Detect expiring items (within 3 days) ===
  useEffect(() => {
    if (initialLoadRef.current) return;

    const expiring = getExpiringItems(3);
    const currentExpiringIds = new Set(expiring.map(i => i.id));

    const newExpiring: string[] = [];
    currentExpiringIds.forEach(id => {
      if (!prevExpiringIdsRef.current.has(id)) {
        newExpiring.push(id);
      }
    });

    if (newExpiring.length > 0) {
      const count = newExpiring.length;
      const names = expiring.filter(i => newExpiring.includes(i.id)).map(i => i.name);
      notify(
        'warning',
        count === 1 ? 'Item expiring soon' : `${count} items expiring soon`,
        count === 1 ? names[0] : `${names.slice(0, 2).join(', ')}${count > 2 ? ` +${count - 2} more` : ''}`,
        undefined,
        '/(tabs)/logs',
      );
    }

    prevExpiringIdsRef.current = currentExpiringIds;
  }, [inventoryItems, getExpiringItems, notify]);

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <NotificationBanner notification={current} onDismiss={handleDismiss} />
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
