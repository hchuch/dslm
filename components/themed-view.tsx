import { View, type ViewProps } from 'react-native';
import { Colors } from '../constants/colors';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const backgroundColor = darkColor ?? Colors.background;

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
