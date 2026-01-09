import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CTBInspectorModal } from '../../components/ctb-inspector-modal';
import { ModuleVisualization } from '../../components/module-visualization';
import ParallaxScrollView from '../../components/parallax-scroll-view';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useInventory } from '../../hooks/use-inventory';
import { useNFC } from '../../hooks/use-nfc';
import type { CTB, StackId } from '../../types/dslm';

export default function ModuleScreen() {
  const { stacks, ctbs, getItemsInCTB, getStackUtilization, findCTBById, findItemById, reorganizeStack } = useInventory();
  const [selectedStack, setSelectedStack] = useState<StackId | undefined>();
  const [scannedCTB, setScannedCTB] = useState<CTB | null>(null);
  const { scanTag, isScanning, isSupported } = useNFC();
  const insets = useSafeAreaInsets();
  const headerHeight = 72 + insets.top;

  const stackDetails = selectedStack
    ? {
      stack: stacks.find(s => s.stackId === selectedStack),
      ctbsInStack: ctbs.filter(ctb => ctb.location.stack === selectedStack),
      utilization: getStackUtilization(selectedStack),
    }
    : null;

  const handleScan = async () => {
    const tag = await scanTag();
    if (tag) {
      // Try to find CTB or Item by ID (assuming tag ID matches or is mapped)
      // In a real scenario, we'd lookup the tag ID in a DB.
      // Here we assume tag.id might be part of the ID or we search.
      // For prototype, let's assume the tag payload IS the ID.

      const id = tag.payload || tag.id;
      const ctb = findCTBById(id);
      if (ctb) {
        setScannedCTB(ctb);
        return;
      }

      const item = findItemById(id);
      if (item) {
        const parentCTB = findCTBById(item.ctbId);
        if (parentCTB) {
          setScannedCTB(parentCTB);
          Alert.alert('Item Found', `Item "${item.name}" is in CTB ${parentCTB.id}`);
        } else {
          Alert.alert('Item Found', `Item "${item.name}" found, but parent CTB is unknown.`);
        }
        return;
      }

      Alert.alert('Unknown Tag', `Tag ID: ${id} not found in inventory.`);
    }
  };

  return (
    <>
      <ParallaxScrollView
        headerHeight={headerHeight}
        headerBackgroundColor={{ light: '#0A0B0D', dark: '#0A0B0D' }}
        headerImage={
          <ThemedView style={[styles.headerBar, { height: headerHeight, paddingTop: insets.top }]}>
            <ThemedText style={styles.headerTitle}>Module Layout</ThemedText>
            <ThemedText style={styles.headerSubtitle}>DSLM Stack Configuration</ThemedText>
          </ThemedView>
        }>

        <ModuleVisualization
          stacks={stacks}
          ctbs={ctbs}
          selectedStack={selectedStack}
          onStackPress={setSelectedStack}
        />

        <ThemedView style={styles.emptyState}>
          <ThemedText style={styles.emptyTitle}>Select a stack to view details</ThemedText>
          <ThemedText style={styles.emptyText}>
            Tap on any stack above to see its CTBs and contents
          </ThemedText>
        </ThemedView>

      </ParallaxScrollView >

      {/* NFC Scan Button */}
      {
        isSupported && (
          <Pressable
            style={[styles.fab, isScanning && styles.fabScanning]}
            onPress={handleScan}
            disabled={isScanning}
          >
            <ThemedText style={styles.fabIcon}>
              {isScanning ? '...' : '📡'}
            </ThemedText>
          </Pressable>
        )
      }

      {/* CTB Inspector Modal (for scanned items) */}
      <CTBInspectorModal
        visible={!!scannedCTB}
        ctb={scannedCTB}
        onClose={() => setScannedCTB(null)}
      />

      {/* Stack Details Modal */}
      <Modal
        visible={!!selectedStack}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedStack(undefined)}
      >
        <ThemedView style={styles.modalContainer}>
          {stackDetails && (
            <>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setSelectedStack(undefined)} style={styles.closeBtn}>
                  <ThemedText style={styles.closeBtnText}>Close</ThemedText>
                </Pressable>
                <ThemedText style={styles.modalTitle}>{stackDetails.stack?.stackId} Details</ThemedText>
                <Pressable
                  onPress={() => {
                    if (selectedStack) {
                      reorganizeStack(selectedStack);
                      Alert.alert('Stack Optimized', 'CTBs have been resorted and repacked.');
                    }
                  }}
                  style={styles.optimizeBtn}
                >
                  <Ionicons name="construct-outline" size={20} color="#0F6FFF" />
                </Pressable>
              </View>

              <ScrollView style={styles.modalContent}>
                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <ThemedText style={styles.statValue}>{stackDetails.ctbsInStack.length}</ThemedText>
                    <ThemedText style={styles.statLabel}>CTBs</ThemedText>
                  </View>
                  <View style={styles.statCard}>
                    <ThemedText style={styles.statValue}>{stackDetails.utilization.toFixed(0)}%</ThemedText>
                    <ThemedText style={styles.statLabel}>Utilized</ThemedText>
                  </View>
                  <View style={styles.statCard}>
                    <ThemedText style={styles.statValue}>{stackDetails.stack?.positions}</ThemedText>
                    <ThemedText style={styles.statLabel}>Positions</ThemedText>
                  </View>
                  <View style={styles.statCard}>
                    <ThemedText style={styles.statValue}>{stackDetails.stack?.maxLayers}</ThemedText>
                    <ThemedText style={styles.statLabel}>Layers</ThemedText>
                  </View>
                </View>

                <ThemedText style={styles.sectionTitle}>CTBs in {stackDetails.stack?.stackId}</ThemedText>

                {stackDetails.ctbsInStack.length === 0 ? (
                  <ThemedView style={styles.emptyState}>
                    <ThemedText style={styles.emptyText}>No CTBs in this stack</ThemedText>
                  </ThemedView>
                ) : (
                  <View style={styles.ctbList}>
                    {stackDetails.ctbsInStack.map((ctb) => {
                      const items = getItemsInCTB(ctb.id);
                      return (
                        <ThemedView key={ctb.id} style={styles.ctbCard}>
                          <View style={styles.ctbHeader}>
                            <ThemedText style={styles.ctbId}>{ctb.id}</ThemedText>
                            <View style={styles.ctbSizeBadge}>
                              <ThemedText style={styles.ctbSizeText}>Size: {ctb.size}</ThemedText>
                            </View>
                          </View>

                          <View style={styles.ctbInfo}>
                            <View style={styles.infoRow}>
                              <ThemedText style={styles.infoLabel}>Location:</ThemedText>
                              <ThemedText style={styles.infoValue}>{ctb.location.path}</ThemedText>
                            </View>
                            <View style={styles.infoRow}>
                              <ThemedText style={styles.infoLabel}>Items:</ThemedText>
                              <ThemedText style={styles.infoValue}>{items.length}</ThemedText>
                            </View>
                            <View style={styles.infoRow}>
                              <ThemedText style={styles.infoLabel}>Mass:</ThemedText>
                              <ThemedText style={styles.infoValue}>{ctb.mass} kg</ThemedText>
                            </View>
                            <View style={styles.infoRow}>
                              <ThemedText style={styles.infoLabel}>Volume:</ThemedText>
                              <ThemedText style={styles.infoValue}>{ctb.volume} m³</ThemedText>
                            </View>
                            <View style={styles.infoRow}>
                              <ThemedText style={styles.infoLabel}>RFID:</ThemedText>
                              <ThemedText style={styles.infoValue}>{ctb.rfidTag.id}</ThemedText>
                            </View>
                            {ctb.notes && (
                              <View style={styles.infoRow}>
                                <ThemedText style={styles.infoLabel}>Notes:</ThemedText>
                                <ThemedText style={[styles.infoValue, { flex: 1 }]} numberOfLines={2}>
                                  {ctb.notes}
                                </ThemedText>
                              </View>
                            )}
                          </View>

                          {items.length > 0 && (
                            <View style={styles.itemsList}>
                              <ThemedText style={styles.itemsListTitle}>Items:</ThemedText>
                              {items.slice(0, 3).map((item) => (
                                <ThemedText key={item.id} style={styles.itemName} numberOfLines={1}>
                                  • {item.name}
                                </ThemedText>
                              ))}
                              {items.length > 3 && (
                                <ThemedText style={styles.moreItems}>
                                  +{items.length - 3} more items
                                </ThemedText>
                              )}
                            </View>
                          )}
                        </ThemedView>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            </>
          )}
        </ThemedView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    height: 72,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    opacity: 0.7,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0A0B0D',
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2B2E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111214',
  },
  closeBtn: {
    padding: 8,
  },
  closeBtnText: {
    color: '#0F6FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  optimizeBtn: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: 80,
    backgroundColor: '#111214',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F6FFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    opacity: 0.6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.8,
  },
  ctbList: {
    paddingBottom: 40,
  },
  ctbCard: {
    backgroundColor: '#111214',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2B2E',
  },
  ctbHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ctbId: {
    fontSize: 15,
    fontWeight: '700',
  },
  ctbSizeBadge: {
    backgroundColor: '#0F6FFF20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0F6FFF40',
  },
  ctbSizeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F6FFF',
  },
  ctbInfo: {
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    opacity: 0.6,
    width: 90,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemsList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2B2E',
  },
  itemsListTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    opacity: 0.7,
  },
  itemName: {
    fontSize: 11,
    opacity: 0.6,
    marginBottom: 3,
  },
  moreItems: {
    fontSize: 11,
    opacity: 0.5,
    fontStyle: 'italic',
    marginTop: 3,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.8,
  },
  emptyText: {
    fontSize: 13,
    opacity: 0.5,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0F6FFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 100,
  },
  fabScanning: {
    backgroundColor: '#EAB308',
  },
  fabIcon: {
    fontSize: 24,
  },
});
