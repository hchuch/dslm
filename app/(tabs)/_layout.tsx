import { IconSymbol } from '@/components/ui/icon-symbol';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { HapticTab } from '../../components/haptic-tab';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/auth-context';

export default function TabLayout() {
  const { user } = useAuth();

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors.blue,
          tabBarInactiveTintColor: Colors.textSecondary,
          tabBarStyle: {
            backgroundColor: Colors.surface,
            borderTopColor: Colors.border,
          },
          headerShown: false,
          tabBarButton: HapticTab,
          sceneStyle: {
            backgroundColor: Colors.background,
          },
          animation: 'fade',
          lazy: true,
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
            href: null,
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="tray.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="delivered"
          options={{
            title: 'Delivered',
            href: null,
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="checkmark.seal.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="waste"
          options={{
            title: 'Waste',
            href: null,
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="trash.fill" color={color} />,
          }}
        />

        <Tabs.Screen
          name="logs"
          options={{
            title: 'Activity',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="clock.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="shipment"
          options={{
            title: 'Shipment',
            href: user?.role === 'ground-crew' || user?.role === 'admin' ? '/shipment' : null,
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="admin"
          options={{
            title: 'Admin',
            href: user?.role === 'admin' ? '/admin' : null,
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
          }}
        />
    </Tabs>
  );
}
