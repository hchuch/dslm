import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  stackId: string;
  locations: number;
  selectedLocation?: number;
  onSelectLocation?: (idx: number) => void;
};

export default function PhysicalView({ stackId, locations, selectedLocation, onSelectLocation }: Props) {
  const cells = Array.from({ length: locations }).map((_, i) => i + 1);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{stackId}</Text>
      <View style={styles.grid}>
        {cells.map((c) => (
          <Pressable key={c} onPress={() => onSelectLocation?.(c)} style={[styles.cell, selectedLocation === c && styles.cellActive]}>
            <Text style={styles.cellText}>{c}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 8 },
  title: { color: '#ECEDEE', marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#1F2023', alignItems: 'center', justifyContent: 'center', margin: 4 },
  cellActive: { backgroundColor: '#0F6FFF' },
  cellText: { color: '#fff', fontSize: 12 },
});
