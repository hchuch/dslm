import { Stack } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Details' }} />
      <Text style={styles.text}>Modal / detail placeholder</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111214' },
  text: { color: '#ECEDEE' },
});
