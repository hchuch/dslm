import { Platform } from 'react-native';

const Palette = {
  primary: '#105bd8',
  primaryDarker: '#0b3d91',
  primaryDarkest: '#061f4a',
  base: '#212121',
  grayDark: '#323a45',
  grayLight: '#aeb0b5',
  white: '#ffffff',

  primaryAlt: '#02bfe7',
  primaryAltDarkest: '#046b99',
  primaryAltDark: '#00a6d2',
  primaryAltLight: '#9bdaf1',
  primaryAltLightest: '#e1f3f8',

  secondary: '#dd361c',
  secondaryDarkest: '#99231b',
  secondaryDark: '#c62d1f',
  secondaryLight: '#e59892',
  secondaryLightest: '#f9e0de',

  gray: '#5b616b',
  grayLighter: '#d6d7d9',
  grayLightest: '#f1f1f1',
  grayWarmDark: '#494440',
  grayWarmLight: '#e4e2e0',
  grayCoolLight: '#dce4ef',

  gold: '#ff9d1e',
  goldLight: '#f9aa43',
  goldLighter: '#ffc375',
  goldLightest: '#ffebd1',

  green: '#2e8540',
  greenLight: '#4aa564',
  greenLighter: '#94bfa2',
  greenLightest: '#e7f4e4',

  coolBlue: '#205493',
  coolBlueLight: '#4773aa',
  coolBlueLighter: '#8ba6ca',
  coolBlueLightest: '#dce4ef',

  focus: '#aeb0b5',
  visited: '#4c2c92',
};

export const Colors = {
  light: {
    text: Palette.base,
    background: Palette.white,
    tint: Palette.primary,
    icon: Palette.grayLight,
    tabIconDefault: Palette.grayLight,
    tabIconSelected: Palette.primary,
    card: Palette.white,
    border: Palette.grayLight,
    ...Palette,
  },
  dark: {
    text: Palette.white,
    background: Palette.base,
    tint: Palette.primary,
    icon: Palette.grayLight,
    tabIconDefault: Palette.grayLight,
    tabIconSelected: Palette.primary,
    card: Palette.grayDark,
    border: Palette.grayDark,
    ...Palette,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
