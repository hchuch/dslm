import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModuleVisualization } from '../../components/module-visualization';
import ParallaxScrollView from '../../components/parallax-scroll-view';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useInventory } from '../../hooks/use-inventory';
import type { StackId } from '../../types/dslm';

export default function ModuleScreen() {
  const { stacks, ctbs, getItemsInCTB, getStackUtilization } = useInventory();
  const [selectedStack, setSelectedStack] = useState<StackId | undefined>();
  const insets = useSafeAreaInsets();
  const headerHeight = 72 + insets.top;

  const stackDetails = selectedStack
    ? {
      stack: stacks.find(s => s.stackId === selectedStack),
      ctbsInStack: ctbs.filter(ctb => ctb.location.stack === selectedStack),
      utilization: getStackUtilization(selectedStack),
    }
    : null;

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
      </ParallaxScrollView>

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
                <View style={styles.headerSpacer} />
              </View>

              <ScrollView style={styles.modalContent}>
                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <ThemedText style={styles.statValue}>{stackDetails.ctbsInStack.length}</ThemedText>
                    <ThemedText style={styles.statLabel}>CTBs</ThemedText>
                  </View>
                  <View style={styles.statCard}>
                    <ThemedText style={styles.statValue}>{stackDetails.utilization}%</ThemedText>
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
    paddingHorizontal: 20,
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
  headerSpacer: {
    width: 60,
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
});
