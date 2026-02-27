import type { PropsWithChildren, ReactElement } from 'react';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useColorScheme } from '../hooks/use-color-scheme';
import { useThemeColor } from '../hooks/use-theme-color';
import { ThemedView } from './themed-view';

const DEFAULT_HEADER_HEIGHT = 96;

type Props = PropsWithChildren<{
  headerImage: ReactElement;
  headerBackgroundColor: { dark: string; light: string };
  headerHeight?: number;
}>;

export default function ParallaxScrollView({
  children,
  headerImage,
  headerBackgroundColor,
  headerHeight = DEFAULT_HEADER_HEIGHT,
}: Props) {
  const backgroundColor = useThemeColor({}, 'background');
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <ScrollView style={{ backgroundColor, flex: 1 }} scrollEventThrottle={16}>
      <View
        style={[
          styles.header,
          { backgroundColor: headerBackgroundColor[colorScheme] ?? headerBackgroundColor.light, height: headerHeight },
        ]}>
        {headerImage}
      </View>
      <ThemedView style={styles.content}>{children}</ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: 12,
    paddingTop: 12,
    gap: 16,
    overflow: 'hidden',
  },
});
