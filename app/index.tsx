import { Redirect } from 'expo-router';
import React from 'react';

export default function Index() {
  // Redirect root to the tabs layout
  return <Redirect href="/(tabs)" />;
}