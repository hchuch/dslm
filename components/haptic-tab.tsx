import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, Pressable } from 'react-native';

export function HapticTab(props: any) {
  const { children, onPress, style, ...rest } = props;

  const handlePress = (e: any) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(e);
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      style={({ pressed }) => [style, pressed && { opacity: 0.7 }]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
