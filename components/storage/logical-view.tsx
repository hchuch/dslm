import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type StackInfo = { id: string; locations: number };

type Props = {
  stacks: StackInfo[];
  activeStack: string;
  onSelectStack?: (id: string) => void;
};

export default function LogicalView({ stacks, activeStack, onSelectStack }: Props) {
  return (
    <View style={styles.container}>
      {stacks.map((s) => (
        <Pressable key={s.id} onPress={() => onSelectStack?.(s.id)}>
          <View style={[styles.row, activeStack === s.id && styles.rowActive]}>
            <Text style={styles.text}>{s.id}</Text>
            <Text style={styles.count}>{s.locations}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 8 },
  row: { padding: 8, borderRadius: 6, backgroundColor: '#1F2023', marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between' },
  rowActive: { backgroundColor: '#0F6FFF' },
  text: { color: '#ECEDEE' },
  count: { color: '#9BA1A6' },
});
