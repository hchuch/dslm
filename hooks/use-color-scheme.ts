// Keep a tiny hook that returns 'dark' to force the app into dark mode for the inventory UI.
// If you want to follow the system appearance again, replace this with a re-export from 'react-native' or Appearance.getColorScheme().
export function useColorScheme(): 'dark' {
  return 'dark';
}
