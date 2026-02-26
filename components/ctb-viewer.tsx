import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { Colors } from "../constants/colors";
import { useAuth } from "../contexts/auth-context";
import { useInventory, MAX_NESTING_DEPTH } from "../hooks/use-inventory";
import { useNFC } from "../hooks/use-nfc";
import type { CTB, InventoryItem, Location } from "../types/dslm";
import { ItemNotesModal } from "./item-notes-modal";
import { NFCScannerModal } from "./nfc-scanner-modal";
import { RelocateItemModal } from "./relocate-item-modal";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";
import { UndoToast } from "./undo-toast";

type ViewMode = "ctb" | "item";

type Props = {
  visible: boolean;
  ctb: CTB | null;
  initialItem?: InventoryItem | null; // If provided, opens directly to item view
  onClose: () => void;
  onReceive?: (ctbId: string) => void;
};

export function CTBViewer({
  visible,
  ctb,
  initialItem,
  onClose,
  onReceive,
}: Props) {
  const {
    getChildCTBs,
    getItemsInCTB,
    findCTBById,
    updateItemNotes,
    deleteItem,
    deleteCTB,
    receiveCTB,
    consumeItem,
    markAsWaste,
  } = useInventory();

  const { user } = useAuth();
  const { isSupported: nfcSupported } = useNFC();

  const [currentCTB, setCurrentCTB] = useState<CTB | null>(ctb);
  const [navigationStack, setNavigationStack] = useState<CTB[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("ctb");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showRelocateModal, setShowRelocateModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showDeleteCTBModal, setShowDeleteCTBModal] = useState(false);
  const [ctbDeletePassword, setCTBDeletePassword] = useState("");

  // Undo toast state
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [undoMessage, setUndoMessage] = useState("");
  const pendingDeleteRef = useRef<{
    type: "item" | "ctb";
    id: string;
    data: InventoryItem | CTB;
  } | null>(null);

  // NFC Scanner Modal state
  const [showNFCScanner, setShowNFCScanner] = useState(false);

  // Check if CTB is incoming - match same logic as getIncomingCTBs (check items' status)
  const ctbItems = currentCTB ? getItemsInCTB(currentCTB.id) : [];
  const hasIncomingItems = ctbItems.some((item) => item.status === "incoming");
  const isIncomingCTB = hasIncomingItems || currentCTB?.location?.stack === "INCOMING";
  const canReceive = isIncomingCTB && user?.role !== "ground-crew" && user?.role !== "loader";

  const handleRelocateItem = () => {
    if (selectedItem) {
      setShowRelocateModal(true);
    }
  };

  const handleEditNotes = () => {
    if (selectedItem) {
      setShowNotesModal(true);
    }
  };

  const handleConsumeItem = () => {
    if (!selectedItem) return;
    Alert.alert(
      "Consume Item",
      `Mark "${selectedItem.name}" as consumed? This means it has been fully used.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Consume",
          onPress: async () => {
            await consumeItem(selectedItem.id, user?.id);
            setSelectedItem({ ...selectedItem, status: "consumed" });
          },
        },
      ],
    );
  };

  const handleMarkAsWaste = () => {
    if (!selectedItem) return;
    Alert.alert(
      "Mark as Waste",
      `Mark "${selectedItem.name}" for waste disposal?\n\nWaste volume: ${((selectedItem.volume * 1.4) * 1000).toFixed(1)}L (1.4x original)`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark as Waste",
          style: "destructive",
          onPress: async () => {
            await markAsWaste(selectedItem.id, user?.id);
            setSelectedItem({ ...selectedItem, status: "waste" });
          },
        },
      ],
    );
  };

  const handleSaveNotes = (item: InventoryItem, notes: string) => {
    updateItemNotes(item.id, notes);
    // Update the selected item with new notes
    setSelectedItem({ ...item, notes });
  };

  const handleDeleteItem = () => {
    if (!selectedItem) return;

    Alert.alert(
      "Delete Item",
      `Are you sure you want to delete "${selectedItem.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            // Store the item for potential undo
            pendingDeleteRef.current = {
              type: "item",
              id: selectedItem.id,
              data: selectedItem,
            };
            setUndoMessage(`"${selectedItem.name}" deleted`);
            setShowUndoToast(true);

            // Go back to CTB view
            setViewMode("ctb");
            setSelectedItem(null);
          },
        },
      ],
    );
  };

  const handleUndoDelete = () => {
    // Just close the toast - the item wasn't actually deleted yet
    pendingDeleteRef.current = null;
    setShowUndoToast(false);
  };

  const handleConfirmDelete = () => {
    // Actually perform the deletion
    if (pendingDeleteRef.current) {
      if (pendingDeleteRef.current.type === "item") {
        deleteItem(pendingDeleteRef.current.id);
      } else {
        deleteCTB(pendingDeleteRef.current.id);
        onClose();
      }
      pendingDeleteRef.current = null;
    }
    setShowUndoToast(false);
  };

  const handleDeleteCTB = () => {
    setShowDeleteCTBModal(true);
    setCTBDeletePassword("");
  };

  const confirmDeleteCTB = () => {
    // Simple password check - in production this would be more secure
    if (
      ctbDeletePassword.toLowerCase() === "delete" ||
      ctbDeletePassword === "1234"
    ) {
      if (currentCTB) {
        // Store for potential undo
        pendingDeleteRef.current = {
          type: "ctb",
          id: currentCTB.id,
          data: currentCTB,
        };
        setUndoMessage(`CTB "${currentCTB.id}" deleted`);
        setShowDeleteCTBModal(false);
        setShowUndoToast(true);
      }
    } else {
      Alert.alert(
        "Incorrect Password",
        "Please enter the correct password to delete this CTB.",
      );
    }
  };

  const handleItemRelocated = (
    item: InventoryItem,
    newLocation: Location,
    newCtbId: string,
  ) => {
    // Update selected item with new location and CTB after relocate
    setSelectedItem({
      ...item,
      location: newLocation,
      ctbId: newCtbId,
    });
    // Update current CTB to the new one
    const newCTB = findCTBById(newCtbId);
    if (newCTB) {
      setCurrentCTB(newCTB);
    }
  };

  // Reset state when modal opens with a new CTB or item
  useEffect(() => {
    if (visible) {
      if (initialItem) {
        // If opening with an item, find its CTB and show item view
        const itemCTB = findCTBById(initialItem.ctbId);
        if (itemCTB) {
          setCurrentCTB(itemCTB);
          setSelectedItem(initialItem);
          setViewMode("item");
        } else if (ctb) {
          setCurrentCTB(ctb);
          setSelectedItem(initialItem);
          setViewMode("item");
        }
        setNavigationStack([]);
      } else if (ctb) {
        setCurrentCTB(ctb);
        setNavigationStack([]);
        setViewMode("ctb");
        setSelectedItem(null);
      }
    }
  }, [visible, ctb, initialItem, findCTBById]);

  if (!currentCTB) return null;

  const childCTBs = getChildCTBs(currentCTB.id);
  // Filter out items that are pending deletion
  const allItems = getItemsInCTB(currentCTB.id);
  const items = allItems.filter(
    (item) =>
      !(
        pendingDeleteRef.current?.type === "item" &&
        pendingDeleteRef.current?.id === item.id
      ),
  );

  const handleDrillDown = (child: CTB) => {
    setNavigationStack((prev) => [...prev, currentCTB]);
    setCurrentCTB(child);
    setViewMode("ctb");
    setSelectedItem(null);
  };

  const handleSelectItem = (item: InventoryItem) => {
    setSelectedItem(item);
    setViewMode("item");
  };

  const handleGoBack = () => {
    if (viewMode === "item") {
      // Go back to CTB view
      setViewMode("ctb");
      setSelectedItem(null);
    } else if (navigationStack.length > 0) {
      // Go back to parent CTB
      const parent = navigationStack[navigationStack.length - 1];
      setNavigationStack((prev) => prev.slice(0, -1));
      setCurrentCTB(parent);
    }
  };

  const canGoBack = viewMode === "item" || navigationStack.length > 0;

  // Render item detail view
  const renderItemView = () => {
    if (!selectedItem) return null;

    const isItemIncoming = selectedItem.status === "incoming";

    return (
      <ScrollView style={styles.content}>
        {/* Incoming Notice */}
        {isItemIncoming && (
          <View style={styles.incomingNotice}>
            <View style={styles.incomingNoticeIcon}>
              <Ionicons name="time-outline" size={24} color={Colors.warning} />
            </View>
            <View style={styles.incomingNoticeContent}>
              <ThemedText style={styles.incomingNoticeTitle}>
                Item Still Incoming
              </ThemedText>
              <ThemedText style={styles.incomingNoticeText}>
                This item is in transit and hasn't been received yet.
              </ThemedText>
            </View>
            {canReceive && (
              <Pressable
                style={styles.incomingNoticeButton}
                onPress={() => setViewMode("ctb")}
              >
                <ThemedText style={styles.incomingNoticeButtonText}>
                  View CTB
                </ThemedText>
                <Ionicons name="chevron-forward" size={16} color={Colors.blue} />
              </Pressable>
            )}
          </View>
        )}

        {/* Item Header */}
        <View style={styles.itemHeader}>
          <View style={styles.itemIconLarge}>
            <Ionicons
              name={getCategoryIcon(selectedItem.category)}
              size={32}
              color={Colors.blue}
            />
          </View>
          <ThemedText style={styles.itemTitle}>{selectedItem.name}</ThemedText>
          <View
            style={[
              styles.statusBadgeLarge,
              getStatusStyle(selectedItem.status),
            ]}
          >
            <ThemedText style={styles.statusTextLarge}>
              {selectedItem.status.toUpperCase()}
            </ThemedText>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <ThemedText style={styles.statValue}>
              {selectedItem.quantity}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Quantity</ThemedText>
          </View>
          <View style={styles.statCard}>
            <ThemedText style={styles.statValue}>
              {selectedItem.mass}kg
            </ThemedText>
            <ThemedText style={styles.statLabel}>Mass</ThemedText>
          </View>
          <View style={styles.statCard}>
            <ThemedText style={styles.statValue}>
              {selectedItem.criticality || "N/A"}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Priority</ThemedText>
          </View>
        </View>

        {/* Details Section */}
        <View style={styles.detailSection}>
          <ThemedText style={styles.sectionTitle}>Details</ThemedText>

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>ID</ThemedText>
            <ThemedText style={styles.detailValue}>
              {selectedItem.id}
            </ThemedText>
          </View>

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Category</ThemedText>
            <ThemedText style={styles.detailValue}>
              {selectedItem.category}
            </ThemedText>
          </View>

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Container</ThemedText>
            <ThemedText style={styles.detailValue}>
              {selectedItem.ctbId}
            </ThemedText>
          </View>

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Location</ThemedText>
            <ThemedText style={styles.detailValue}>
              {selectedItem.location.path}
            </ThemedText>
          </View>

          {selectedItem.rfidTag && (
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>RFID Tag</ThemedText>
              <ThemedText style={styles.detailValue}>
                {selectedItem.rfidTag.id} ({selectedItem.rfidTag.type})
              </ThemedText>
            </View>
          )}

          {selectedItem.description && (
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Description</ThemedText>
              <ThemedText style={styles.detailValue}>
                {selectedItem.description}
              </ThemedText>
            </View>
          )}

          {selectedItem.expiryDate && (
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Expiry</ThemedText>
              <ThemedText style={styles.detailValue}>
                {new Date(selectedItem.expiryDate).toLocaleDateString()}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Sub-items */}
        {selectedItem.subItems && selectedItem.subItems.length > 0 && (
          <View style={styles.detailSection}>
            <ThemedText style={styles.sectionTitle}>
              Sub-Items ({selectedItem.subItems.length})
            </ThemedText>
            {selectedItem.subItems.map((subItem, idx) => (
              <View key={subItem.id || idx} style={styles.subItemCard}>
                <Ionicons
                  name="cube-outline"
                  size={16}
                  color={Colors.textSecondary}
                />
                <ThemedText style={styles.subItemName}>
                  {subItem.name}
                </ThemedText>
                <ThemedText style={styles.subItemQty}>
                  ×{subItem.quantity}
                </ThemedText>
              </View>
            ))}
          </View>
        )}

        {/* Notes Section */}
        <View style={styles.detailSection}>
          <View style={styles.notesHeader}>
            <ThemedText style={styles.sectionTitle}>Notes</ThemedText>
            <Pressable onPress={handleEditNotes} style={styles.editNotesButton}>
              <Ionicons name="pencil" size={14} color={Colors.blue} />
              <ThemedText style={styles.editNotesText}>Edit</ThemedText>
            </Pressable>
          </View>
          {selectedItem.notes ? (
            <ThemedText style={styles.notesText}>
              {selectedItem.notes}
            </ThemedText>
          ) : (
            <ThemedText style={styles.notesPlaceholder}>
              No notes added yet. Tap Edit to add notes.
            </ThemedText>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <ThemedText style={styles.sectionTitle}>Actions</ThemedText>

          {/* Relocate */}
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
            ]}
            onPress={handleRelocateItem}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="swap-horizontal" size={20} color={Colors.blue} />
            </View>
            <View style={styles.actionInfo}>
              <ThemedText style={styles.actionTitle}>Relocate Item</ThemedText>
              <ThemedText style={styles.actionSubtitle}>
                Move to a different CTB
              </ThemedText>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={Colors.textTertiary}
            />
          </Pressable>

          {/* Edit Notes */}
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
              styles.actionButtonSpaced,
            ]}
            onPress={handleEditNotes}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="document-text" size={20} color={Colors.blue} />
            </View>
            <View style={styles.actionInfo}>
              <ThemedText style={styles.actionTitle}>Edit Notes</ThemedText>
              <ThemedText style={styles.actionSubtitle}>
                Add or modify item notes
              </ThemedText>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={Colors.textTertiary}
            />
          </Pressable>

          {/* Consume Item */}
          {(selectedItem.status === "stock" || selectedItem.status === "delivered") && (
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.actionButtonWarn,
                pressed && styles.actionButtonPressed,
                styles.actionButtonSpaced,
              ]}
              onPress={handleConsumeItem}
            >
              <View style={[styles.actionIcon, styles.actionIconWarn]}>
                <Ionicons name="checkmark-done" size={20} color={Colors.warning} />
              </View>
              <View style={styles.actionInfo}>
                <ThemedText style={styles.actionTitleWarn}>Mark as Consumed</ThemedText>
                <ThemedText style={styles.actionSubtitle}>
                  Item has been fully used
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
            </Pressable>
          )}

          {/* Mark as Waste */}
          {(selectedItem.status === "stock" || selectedItem.status === "delivered" || selectedItem.status === "consumed") && (
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.actionButtonDanger,
                pressed && styles.actionButtonPressed,
                styles.actionButtonSpaced,
              ]}
              onPress={handleMarkAsWaste}
            >
              <View style={[styles.actionIcon, styles.actionIconDanger]}>
                <Ionicons name="trash-bin" size={20} color={Colors.error} />
              </View>
              <View style={styles.actionInfo}>
                <ThemedText style={styles.actionTitleDanger}>Mark as Waste</ThemedText>
                <ThemedText style={styles.actionSubtitle}>
                  Flag for waste disposal ({((selectedItem.volume * 1.4) * 1000).toFixed(1)}L)
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
            </Pressable>
          )}

          {/* Delete Item */}
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.actionButtonDanger,
              pressed && styles.actionButtonPressed,
              styles.actionButtonSpaced,
            ]}
            onPress={handleDeleteItem}
          >
            <View style={[styles.actionIcon, styles.actionIconDanger]}>
              <Ionicons name="trash" size={20} color={Colors.error} />
            </View>
            <View style={styles.actionInfo}>
              <ThemedText style={styles.actionTitleDanger}>
                Delete Item
              </ThemedText>
              <ThemedText style={styles.actionSubtitle}>
                Permanently remove from inventory
              </ThemedText>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={Colors.textTertiary}
            />
          </Pressable>
        </View>
      </ScrollView>
    );
  };

  // Helper to format volume in liters
  const formatVolume = (volumeM3: number): string => {
    return `${Math.round(volumeM3 * 1000)}L`;
  };

  // Render CTB contents view
  const renderCTBView = () => (
    <ScrollView style={styles.content}>
      {/* CTB Stats - Primary */}
      <View style={styles.ctbStats}>
        <View style={styles.ctbStatItem}>
          <ThemedText style={styles.ctbStatValue}>{currentCTB.size}</ThemedText>
          <ThemedText style={styles.ctbStatLabel}>Size</ThemedText>
        </View>
        <View style={styles.ctbStatItem}>
          <ThemedText style={styles.ctbStatValue}>
            {currentCTB.mass}kg
          </ThemedText>
          <ThemedText style={styles.ctbStatLabel}>Mass</ThemedText>
        </View>
        <View style={styles.ctbStatItem}>
          <ThemedText style={styles.ctbStatValue}>
            {formatVolume(currentCTB.packedVolume ?? 0)}
          </ThemedText>
          <ThemedText style={styles.ctbStatLabel}>Packed</ThemedText>
        </View>
        <View style={styles.ctbStatItem}>
          <ThemedText style={styles.ctbStatValue}>
            {formatVolume(currentCTB.unpackedVolume ?? 0)}
          </ThemedText>
          <ThemedText style={styles.ctbStatLabel}>Capacity</ThemedText>
        </View>
      </View>

      {/* CTB Stats - Secondary */}
      <View style={styles.ctbStatsSecondary}>
        <View style={styles.ctbStatItemSecondary}>
          <ThemedText style={styles.ctbStatValueSecondary}>{items.length}</ThemedText>
          <ThemedText style={styles.ctbStatLabelSecondary}>Items</ThemedText>
        </View>
        <View style={styles.ctbStatItemSecondary}>
          <ThemedText style={styles.ctbStatValueSecondary}>
            {childCTBs.length}
          </ThemedText>
          <ThemedText style={styles.ctbStatLabelSecondary}>Nested</ThemedText>
        </View>
        {(currentCTB.nestingDepth ?? 0) > 0 && (
          <View style={styles.ctbStatItemSecondary}>
            <ThemedText style={styles.ctbStatValueSecondary}>
              {currentCTB.nestingDepth}/{MAX_NESTING_DEPTH}
            </ThemedText>
            <ThemedText style={styles.ctbStatLabelSecondary}>Depth</ThemedText>
          </View>
        )}
      </View>

      {/* NFC Tag Info */}
      {currentCTB.rfidTag && (
        <View style={styles.nfcTagInfo}>
          <View style={styles.nfcTagRow}>
            <View style={styles.nfcTagIcon}>
              <Ionicons
                name="radio-outline"
                size={18}
                color={currentCTB.rfidTag.id && !currentCTB.rfidTag.id.startsWith('RFID-') ? Colors.success : Colors.textTertiary}
              />
            </View>
            <View style={styles.nfcTagDetails}>
              <ThemedText style={styles.nfcTagLabel}>NFC Tag</ThemedText>
              <ThemedText style={styles.nfcTagId}>
                {currentCTB.rfidTag.id && !currentCTB.rfidTag.id.startsWith('RFID-')
                  ? `Assigned: ${currentCTB.rfidTag.id.slice(0, 12)}...`
                  : 'Not assigned'}
              </ThemedText>
            </View>
            {nfcSupported && (
              <Pressable
                style={styles.nfcScanButton}
                onPress={() => setShowNFCScanner(true)}
              >
                <Ionicons name="scan" size={16} color={Colors.blue} />
                <ThemedText style={styles.nfcScanButtonText}>
                  {currentCTB.rfidTag.id && !currentCTB.rfidTag.id.startsWith('RFID-') ? 'Reassign' : 'Assign'}
                </ThemedText>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Receive Button - show for incoming CTBs */}
      {canReceive && navigationStack.length === 0 && (
        <Pressable
          style={({ pressed }) => [
            styles.receiveButton,
            pressed && styles.receiveButtonPressed,
          ]}
          onPress={() => {
            if (onReceive) {
              // Caller handles its own confirmation
              onReceive(currentCTB.id);
            } else {
              Alert.alert(
                "Receive CTB",
                `Confirm receipt of ${currentCTB.id}?\n\nThis will move the CTB and its contents to stock.`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Confirm Receipt",
                    onPress: () => {
                      receiveCTB(currentCTB.id);
                      Alert.alert("Success", `${currentCTB.id} received into inventory`);
                    }
                  }
                ]
              );
            }
          }}
        >
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <ThemedText style={styles.receiveButtonText}>Receive CTB</ThemedText>
        </Pressable>
      )}

      {/* Nested CTBs Section */}
      {childCTBs.length > 0 && (
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Nested CTBs</ThemedText>
          {childCTBs.map((child) => (
            <Pressable
              key={child.id}
              style={({ pressed }) => [
                styles.listRow,
                pressed && styles.listRowPressed,
              ]}
              onPress={() => handleDrillDown(child)}
            >
              <View style={styles.listIcon}>
                <Ionicons name="cube-outline" size={24} color={Colors.blue} />
              </View>
              <View style={styles.listInfo}>
                <ThemedText style={styles.listTitle}>{child.id}</ThemedText>
                <ThemedText style={styles.listMeta}>
                  Size {child.size} • {child.mass}kg
                </ThemedText>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={Colors.textTertiary}
              />
            </Pressable>
          ))}
        </View>
      )}

      {/* Items Section */}
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Contents</ThemedText>
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="cube-outline"
              size={40}
              color={Colors.textTertiary}
            />
            <ThemedText style={styles.emptyText}>
              No items in this CTB
            </ThemedText>
          </View>
        ) : (
          items.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.listRow,
                pressed && styles.listRowPressed,
              ]}
              onPress={() => handleSelectItem(item)}
            >
              <View
                style={[styles.listIcon, { backgroundColor: Colors.blueGlow }]}
              >
                <Ionicons
                  name={getCategoryIcon(item.category)}
                  size={20}
                  color={Colors.blue}
                />
              </View>
              <View style={styles.listInfo}>
                <ThemedText style={styles.listTitle}>{item.name}</ThemedText>
                <ThemedText style={styles.listMeta}>
                  Qty: {item.quantity} • {item.mass}kg
                </ThemedText>
              </View>
              <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
                <ThemedText style={styles.statusText}>
                  {item.status.toUpperCase()}
                </ThemedText>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={Colors.textTertiary}
              />
            </Pressable>
          ))
        )}
      </View>

      {/* CTB Actions Section */}
      <View style={styles.actionsSection}>
        <ThemedText style={styles.sectionTitle}>CTB Actions</ThemedText>

        {/* Delete CTB */}
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            styles.actionButtonDanger,
            pressed && styles.actionButtonPressed,
          ]}
          onPress={handleDeleteCTB}
        >
          <View style={[styles.actionIcon, styles.actionIconDanger]}>
            <Ionicons name="trash" size={20} color={Colors.error} />
          </View>
          <View style={styles.actionInfo}>
            <ThemedText style={styles.actionTitleDanger}>Delete CTB</ThemedText>
            <ThemedText style={styles.actionSubtitle}>
              Remove CTB and all contents
            </ThemedText>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={Colors.textTertiary}
          />
        </Pressable>
      </View>
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            {canGoBack ? (
              <Pressable onPress={handleGoBack} style={styles.backButton}>
                <Ionicons name="chevron-back" size={24} color={Colors.blue} />
                <ThemedText style={styles.backText}>Back</ThemedText>
              </Pressable>
            ) : (
              <View style={styles.headerSpacer} />
            )}

            <ThemedText style={styles.headerTitle}>
              {viewMode === "item" ? "Item Details" : "CTB Viewer"}
            </ThemedText>

            <Pressable onPress={onClose} style={styles.doneButton}>
              <ThemedText style={styles.doneText}>Done</ThemedText>
            </Pressable>
          </View>

          {/* Breadcrumb */}
          <View style={styles.breadcrumb}>
            <Ionicons name="cube" size={14} color={Colors.textSecondary} />
            <ThemedText style={styles.breadcrumbText}>
              {navigationStack.map((c) => c.id).join(" › ")}
              {navigationStack.length > 0 ? " › " : ""}
              {currentCTB.id}
              {viewMode === "item" && selectedItem
                ? ` › ${selectedItem.name}`
                : ""}
            </ThemedText>
          </View>
        </View>

        {viewMode === "item" ? renderItemView() : renderCTBView()}

        {/* Relocate Item Modal */}
        <RelocateItemModal
          visible={showRelocateModal}
          item={selectedItem}
          onClose={() => setShowRelocateModal(false)}
          onRelocated={handleItemRelocated}
        />

        {/* Item Notes Modal */}
        <ItemNotesModal
          visible={showNotesModal}
          item={selectedItem}
          onClose={() => setShowNotesModal(false)}
          onSave={handleSaveNotes}
        />

        {/* Delete CTB Confirmation Modal */}
        <Modal
          visible={showDeleteCTBModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowDeleteCTBModal(false)}
        >
          <Pressable
            style={styles.deleteModalOverlay}
            onPress={() => setShowDeleteCTBModal(false)}
          >
            <Pressable style={styles.deleteModalContent} onPress={() => {}}>
              <View style={styles.deleteModalIcon}>
                <Ionicons name="warning" size={32} color={Colors.error} />
              </View>
              <ThemedText style={styles.deleteModalTitle}>
                Delete CTB
              </ThemedText>
              <ThemedText style={styles.deleteModalMessage}>
                This will permanently delete {currentCTB?.id} and all{" "}
                {items.length} items inside it.
                {"\n\n"}
                Enter password to confirm:
              </ThemedText>
              <TextInput
                style={styles.deleteModalInput}
                value={ctbDeletePassword}
                onChangeText={setCTBDeletePassword}
                placeholder="Enter 'delete' or PIN"
                placeholderTextColor={Colors.textTertiary}
                secureTextEntry
                autoCapitalize="none"
              />
              <View style={styles.deleteModalButtons}>
                <Pressable
                  style={[
                    styles.deleteModalButton,
                    styles.deleteModalButtonCancel,
                  ]}
                  onPress={() => setShowDeleteCTBModal(false)}
                >
                  <ThemedText style={styles.deleteModalButtonTextCancel}>
                    Cancel
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.deleteModalButton,
                    styles.deleteModalButtonConfirm,
                  ]}
                  onPress={confirmDeleteCTB}
                >
                  <ThemedText style={styles.deleteModalButtonTextConfirm}>
                    Delete
                  </ThemedText>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* NFC Scanner Modal for assigning tags */}
        <NFCScannerModal
          visible={showNFCScanner}
          mode="write"
          writeData={currentCTB?.id}
          title="Assign NFC Tag"
          subtitle={`Hold device near NFC tag to assign it to ${currentCTB?.id}`}
          onClose={() => setShowNFCScanner(false)}
          onWriteSuccess={(result) => {
            if (result.success) {
              Alert.alert('Success', `NFC tag assigned to ${currentCTB?.id}`);
            }
            setShowNFCScanner(false);
          }}
        />

        {/* Undo Toast */}
        <UndoToast
          visible={showUndoToast}
          message={undoMessage}
          duration={5000}
          onUndo={handleUndoDelete}
          onDismiss={handleConfirmDelete}
        />
      </ThemedView>
    </Modal>
  );
}

