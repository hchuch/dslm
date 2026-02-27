import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CTBViewer } from '../../components/ctb-viewer';
import { ModuleVisualization } from '../../components/module-visualization';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { Colors } from '../../constants/colors';
import { useInventory } from '../../hooks/use-inventory';
import { useDialog } from '../../hooks/use-dialog';
import { useNFC } from '../../hooks/use-nfc';
import type { CTB, StackId } from '../../types/dslm';

export default function ModuleScreen() {
  const { stacks, ctbs, getItemsInCTB, getStackUtilization, findCTBById, findItemById, reorganizeStack, updateStackLayout, outsideCTBs } = useInventory();
  const [selectedStack, setSelectedStack] = useState<StackId | undefined>();
  const [isReorganizing, setIsReorganizing] = useState(false);
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null);
  const [tempStackCtbs, setTempStackCtbs] = useState<CTB[]>([]);
  const [scannedCTB, setScannedCTB] = useState<CTB | null>(null);
  const [scannedCTBVisible, setScannedCTBVisible] = useState(false);
  const [inspectedCTB, setInspectedCTB] = useState<CTB | null>(null);
  const [inspectedCTBVisible, setInspectedCTBVisible] = useState(false);
  const [outsideExpanded, setOutsideExpanded] = useState(true);
  const [outsideInspectedCTB, setOutsideInspectedCTB] = useState<CTB | null>(null);
  const [outsideInspectedVisible, setOutsideInspectedVisible] = useState(false);
  const { scanTag, isScanning, isSupported } = useNFC();
  const { showDialog } = useDialog();

  const stackDetails = selectedStack
    ? {
      stack: stacks.find(s => s.stackId === selectedStack),
      ctbsInStack: isReorganizing
        ? tempStackCtbs
        : ctbs
            .filter(ctb => ctb.location.stack === selectedStack && !ctb.isOutside)
            .sort((a, b) => {
              const layerDiff = (a.location.layer || 1) - (b.location.layer || 1);
              if (layerDiff !== 0) return layerDiff;
              return a.location.position - b.location.position;
            }),
      utilization: getStackUtilization(selectedStack),
      totalMass: ctbs
        .filter(ctb => ctb.location.stack === selectedStack && !ctb.isOutside)
        .reduce((sum, ctb) => sum + ctb.mass, 0),
    }
    : null;

  const handleScan = async () => {
    const tag = await scanTag();
    if (tag) {
      const id = tag.payload || tag.id;
      const ctb = findCTBById(id);
      if (ctb) {
        setScannedCTB(ctb);
        setScannedCTBVisible(true);
        return;
      }

      const item = findItemById(id);
      if (item) {
        const parentCTB = findCTBById(item.ctbId);
        if (parentCTB) {
          setScannedCTB(parentCTB);
          setScannedCTBVisible(true);
          showDialog('Item Found', `Item "${item.name}" is in CTB ${parentCTB.id}`);
        } else {
          showDialog('Item Found', `Item "${item.name}" found, but parent CTB is unknown.`);
        }
        return;
      }

      showDialog('Unknown Tag', `Tag ID: ${id} not found in inventory.`);
    }
  };

  const AnimatedCTBCard = ({ 
    ctb, 
    isSelected, 
    isReorderMode,
    onPress,
    children 
  }: { 
    ctb: CTB; 
    isSelected: boolean; 
    isReorderMode: boolean;
    onPress: () => void;
    children: React.ReactNode;
  }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const shakeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      if (isReorderMode && !isSelected) {
        const wobble = Animated.loop(
          Animated.sequence([
            Animated.timing(shakeAnim, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(shakeAnim, {
              toValue: -1,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(shakeAnim, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.delay(2000),
          ])
        );
        wobble.start();
        return () => wobble.stop();
      } else {
        shakeAnim.setValue(0);
      }
    }, [isReorderMode, isSelected, shakeAnim]);

    useEffect(() => {
      if (isSelected) {
        const pulse = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.03,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
          ])
        );
        pulse.start();
        
        Animated.spring(scaleAnim, {
          toValue: 1.02,
          friction: 3,
          useNativeDriver: true,
        }).start();

        return () => pulse.stop();
      } else {
        pulseAnim.setValue(1);
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          useNativeDriver: true,
        }).start();
      }
    }, [isSelected, pulseAnim, scaleAnim]);

    const rotate = shakeAnim.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: ['-0.5deg', '0deg', '0.5deg'],
    });

    return (
      <Pressable onPress={onPress}>
        <Animated.View
          style={[
            styles.ctbCard,
            isReorderMode && styles.reorgCard,
            isSelected && styles.reorgCardSelected,
            {
              transform: [
                { scale: isSelected ? pulseAnim : scaleAnim },
                { rotate: isReorderMode ? rotate : '0deg' },
              ],
            },
          ]}
        >
          {children}
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View>
            <ThemedText type="title" style={styles.headerTitle}>Module Layout</ThemedText>
            <ThemedText style={styles.headerSubtitle}>DSLM Stack Configuration</ThemedText>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          {outsideCTBs.length > 0 && (
            <View style={styles.outsideSection}>
              <Pressable
                style={styles.outsideHeader}
                onPress={() => setOutsideExpanded(!outsideExpanded)}
              >
                <View style={styles.outsideHeaderLeft}>
                  <Ionicons name="log-out-outline" size={18} color={Colors.warning} />
                  <ThemedText style={styles.outsideHeaderTitle}>Outside CTBs</ThemedText>
                  <View style={styles.outsideBadge}>
                    <ThemedText style={styles.outsideBadgeText}>{outsideCTBs.length}</ThemedText>
                  </View>
                </View>
                <Ionicons
                  name={outsideExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={Colors.textSecondary}
                />
              </Pressable>
              {outsideExpanded && (
                <View style={styles.outsideList}>
                  {outsideCTBs.map((ctb) => (
                    <Pressable
                      key={ctb.id}
                      style={({ pressed }) => [
                        styles.outsideCard,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={() => {
                        setOutsideInspectedCTB(ctb);
                        setOutsideInspectedVisible(true);
                      }}
                    >
                      <View style={styles.outsideCardIcon}>
                        <Ionicons name="cube-outline" size={20} color={Colors.warning} />
                      </View>
                      <View style={styles.outsideCardInfo}>
                        <ThemedText style={styles.outsideCardTitle}>{ctb.id}</ThemedText>
                        <ThemedText style={styles.outsideCardMeta}>
                          Size {ctb.size} · From {ctb.previousLocation?.path || '?'}
                        </ThemedText>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

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
        </ScrollView>

        {isSupported && (
          <Pressable
            style={[styles.fab, isScanning && styles.fabScanning]}
            onPress={handleScan}
            disabled={isScanning}
          >
            <Ionicons name={isScanning ? 'ellipsis-horizontal' : 'radio-outline'} size={24} color="#000" />
          </Pressable>
        )}

        <Modal
          visible={!!selectedStack}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setSelectedStack(undefined)}
        >
          <ThemedView style={styles.modalContainer}>
            {stackDetails && (
              <>
                <View style={[styles.modalHeader, isReorganizing && { backgroundColor: Colors.surfaceHover, borderBottomColor: Colors.blue }]}>
                  <Pressable onPress={() => {
                    if (isReorganizing) {
                      showDialog('Cancel Reorganization?', 'Changes will be lost.', [
                        { text: 'Keep Editing', style: 'cancel' },
                        { text: 'Discard', style: 'destructive', onPress: () => { setIsReorganizing(false); setSwapSourceId(null); } }
                      ]);
                    } else {
                      setSelectedStack(undefined);
                    }
                  }} style={styles.closeBtn}>
                    <ThemedText style={isReorganizing ? { color: Colors.error } : styles.closeBtnText}>{isReorganizing ? 'Cancel' : 'Close'}</ThemedText>
                  </Pressable>
                  <ThemedText style={styles.modalTitle}>
                    {isReorganizing ? 'Manual Reorder' : `${stackDetails.stack?.stackId} Details`}
                  </ThemedText>
                  {isReorganizing ? (
                    <Pressable
                      onPress={() => {
                        if (selectedStack) {
                          updateStackLayout(selectedStack, tempStackCtbs);
                          setIsReorganizing(false);
                          setSwapSourceId(null);
                          showDialog('Saved', 'New stack layout confirmed.');
                        }
                      }}
                      style={styles.optimizeBtn}
                    >
                      <ThemedText style={{ color: Colors.blue, fontWeight: '700' }}>Save</ThemedText>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => {
                        if (selectedStack) {
                          showDialog(
                            'Reorganize Stack',
                            'Choose an optimization method:',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Manual Sort',
                                onPress: () => {
                                  setTempStackCtbs(stackDetails.ctbsInStack);
                                  setIsReorganizing(true);
                                }
                              },
                              {
                                text: 'Auto-Optimize',
                                onPress: () => {
                                  reorganizeStack(selectedStack, 'auto');
                                  showDialog('Auto-Optimized', 'Stack defragmented and sorted by mass.');
                                }
                              }
                            ]
                          );
                        }
                      }}
                      style={styles.optimizeBtn}
                    >
                      <Ionicons name="construct-outline" size={20} color={Colors.blue} />
                    </Pressable>
                  )}
                </View>

                <ScrollView style={styles.modalContent}>
                  <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                      <ThemedText style={styles.statValue}>{stackDetails.ctbsInStack.length}</ThemedText>
                      <ThemedText style={styles.statLabel}>CTBs</ThemedText>
                    </View>
                    <View style={styles.statCard}>
                      <ThemedText style={styles.statValue}>{stackDetails.totalMass.toFixed(1)}</ThemedText>
                      <ThemedText style={styles.statLabel}>Total kg</ThemedText>
                    </View>
                    <View style={styles.statCard}>
                      <ThemedText style={styles.statValue}>{stackDetails.utilization.toFixed(0)}%</ThemedText>
                      <ThemedText style={styles.statLabel}>Capacity</ThemedText>
                    </View>
                    <View style={styles.statCard}>
                      <ThemedText style={styles.statValue}>{stackDetails.stack?.positions}</ThemedText>
                      <ThemedText style={styles.statLabel}>Positions</ThemedText>
                    </View>
                  </View>

                  <ThemedText style={styles.sectionTitle}>
                    {isReorganizing ? 'Tap to Select • Tap again to Swap' : `CTBs in ${stackDetails.stack?.stackId}`}
                  </ThemedText>

                  {stackDetails.ctbsInStack.length === 0 ? (
                    <ThemedView style={styles.emptyState}>
                      <ThemedText style={styles.emptyText}>No CTBs in this stack</ThemedText>
                    </ThemedView>
                  ) : (
                    <View style={styles.ctbList}>
                      {stackDetails.ctbsInStack.map((ctb, index) => {
                        const items = getItemsInCTB(ctb.id);
                        const isSelected = swapSourceId === ctb.id;
                        const currentLayer = ctb.location.layer || 1;
                        const prevCtb = index > 0 ? stackDetails.ctbsInStack[index - 1] : null;
                        const prevLayer = prevCtb ? (prevCtb.location.layer || 1) : 0;
                        const showLayerHeader = currentLayer !== prevLayer;

                        return (
                          <React.Fragment key={ctb.id}>
                            {showLayerHeader && (
                              <View style={styles.layerHeader}>
                                <View style={styles.layerHeaderLine} />
                                <ThemedText style={styles.layerHeaderText}>Layer {currentLayer}</ThemedText>
                                <View style={styles.layerHeaderLine} />
                              </View>
                            )}
                            <AnimatedCTBCard
                            ctb={ctb}
                            isSelected={isSelected}
                            isReorderMode={isReorganizing}
                            onPress={() => {
                              if (isReorganizing) {
                                if (isSelected) {
                                  setSwapSourceId(null);
                                } else if (swapSourceId) {
                                  const sourceIndex = tempStackCtbs.findIndex(c => c.id === swapSourceId);
                                  const targetIndex = tempStackCtbs.findIndex(c => c.id === ctb.id);

                                  const newOrder = [...tempStackCtbs];
                                  [newOrder[sourceIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[sourceIndex]];

                                  setTempStackCtbs(newOrder);
                                  setSwapSourceId(null);
                                } else {
                                  setSwapSourceId(ctb.id);
                                }
                              } else {
                                setInspectedCTB(ctb);
                                setInspectedCTBVisible(true);
                              }
                            }}
                          >
                              <View style={styles.ctbHeader}>
                                <View style={styles.ctbHeaderLeft}>
                                  <View style={styles.layerBadge}>
                                    <ThemedText style={styles.layerBadgeText}>L{ctb.location.layer || 1}</ThemedText>
                                  </View>
                                  <ThemedText style={styles.ctbId}>{ctb.id}</ThemedText>
                                  {ctb.rfidTag?.id && !ctb.rfidTag.id.startsWith('RFID-') && (
                                    <View style={styles.nfcBadge}>
                                      <Ionicons name="radio-outline" size={10} color={Colors.success} />
                                    </View>
                                  )}
                                </View>
                                <View style={styles.ctbSizeBadge}>
                                  <ThemedText style={styles.ctbSizeText}>{ctb.size}m³</ThemedText>
                                </View>
                              </View>

                              <View style={styles.ctbInfo}>
                                <View style={styles.infoRow}>
                                  <ThemedText style={styles.infoLabel}>Position:</ThemedText>
                                  <ThemedText style={styles.infoValue}>P{ctb.location.position}{ctb.size > 1 ? `-P${ctb.location.position + Math.ceil(ctb.size) - 1}` : ''} (Layer {ctb.location.layer || 1})</ThemedText>
                                </View>
                                {isReorganizing && (
                                  <View style={[styles.infoRow, styles.reorgHint]}>
                                    <Ionicons 
                                      name={isSelected ? "swap-horizontal" : "hand-left-outline"} 
                                      size={14} 
                                      color={isSelected ? Colors.blue : Colors.textSecondary} 
                                    />
                                    <ThemedText style={[styles.infoValue, isSelected && { color: Colors.blue }]}>
                                      {isSelected ? 'Now tap another to swap' : 'Tap to select'}
                                    </ThemedText>
                                  </View>
                                )}
                                {!isReorganizing && (
                                  <>
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
                                  </>
                                )}
                              </View>

                              {!isReorganizing && items.length > 0 && (
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
                          </AnimatedCTBCard>
                          </React.Fragment>
                        );

                      })}
                    </View>
                  )}
                </ScrollView>

                {inspectedCTB && (
                  <CTBViewer
                    visible={inspectedCTBVisible}
                    ctb={inspectedCTB}
                    onClose={() => {
                      setInspectedCTBVisible(false);
                      setTimeout(() => setInspectedCTB(null), 400);
                    }}
                  />
                )}
              </>
            )}
          </ThemedView>
        </Modal>

        {scannedCTB && !selectedStack && (
          <CTBViewer
            visible={scannedCTBVisible}
            ctb={scannedCTB}
            onClose={() => {
              setScannedCTBVisible(false);
              setTimeout(() => setScannedCTB(null), 400);
            }}
          />
        )}
        {outsideInspectedCTB && (
          <CTBViewer
            visible={outsideInspectedVisible}
            ctb={outsideInspectedCTB}
            onClose={() => {
              setOutsideInspectedVisible(false);
              setTimeout(() => setOutsideInspectedCTB(null), 400);
            }}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  outsideSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(255, 214, 10, 0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 10, 0.2)',
    overflow: 'hidden',
  },
  outsideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  outsideHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  outsideHeaderTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.warning,
  },
  outsideBadge: {
    backgroundColor: Colors.warning,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  outsideBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
  },
  outsideList: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  outsideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  outsideCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 214, 10, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outsideCardInfo: {
    flex: 1,
  },
  outsideCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  outsideCardMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 24,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  contentContainer: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
  },
  closeBtn: {
    padding: 8,
  },
  closeBtnText: {
    color: Colors.blue,
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
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.blue,
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
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ctbHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ctbHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  layerBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  layerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  ctbId: {
    fontSize: 15,
    fontWeight: '700',
  },
  nfcBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctbSizeBadge: {
    backgroundColor: Colors.blueGlow,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.blueGlow,
  },
  ctbSizeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.blue,
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
    borderTopColor: Colors.border,
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
    backgroundColor: Colors.blue,
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
  reorgCard: {
    borderStyle: 'dashed',
    borderColor: Colors.blue,
    opacity: 0.9,
  },
  reorgCardSelected: {
    borderColor: Colors.blue,
    borderWidth: 2,
    borderStyle: 'solid',
    backgroundColor: Colors.blueGlow,
    opacity: 1,
    shadowColor: Colors.blue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  reorgHint: {
    marginTop: 8,
    gap: 6,
  },
  layerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
    gap: 12,
  },
  layerHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  layerHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
