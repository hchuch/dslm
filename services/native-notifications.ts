import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';

// Configure notification behavior (show even when app is foregrounded)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, // Don't show native alert when app is in foreground (we use in-app banner)
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type NotificationChannel = 'incoming' | 'warning' | 'success';

const CHANNEL_CONFIG: Record<NotificationChannel, { name: string; sound: boolean }> = {
  incoming: { name: 'Incoming Shipments', sound: true },
  warning: { name: 'Warnings & Alerts', sound: true },
  success: { name: 'Deliveries & Status', sound: false },
};

let isSetup = false;

/**
 * Request notification permissions and set up Android channels.
 * Call once at app startup.
 */
export async function setupNotifications(): Promise<boolean> {
  if (isSetup) return true;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission not granted');
    return false;
  }

  // Set up Android notification channels
  if (Platform.OS === 'android') {
    for (const [channelId, config] of Object.entries(CHANNEL_CONFIG)) {
      await Notifications.setNotificationChannelAsync(channelId, {
        name: config.name,
        importance: Notifications.AndroidImportance.HIGH,
        sound: config.sound ? 'default' : undefined,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
  }

  isSetup = true;
  console.log('[Notifications] Setup complete');
  return true;
}

/**
 * Send a local notification (appears in device notification tray).
 */
export async function sendLocalNotification(
  channel: NotificationChannel,
  title: string,
  body?: string,
  data?: Record<string, string>,
): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: body || '',
        data: data || {},
        sound: CHANNEL_CONFIG[channel].sound ? 'default' : undefined,
        ...(Platform.OS === 'android' ? { channelId: channel } : {}),
      },
      trigger: null, // Send immediately
    });
    return id;
  } catch (error) {
    console.error('[Notifications] Failed to send:', error);
    return null;
  }
}

/**
 * Set up listener for notification taps — navigates to the relevant screen.
 * Returns cleanup function.
 */
export function setupNotificationResponseListener(): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data?.route) {
      router.push(data.route as any);
    }
  });

  return () => subscription.remove();
}

/**
 * Update the app badge count.
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch {
    // Badge not supported on all platforms
  }
}
