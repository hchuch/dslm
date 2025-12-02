import React from 'react';
import { TouchableOpacity } from 'react-native';

// Minimal HapticTab that accepts any props (avoid strict typing mismatch with BottomTabBarButtonProps)
export function HapticTab(props: any) {
  const { children, onPress, ...rest } = props;

  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} {...rest}>
      {children}
    </TouchableOpacity>
  );
}
