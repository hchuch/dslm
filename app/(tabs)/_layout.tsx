import { Tabs } from 'expo-router';
import React from 'react';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { HapticTab } from '../../components/haptic-tab';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { InventoryProvider } from '../../hooks/use-inventory';
export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <InventoryProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#105bd8',
          tabBarInactiveTintColor: '#aeb0b5',
          tabBarStyle: {
            backgroundColor: '#212121',
            borderTopColor: '#323a45',
          },
          headerShown: false,
          tabBarButton: HapticTab,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="module"
          options={{
            title: 'Module',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="cube.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="incoming"
          options={{
            title: 'Incoming',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="tray.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="delivered"
          options={{
            title: 'Delivered',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="checkmark.seal.fill" color={color} />
            ),
          }}
        />
      </Tabs>
    </InventoryProvider>
  );
}
