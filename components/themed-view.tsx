import { View, type ViewProps } from 'react-native';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  // Use a fixed dark background so the components render consistently in this edit session.
  const backgroundColor = darkColor ?? '#212121';

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