// Helper functions
function getCategoryIcon(category: string): keyof typeof Ionicons.glyphMap {
  switch (category) {
    case "food":
      return "restaurant";
    case "medical":
      return "medical";
    case "spare-parts":
      return "construct";
    case "scientific-equipment":
      return "flask";
    case "lunar-equipment":
      return "planet";
    default:
      return "cube";
  }
}

function getStatusStyle(status: string) {
  switch (status) {
    case "incoming":
      return { backgroundColor: "rgba(234, 179, 8, 0.2)" };
    case "stock":
      return { backgroundColor: "rgba(16, 185, 129, 0.2)" };
    case "consumed":
      return { backgroundColor: "rgba(107, 114, 128, 0.2)" };
    case "waste":
      return { backgroundColor: "rgba(239, 68, 68, 0.2)" };
    default:
      return { backgroundColor: Colors.surface };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    height: 56,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 70,
  },
  backText: {
    color: Colors.blue,
    fontSize: 17,
  },
  doneButton: {
    minWidth: 70,
    alignItems: "flex-end",
  },
  doneText: {
    color: Colors.blue,
    fontSize: 17,
    fontWeight: "600",
  },
  headerSpacer: {
    minWidth: 70,
  },
  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 6,
    marginTop: 4,
  },
  breadcrumbText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  // CTB Stats
  ctbStats: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  ctbStatItem: {
    flex: 1,
    alignItems: "center",
  },
  ctbStatValue: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  ctbStatLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  // Secondary stats row
  ctbStatsSecondary: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ctbStatItemSecondary: {
    flex: 1,
    alignItems: "center",
  },
  ctbStatValueSecondary: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  ctbStatLabelSecondary: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  // NFC Tag Info
  nfcTagInfo: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  nfcTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  nfcTagIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.blueGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  nfcTagDetails: {
    flex: 1,
  },
  nfcTagLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  nfcTagId: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontFamily: "monospace",
  },
  nfcScanButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.blueGlow,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.blue,
  },
  nfcScanButtonText: {
    fontSize: 13,
    color: Colors.blue,
    fontWeight: "600",
  },
  // Receive button
  receiveButton: {
    backgroundColor: Colors.success,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  receiveButtonPressed: {
    opacity: 0.8,
  },
  receiveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  // List rows
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  listRowPressed: {
    opacity: 0.7,
  },
  listIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  listInfo: {
    flex: 1,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  listMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  // Status badges
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  statusBadgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
  },
  statusTextLarge: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  // Item view
  itemHeader: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 16,
  },
  itemIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: Colors.blueGlow,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  itemTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  // Detail section
  detailSection: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
    marginLeft: 16,
  },
  // Sub-items
  subItemCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  subItemName: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  subItemQty: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  // Actions section
  actionsSection: {
    marginTop: 8,
    marginBottom: 32,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  actionButtonPressed: {
    opacity: 0.7,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.blueGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  actionButtonSpaced: {
    marginTop: 8,
  },
  actionButtonWarn: {
    backgroundColor: "rgba(255, 214, 10, 0.08)",
  },
  actionIconWarn: {
    backgroundColor: "rgba(255, 214, 10, 0.15)",
  },
  actionTitleWarn: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.warning,
    marginBottom: 2,
  },
  actionButtonDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  actionIconDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  actionTitleDanger: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.error,
    marginBottom: 2,
  },
  // Notes styles
  notesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  editNotesButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  editNotesText: {
    fontSize: 13,
    color: Colors.blue,
    fontWeight: "500",
  },
  notesText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  notesPlaceholder: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontStyle: "italic",
  },
  // Delete CTB Modal styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  deleteModalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  deleteModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  deleteModalMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  deleteModalInput: {
    width: "100%",
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: "center",
    marginBottom: 20,
  },
  deleteModalButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  deleteModalButtonCancel: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  deleteModalButtonConfirm: {
    backgroundColor: Colors.error,
  },
  deleteModalButtonTextCancel: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  deleteModalButtonTextConfirm: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // Incoming notice styles
  incomingNotice: {
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  incomingNoticeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(234, 179, 8, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  incomingNoticeContent: {
    flex: 1,
    minWidth: 150,
  },
  incomingNoticeTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.warning,
    marginBottom: 2,
  },
  incomingNoticeText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  incomingNoticeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  incomingNoticeButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.blue,
  },
});
