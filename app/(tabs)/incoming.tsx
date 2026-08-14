import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CTBViewer } from '../../components/ctb-viewer';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/auth-context';
import { useDialog } from '../../hooks/use-dialog';
import { useInventory } from '../../hooks/use-inventory';
import type { CTB } from '../../types/dslm';

export default function IncomingScreen() {
  const { getIncomingCTBs, receiveCTB, shipments, inventoryItems } = useInventory();
  const { user } = useAuth();
  const incomingCTBs = useMemo(() => getIncomingCTBs(), [getIncomingCTBs]);
  const [selectedCTB, setSelectedCTB] = useState<CTB | null>(null);
  const [selectedCTBVisible, setSelectedCTBVisible] = useState(false);
  const { showDialog } = useDialog();

  const summaryData = useMemo(() => {
    const totalMass = incomingCTBs.reduce((sum, ctb) => sum + ctb.mass, 0);
    const totalItems = incomingCTBs.reduce((sum, ctb) => sum + ctb.items.length, 0);
    return { totalMass, totalItems };
  }, [incomingCTBs]);

  const inTransitShipments = useMemo(() => {
    return shipments.filter(s => s.status === 'in-transit' || s.status === 'launched');
  }, [shipments]);

  const lastReceivedTimestamp = useMemo(() => {
    const deliveredDates = inventoryItems
      .filter(item => item.status === 'stock' && item.deliveredDate)
      .map(item => new Date(item.deliveredDate!).getTime())
      .filter(t => !isNaN(t));
    if (deliveredDates.length === 0) return null;
    return new Date(Math.max(...deliveredDates));
  }, [inventoryItems]);

  const handleReceiveCTB = (ctbId: string) => {
    const ctb = incomingCTBs.find(c => c.id === ctbId);
    if (!ctb) return;

    showDialog(
      "Receive CTB",
      `Confirm receipt of ${ctb.id}?\n\nTarget Location:\nStack: ${ctb.location.stack}\nPosition: ${ctb.location.position}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Receipt",
          onPress: () => {
            receiveCTB(ctbId);
            setSelectedCTBVisible(false);
            setTimeout(() => setSelectedCTB(null), 400);
          }
        }
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View>
            <ThemedText type="title" style={styles.headerTitle}>Incoming Logistics</ThemedText>
            <ThemedText style={styles.headerSubtitle}>
              {incomingCTBs.length} {incomingCTBs.length === 1 ? 'CTB' : 'CTBs'} en route to Gateway
            </ThemedText>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryValue}>{incomingCTBs.length}</ThemedText>
              <ThemedText style={styles.summaryLabel}>CTBs</ThemedText>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryValue}>{summaryData.totalMass.toFixed(1)}</ThemedText>
              <ThemedText style={styles.summaryLabel}>kg Total</ThemedText>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryValue}>{summaryData.totalItems}</ThemedText>
              <ThemedText style={styles.summaryLabel}>Items</ThemedText>
            </View>
          </View>

          {lastReceivedTimestamp && (
            <View style={styles.lastReceivedRow}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
              <ThemedText style={styles.lastReceivedText}>
                Last received: {lastReceivedTimestamp.toLocaleDateString()} {lastReceivedTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </ThemedText>
            </View>
          )}

          {inTransitShipments.length > 0 && (
            <View style={styles.enRouteSection}>
              {inTransitShipments.map(shipment => (
                <View key={shipment.id} style={styles.enRouteCard}>
                  <View style={styles.enRouteIconWrap}>
                    <Ionicons name="rocket-outline" size={22} color={Colors.warning} />
                  </View>
                  <View style={styles.enRouteContent}>
                    <ThemedText style={styles.enRouteTitle}>Shipment En Route</ThemedText>
                    <ThemedText style={styles.enRouteManifest}>{shipment.manifestId}</ThemedText>
                    <View style={styles.enRouteDetails}>
                      <ThemedText style={styles.enRouteDetail}>{shipment.ctbIds.length} CTBs</ThemedText>
                      <ThemedText style={styles.enRouteDot}>{'\u00B7'}</ThemedText>
                      <ThemedText style={styles.enRouteDetail}>{shipment.totalMass.toFixed(1)} kg</ThemedText>
                      <ThemedText style={styles.enRouteDot}>{'\u00B7'}</ThemedText>
                      <ThemedText style={styles.enRouteDetail}>{shipment.priority}</ThemedText>
                    </View>
                  </View>
                  <View style={styles.enRouteStatusBadge}>
                    <ThemedText style={styles.enRouteStatusText}>
                      {shipment.status === 'in-transit' ? 'In Transit' : 'Launched'}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          )}

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
                  onPress={() => {
                    setSelectedCTB(ctb);
                    setSelectedCTBVisible(true);
                  }}
                >
                  <View style={styles.iconContainer}>
                    <Ionicons name="cube" size={40} color={Colors.blue} />
                    <View style={styles.sizeBadge}>
                      <ThemedText style={styles.sizeText}>{ctb.size * 2}</ThemedText>
                    </View>
                    {ctb.rfidTag?.id && !ctb.rfidTag.id.startsWith('RFID-') && (
                      <View style={styles.nfcBadge}>
                        <Ionicons name="radio-outline" size={12} color={Colors.success} />
                      </View>
                    )}
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
                    {user?.role !== 'ground-crew' ? (
                      <Pressable
                        style={({ pressed }) => [styles.receiveButton, pressed && styles.receiveButtonPressed]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleReceiveCTB(ctb.id);
                        }}
                      >
                        <Ionicons name="download-outline" size={16} color="#000" style={{ marginRight: 6 }} />
                        <ThemedText style={styles.receiveButtonText}>Receive</ThemedText>
                      </Pressable>
                    ) : (
                      <ThemedText style={styles.statText}>En Route to Gateway</ThemedText>
                    )}

                    <View style={styles.inspectHint}>
                      <ThemedText style={styles.tapText}>Inspect</ThemedText>
                      <Ionicons name="chevron-forward" size={14} color="#666" />
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        {selectedCTB && (
          <CTBViewer
            visible={selectedCTBVisible}
            ctb={selectedCTB}
            onClose={() => {
              setSelectedCTBVisible(false);
              setTimeout(() => setSelectedCTB(null), 400);
            }}
            onReceive={handleReceiveCTB}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
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
    paddingBottom: 24,
    paddingTop: 16,
    paddingHorizontal: 16,
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
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
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
    borderColor: Colors.borderLight,
  },
  nfcBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cardContent: {
    marginBottom: 12,
    alignItems: 'flex-start',
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
    width: '100%',
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
    borderTopColor: Colors.border,
    paddingTop: 8,
  },
  tapText: {
    fontSize: 10,
    color: '#0F6FFF',
    fontWeight: '600',
  },
  receiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.blue,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  receiveButtonPressed: {
    opacity: 0.8,
  },
  receiveButtonText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
  inspectHint: {
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.7,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  summaryLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },
  lastReceivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  lastReceivedText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  enRouteSection: {
    gap: 10,
    marginBottom: 16,
  },
  enRouteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 10, 0.2)',
    padding: 14,
  },
  enRouteIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 214, 10, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  enRouteContent: {
    flex: 1,
  },
  enRouteTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  enRouteManifest: {
    fontSize: 12,
    color: Colors.warning,
    fontWeight: '600',
    marginTop: 1,
  },
  enRouteDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  enRouteDetail: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  enRouteDot: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  enRouteStatusBadge: {
    backgroundColor: 'rgba(255, 214, 10, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  enRouteStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.warning,
  },
});
