import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from "react-native";

import { Colors } from "../constants/colors";
import { useDialog } from '../hooks/use-dialog';
import { useInventory } from "../hooks/use-inventory";
import type { CTB, InventoryItem, Location } from "../types/dslm";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

type Props = {
  visible: boolean;
  item: InventoryItem | null;
  onClose: () => void;
  onRelocated?: (
    item: InventoryItem,
    newLocation: Location,
    newCtbId: string,
  ) => void;
};

// Get CTB capacity from its volume property (the CTB's own volume represents its capacity)
const getCTBCapacity = (ctb: CTB): number => {
  return ctb.volume;
};

export function RelocateItemModal({
  visible,
  item,
  onClose,
  onRelocated,
}: Props) {
  const { ctbs, moveItem, getItemsInCTB } = useInventory();
  const { showDialog } = useDialog();

  const [selectedCTB, setSelectedCTB] = useState<CTB | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  React.useEffect(() => {
    if (visible && item) {
      setSelectedCTB(null);
      setSearchQuery("");
    }
  }, [visible, item]);

  const getUsedVolume = (ctb: CTB): number => {
    const itemsInCTB = getItemsInCTB(ctb.id);
    return itemsInCTB.reduce((sum, i) => sum + i.volume, 0);
  };

  const getAvailableVolume = (ctb: CTB): number => {
    const capacity = getCTBCapacity(ctb);
    const used = getUsedVolume(ctb);
    return Math.max(0, capacity - used);
  };

  const itemFitsInCTB = React.useCallback(
    (ctb: CTB): boolean => {
      if (!item) return false;
      const capacity = getCTBCapacity(ctb);
      const itemsInCTB = getItemsInCTB(ctb.id);
      const used = itemsInCTB.reduce((sum, i) => sum + i.volume, 0);
      const available = Math.max(0, capacity - used);
      return item.volume <= available;
    },
    [item, getItemsInCTB],
  );

  const availableCTBs = useMemo(() => {
    if (!item) return [];

    let filtered = ctbs.filter(
      (ctb) =>
        ctb.id !== item.ctbId &&
        !ctb.isWaste &&
        ctb.location.stack !== "INCOMING",
    );

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (ctb) =>
          ctb.id.toLowerCase().includes(query) ||
          ctb.location.path.toLowerCase().includes(query) ||
          ctb.location.stack.toLowerCase().includes(query),
      );
    }

    return filtered.sort((a, b) => {
      const aFits = itemFitsInCTB(a);
      const bFits = itemFitsInCTB(b);
      if (aFits && !bFits) return -1;
      if (!aFits && bFits) return 1;
      return a.location.path.localeCompare(b.location.path);
    });
  }, [ctbs, item, searchQuery, itemFitsInCTB]);

  const groupedCTBs = useMemo(() => {
    const groups: Record<string, CTB[]> = {};
    availableCTBs.forEach((ctb) => {
      const stack = ctb.location.stack;
      if (!groups[stack]) groups[stack] = [];
      groups[stack].push(ctb);
    });
    return groups;
  }, [availableCTBs]);

  const handleRelocate = () => {
    if (!item || !selectedCTB) return;

    if (!itemFitsInCTB(selectedCTB)) {
      showDialog(
        "Insufficient Space",
        `This item (${item.volume.toFixed(3)} m³) does not fit in ${selectedCTB.id}.\n\nAvailable space: ${getAvailableVolume(selectedCTB).toFixed(3)} m³`,
        [{ text: "OK" }],
      );
      return;
    }

    const newLocation = selectedCTB.location;

    showDialog(
      "Confirm Relocation",
      `Move "${item.name}" to ${selectedCTB.id} at ${newLocation.path}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Move",
          onPress: () => {
            moveItem(
              item.id,
              newLocation,
              selectedCTB.id,
              undefined,
              undefined,
            );
            onRelocated?.(item, newLocation, selectedCTB.id);
            onClose();
          },
        },
      ],
    );
  };

  if (!item) return null;

  const canRelocate = selectedCTB && itemFitsInCTB(selectedCTB);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.cancelButton}>
            <ThemedText style={styles.cancelText}>Cancel</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>Relocate Item</ThemedText>
          <Pressable
            onPress={handleRelocate}
            style={[
              styles.doneButton,
              !canRelocate && styles.doneButtonDisabled,
            ]}
            disabled={!canRelocate}
          >
            <ThemedText
              style={[styles.doneText, !canRelocate && styles.doneTextDisabled]}
            >
              Move
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.itemCard}>
            <View style={styles.itemIcon}>
              <Ionicons name="cube" size={24} color={Colors.blue} />
            </View>
            <View style={styles.itemInfo}>
              <ThemedText style={styles.itemName}>{item.name}</ThemedText>
              <ThemedText style={styles.itemLocation}>
                Currently in: {item.ctbId}
              </ThemedText>
              <ThemedText style={styles.itemSize}>
                Size: {item.volume.toFixed(3)} m³ • {item.mass} kg
              </ThemedText>
            </View>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search CTBs..."
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={Colors.textTertiary}
                />
              </Pressable>
            )}
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              Select Destination CTB ({availableCTBs.length} available)
            </ThemedText>

            {Object.keys(groupedCTBs).length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="cube-outline"
                  size={40}
                  color={Colors.textTertiary}
                />
                <ThemedText style={styles.emptyText}>
                  {searchQuery
                    ? "No CTBs match your search"
                    : "No available CTBs"}
                </ThemedText>
              </View>
            ) : (
              Object.entries(groupedCTBs).map(([stack, stackCtbs]) => (
                <View key={stack} style={styles.stackGroup}>
                  <ThemedText style={styles.stackHeader}>{stack}</ThemedText>
                  {stackCtbs.map((ctb) => {
                    const fits = itemFitsInCTB(ctb);
                    const available = getAvailableVolume(ctb);
                    const capacity = getCTBCapacity(ctb);
                    const usagePercent =
                      ((capacity - available) / capacity) * 100;
                    const isSelected = selectedCTB?.id === ctb.id;
                    const itemsCount = getItemsInCTB(ctb.id).length;

                    return (
                      <Pressable
                        key={ctb.id}
                        style={[
                          styles.ctbCard,
                          isSelected && styles.ctbCardSelected,
                          !fits && styles.ctbCardDisabled,
                        ]}
                        onPress={() => fits && setSelectedCTB(ctb)}
                        disabled={!fits}
                      >
                        <View style={styles.ctbCardHeader}>
                          <View style={styles.ctbIdRow}>
                            <Ionicons
                              name={
                                isSelected ? "checkmark-circle" : "cube-outline"
                              }
                              size={20}
                              color={
                                isSelected
                                  ? Colors.blue
                                  : fits
                                    ? Colors.textSecondary
                                    : Colors.textTertiary
                              }
                            />
                            <ThemedText
                              style={[
                                styles.ctbId,
                                !fits && styles.ctbIdDisabled,
                              ]}
                            >
                              {ctb.id}
                            </ThemedText>
                          </View>
                          <ThemedText style={styles.ctbLocation}>
                            {ctb.location.path}
                          </ThemedText>
                        </View>

                        <View style={styles.ctbCardBody}>
                          <View style={styles.ctbStats}>
                            <ThemedText style={styles.ctbStatLabel}>
                              Size: {ctb.size}
                            </ThemedText>
                            <ThemedText style={styles.ctbStatLabel}>
                              Items: {itemsCount}
                            </ThemedText>
                          </View>

                          <View style={styles.capacityContainer}>
                            <View style={styles.capacityBar}>
                              <View
                                style={[
                                  styles.capacityFill,
                                  { width: `${Math.min(usagePercent, 100)}%` },
                                  usagePercent > 80 && styles.capacityFillHigh,
                                ]}
                              />
                            </View>
                            <ThemedText
                              style={[
                                styles.capacityText,
                                !fits && styles.capacityTextError,
                              ]}
                            >
                              {fits
                                ? `${available.toFixed(3)} m³ free`
                                : "No space"}
                            </ThemedText>
                          </View>
                        </View>

                        {!fits && (
                          <View style={styles.noFitBadge}>
                            <Ionicons
                              name="warning"
                              size={12}
                              color={Colors.red}
                            />
                            <ThemedText style={styles.noFitText}>
                              Need {item.volume.toFixed(3)} m³
                            </ThemedText>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {selectedCTB ? (
            <View style={styles.selectionSummary}>
              <Ionicons
                name="arrow-forward-circle"
                size={20}
                color={Colors.blue}
              />
              <ThemedText style={styles.summaryText}>
                Moving to{" "}
                <ThemedText style={styles.summaryBold}>
                  {selectedCTB.id}
                </ThemedText>{" "}
                at {selectedCTB.location.path}
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={styles.selectPrompt}>
              Select a destination CTB above
            </ThemedText>
          )}

          <Pressable
            style={[
              styles.relocateButton,
              !canRelocate && styles.relocateButtonDisabled,
            ]}
            onPress={handleRelocate}
            disabled={!canRelocate}
          >
            <Ionicons
              name="swap-horizontal"
              size={20}
              color={canRelocate ? "#000" : Colors.textTertiary}
            />
            <ThemedText
              style={[
                styles.relocateButtonText,
                !canRelocate && styles.relocateButtonTextDisabled,
              ]}
            >
              Relocate Item
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  cancelButton: {
    minWidth: 60,
  },
  cancelText: {
    color: Colors.blue,
    fontSize: 17,
  },
  doneButton: {
    minWidth: 60,
    alignItems: "flex-end",
  },
  doneButtonDisabled: {
    opacity: 0.5,
  },
  doneText: {
    color: Colors.blue,
    fontSize: 17,
    fontWeight: "600",
  },
  doneTextDisabled: {
    color: Colors.textTertiary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.blueGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  itemLocation: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  itemSize: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  stackGroup: {
    marginBottom: 16,
  },
  stackHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.blue,
    marginBottom: 8,
    paddingLeft: 4,
  },
  ctbCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  ctbCardSelected: {
    borderColor: Colors.blue,
    backgroundColor: Colors.blueGlow,
  },
  ctbCardDisabled: {
    opacity: 0.6,
  },
  ctbCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  ctbIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ctbId: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  ctbIdDisabled: {
    color: Colors.textTertiary,
  },
  ctbLocation: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  ctbCardBody: {
    gap: 8,
  },
  ctbStats: {
    flexDirection: "row",
    gap: 16,
  },
  ctbStatLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  capacityContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  capacityBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  capacityFill: {
    height: "100%",
    backgroundColor: Colors.blue,
    borderRadius: 3,
  },
  capacityFillHigh: {
    backgroundColor: "#f59e0b",
  },
  capacityText: {
    fontSize: 11,
    color: Colors.textSecondary,
    minWidth: 70,
  },
  capacityTextError: {
    color: Colors.red,
  },
  noFitBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  noFitText: {
    fontSize: 11,
    color: Colors.red,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  selectionSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  summaryBold: {
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  selectPrompt: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: "center",
  },
  relocateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.blue,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  relocateButtonDisabled: {
    backgroundColor: Colors.surface,
  },
  relocateButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  relocateButtonTextDisabled: {
    color: Colors.textTertiary,
  },
});
