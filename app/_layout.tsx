import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '../contexts/auth-context';
import { NotificationProvider } from '../contexts/notification-context';
import { SyncProvider } from '../contexts/sync-context';
import { DialogProvider } from '../hooks/use-dialog';
import { InventoryProvider } from '../hooks/use-inventory';
import { getApiBaseUrl } from '../services/api-config';

import { Colors } from '@/constants/colors';

export const unstable_settings = {
  anchor: '(tabs)',
};

const DSLMTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.textPrimary,
    border: Colors.border,
    primary: Colors.blue,
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => { getApiBaseUrl(); }, []);

  return (
    <AuthProvider>
      <SyncProvider>
        <InventoryProvider>
          <NotificationProvider>
            <DialogProvider>
              <ThemeProvider value={DSLMTheme}>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom',
                    animationDuration: 200,
                  }}
                >
                  <Stack.Screen name="login" options={{ animation: 'fade' }} />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: true, title: 'Modal' }} />
                </Stack>
                <StatusBar style="light" />
              </ThemeProvider>
            </DialogProvider>
          </NotificationProvider>
        </InventoryProvider>
      </SyncProvider>
    </AuthProvider>
  );
}
