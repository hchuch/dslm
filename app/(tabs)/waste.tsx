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
import type { CTB, InventoryItem } from '../../types/dslm';

const MISSION_WASTE_BUDGET_M3 = 0.240; // m³

type FilterMode = 'all' | 'waste' | 'consumed';

export default function WasteScreen() {
  const { inventoryItems, wasteItems, getWasteVolume, restoreFromWaste, findCTBById } = useInventory();
  const { user } = useAuth();
  const { showDialog } = useDialog();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [selectedCTB, setSelectedCTB] = useState<CTB | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const wasteAndConsumedItems = useMemo(() => {
    return inventoryItems.filter(
      (i) => i.status === 'waste' || i.status === 'consumed'
    );
  }, [inventoryItems]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return wasteAndConsumedItems;
    return wasteAndConsumedItems.filter((i) => i.status === filter);
  }, [wasteAndConsumedItems, filter]);

  const wasteCount = useMemo(
    () => wasteAndConsumedItems.filter((i) => i.status === 'waste').length,
    [wasteAndConsumedItems]
  );
  const consumedCount = useMemo(
    () => wasteAndConsumedItems.filter((i) => i.status === 'consumed').length,
    [wasteAndConsumedItems]
  );

  const totalWasteVolumeM3 = useMemo(() => getWasteVolume(), [getWasteVolume]);
  const capacityPercent = Math.min((totalWasteVolumeM3 / MISSION_WASTE_BUDGET_M3) * 100, 100);
  const isOverBudget = capacityPercent > 80;

  const disposalBreakdown = useMemo(() => {
    const counts = { 'return-earth': 0, 'deep-space': 0, recycle: 0 };
    for (const w of wasteItems) {
      counts[w.disposalMethod]++;
    }
    return counts;
  }, [wasteItems]);

  const handleRestore = (item: InventoryItem) => {
    showDialog(
      'Restore Item',
      `Remove "${item.name}" from waste and return to stock?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: () => restoreFromWaste(item.id, user?.id),
        },
      ],
    );
  };

  const handleItemPress = (item: InventoryItem) => {
    const ctb = findCTBById(item.ctbId);
    if (ctb) setSelectedCTB(ctb);
    setSelectedItem(item);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View>
            <ThemedText type="title" style={styles.headerTitle}>Waste Management</ThemedText>
            <ThemedText style={styles.headerSubtitle}>
              {wasteAndConsumedItems.length} items tracked
            </ThemedText>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, styles.summaryCardWaste]}>
              <ThemedText style={styles.summaryValue}>
                {totalWasteVolumeM3.toFixed(3)} m³
              </ThemedText>
              <ThemedText style={styles.summaryLabel}>Waste Volume</ThemedText>
            </View>
            <View style={styles.summaryCard}>
              <ThemedText style={[styles.summaryValue, { color: Colors.error }]}>
                {wasteCount}
              </ThemedText>
              <ThemedText style={styles.summaryLabel}>Waste</ThemedText>
            </View>
            <View style={styles.summaryCard}>
              <ThemedText style={[styles.summaryValue, { color: Colors.warning }]}>
                {consumedCount}
              </ThemedText>
              <ThemedText style={styles.summaryLabel}>Consumed</ThemedText>
            </View>
          </View>

          <View style={styles.capacitySection}>
            <View style={styles.capacityHeader}>
              <ThemedText style={styles.capacityTitle}>Mission Waste Budget</ThemedText>
              <ThemedText style={[styles.capacityPercent, isOverBudget && { color: Colors.error }]}>
                {capacityPercent.toFixed(1)}%
              </ThemedText>
            </View>
            <View style={styles.capacityBarBg}>
              <View
                style={[
                  styles.capacityBarFill,
                  { width: `${capacityPercent}%` },
                  isOverBudget && { backgroundColor: Colors.error },
                ]}
              />
            </View>
            <ThemedText style={styles.capacitySubtext}>
              {totalWasteVolumeM3.toFixed(3)} / {MISSION_WASTE_BUDGET_M3} m³
            </ThemedText>
          </View>

          <View style={styles.filterRow}>
            {(['all', 'waste', 'consumed'] as FilterMode[]).map((mode) => (
              <Pressable
                key={mode}
                style={[styles.filterChip, filter === mode && styles.filterChipActive]}
                onPress={() => setFilter(mode)}
              >
                <ThemedText style={[styles.filterText, filter === mode && styles.filterTextActive]}>
                  {mode === 'all' ? 'All' : mode === 'waste' ? 'Waste' : 'Consumed'}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {filteredItems.length === 0 ? (
            <ThemedView style={styles.emptyState}>
              <Ionicons name="leaf-outline" size={60} color={Colors.textTertiary} style={{ marginBottom: 16, opacity: 0.5 }} />
              <ThemedText style={styles.emptyTitle}>No Waste Items</ThemedText>
              <ThemedText style={styles.emptyText}>
                Items marked as consumed or waste will appear here
              </ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.itemList}>
              {filteredItems.map((item) => {
                const wasteInfo = wasteItems.find((w) => w.itemId === item.id);
                return (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [styles.itemRow, pressed && { opacity: 0.7 }]}
                    onPress={() => handleItemPress(item)}
                  >
                    <View style={[
                      styles.itemIcon,
                      item.status === 'waste'
                        ? { backgroundColor: 'rgba(239, 68, 68, 0.15)' }
                        : { backgroundColor: 'rgba(255, 214, 10, 0.15)' },
                    ]}>
                      <Ionicons
                        name={item.status === 'waste' ? 'trash-bin' : 'checkmark-done'}
                        size={18}
                        color={item.status === 'waste' ? Colors.error : Colors.warning}
                      />
                    </View>
                    <View style={styles.itemInfo}>
                      <ThemedText numberOfLines={1} style={styles.itemName}>
                        {item.name}
                      </ThemedText>
                      <ThemedText style={styles.itemMeta}>
                        {item.location.path}
                      </ThemedText>
                    </View>
                    <View style={styles.itemRight}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[
                          styles.statusBadge,
                          item.status === 'waste'
                            ? { backgroundColor: 'rgba(239, 68, 68, 0.15)' }
                            : { backgroundColor: 'rgba(255, 214, 10, 0.15)' },
                        ]}>
                          <ThemedText style={[
                            styles.statusBadgeText,
                            { color: item.status === 'waste' ? Colors.error : Colors.warning },
                          ]}>
                            {item.status === 'waste' ? 'Waste' : 'Used'}
                          </ThemedText>
                        </View>
                        {item.status === 'waste' && (
                          <Pressable
                            onPress={(e) => { e.stopPropagation(); handleRestore(item); }}
                            style={styles.restoreBtn}
                            hitSlop={8}
                          >
                            <Ionicons name="arrow-undo" size={16} color={Colors.blue} />
                          </Pressable>
                        )}
                      </View>
                      {wasteInfo && (
                        <ThemedText style={styles.volumeText}>
                          {wasteInfo.wasteVolume.toFixed(3)} m³
                        </ThemedText>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {wasteItems.length > 0 && (
            <View style={styles.disposalSection}>
              <ThemedText style={styles.disposalTitle}>Disposal Methods</ThemedText>
              <View style={styles.disposalRow}>
                <View style={styles.disposalCard}>
                  <Ionicons name="earth" size={20} color={Colors.blue} />
                  <ThemedText style={styles.disposalCount}>
                    {disposalBreakdown['return-earth']}
                  </ThemedText>
                  <ThemedText style={styles.disposalLabel}>Return</ThemedText>
                </View>
                <View style={styles.disposalCard}>
                  <Ionicons name="planet" size={20} color={Colors.textSecondary} />
                  <ThemedText style={styles.disposalCount}>
                    {disposalBreakdown['deep-space']}
                  </ThemedText>
                  <ThemedText style={styles.disposalLabel}>Deep Space</ThemedText>
                </View>
                <View style={styles.disposalCard}>
                  <Ionicons name="refresh" size={20} color={Colors.success} />
                  <ThemedText style={styles.disposalCount}>
                    {disposalBreakdown.recycle}
                  </ThemedText>
                  <ThemedText style={styles.disposalLabel}>Recycle</ThemedText>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        <CTBViewer
          visible={!!selectedCTB}
          ctb={selectedCTB}
          initialItem={selectedItem}
          onClose={() => {
            setSelectedCTB(null);
            setSelectedItem(null);
          }}
        />
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
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryCardWaste: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  capacitySection: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  capacityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  capacityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  capacityPercent: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.success,
  },
  capacityBarBg: {
    height: 8,
    backgroundColor: Colors.surfaceHover,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  capacityBarFill: {
    height: '100%',
    backgroundColor: Colors.warning,
    borderRadius: 4,
  },
  capacitySubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.blueGlow,
    borderColor: Colors.blue,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.blue,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 20,
    backgroundColor: 'transparent',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  itemList: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  itemMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  volumeText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  restoreBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.blueGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disposalSection: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  disposalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  disposalRow: {
    flexDirection: 'row',
    gap: 10,
  },
  disposalCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: Colors.surfaceHover,
    borderRadius: 8,
    gap: 6,
  },
  disposalCount: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  disposalLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
});
