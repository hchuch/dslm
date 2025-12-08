import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddShipmentModal } from '../../components/add-shipment-modal';
import { CTBInspectorModal } from '../../components/ctb-inspector-modal';
import ParallaxScrollView from '../../components/parallax-scroll-view';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useInventory } from '../../hooks/use-inventory';
import type { CTB } from '../../types/dslm';

export default function IncomingScreen() {
  const { getIncomingCTBs, receiveCTB } = useInventory();
  const incomingCTBs = useMemo(() => getIncomingCTBs(), [getIncomingCTBs]);
  const [selectedCTB, setSelectedCTB] = useState<CTB | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const insets = useSafeAreaInsets();
  const headerHeight = 100 + insets.top;

  const handleReceiveCTB = (ctbId: string) => {
    const ctb = incomingCTBs.find(c => c.id === ctbId);
    if (!ctb) return;

    Alert.alert(
      "Receive CTB",
      `Confirm receipt of ${ctb.id}?\n\nTarget Location:\nStack: ${ctb.location.stack}\nPosition: ${ctb.location.position}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Receipt",
          onPress: () => {
            receiveCTB(ctbId);
            setSelectedCTB(null);
          }
        }
      ]
    );
  };

  return (
    <>
      <ParallaxScrollView
        headerHeight={headerHeight}
        headerBackgroundColor={{ light: '#0A0B0D', dark: '#0A0B0D' }}
        headerImage={
          <ThemedView style={[styles.headerBar, { height: headerHeight, paddingTop: insets.top }]}>
            <ThemedText style={styles.headerTitle}>Incoming Logistics</ThemedText>
            <ThemedText style={styles.headerSubtitle}>
              {incomingCTBs.length} {incomingCTBs.length === 1 ? 'CTB' : 'CTBs'} en route to Gateway
            </ThemedText>
          </ThemedView>
        }>

        {incomingCTBs.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <Ionicons name="file-tray-outline" size={60} color="#666" style={{ marginBottom: 16, opacity: 0.5 }} />
            <ThemedText style={styles.emptyTitle}>No Incoming CTBs</ThemedText>
            <ThemedText style={styles.emptyText}>
              All Cargo Transfer Bags have been received
            </ThemedText>
          </ThemedView>
        ) : (
          <View style={styles.gridContainer}>
            {incomingCTBs.map((ctb) => (
              <Pressable
                key={ctb.id}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => setSelectedCTB(ctb)}
              >
                <View style={styles.iconContainer}>
                  <Ionicons name="cube" size={40} color="#0F6FFF" />
                  <View style={styles.sizeBadge}>
                    <ThemedText style={styles.sizeText}>{ctb.size * 2}</ThemedText>
                  </View>
                </View>

                <View style={styles.cardContent}>
                  <ThemedText style={styles.ctbId} numberOfLines={1}>
                    {ctb.id}
                  </ThemedText>
                  <ThemedText style={styles.ctbLocation} numberOfLines={1}>
                    Location: {ctb.location.path}
                  </ThemedText>

                  <View style={styles.statsRow}>
                    <ThemedText style={styles.statText}>
                      Mass: {ctb.mass}kg
                    </ThemedText>
                    <ThemedText style={styles.statText}>
                      Items: {ctb.items.length}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <Pressable
                    style={({ pressed }) => [styles.receiveButton, pressed && styles.receiveButtonPressed]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleReceiveCTB(ctb.id);
                    }}
                  >
                    <Ionicons name="download-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />
                    <ThemedText style={styles.receiveButtonText}>Receive</ThemedText>
                  </Pressable>

                  <View style={styles.inspectHint}>
                    <ThemedText style={styles.tapText}>Inspect</ThemedText>
                    <Ionicons name="chevron-forward" size={14} color="#666" />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ParallaxScrollView>

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => setShowAddModal(true)}
      >
        <Ionicons name="add" size={32} color="#FFF" />
      </Pressable>

      <CTBInspectorModal
        visible={!!selectedCTB}
        ctb={selectedCTB}
        onClose={() => setSelectedCTB(null)}
        onReceive={handleReceiveCTB}
      />

      <AddShipmentModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    height: 100,
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
    backgroundColor: 'transparent',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.5,
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 40,
  },
  card: {
    width: '48%', // 2 columns with gap
    backgroundColor: '#111214',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2B2E',
    padding: 12,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  iconContainer: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: '#1A1B1E',
    borderRadius: 8,
    position: 'relative',
  },
  sizeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#2A2B2E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3A3B3E',
  },
  sizeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  cardContent: {
    marginBottom: 12,
  },
  ctbId: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  ctbLocation: {
    fontSize: 11,
    opacity: 0.5,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statText: {
    fontSize: 10,
    opacity: 0.6,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#2A2B2E',
    paddingTop: 8,
  },
  tapText: {
    fontSize: 10,
    color: '#0F6FFF',
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0F6FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  fabPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  receiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F6FFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  receiveButtonPressed: {
    opacity: 0.8,
  },
  receiveButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  inspectHint: {
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.7,
  },
});
