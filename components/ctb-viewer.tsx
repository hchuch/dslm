import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { Colors } from "../constants/colors";
import { useDialog, DialogOverlay } from '../hooks/use-dialog';
import { useAuth } from "../contexts/auth-context";
import { useInventory, MAX_NESTING_DEPTH } from "../hooks/use-inventory";
import { useNFC } from "../hooks/use-nfc";
import { createHistoryEntry, updateCTB as updateCTBInDb } from "../services/local-db";
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
  initialItem?: InventoryItem | null;
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
    updateCTBTag,
    deleteItem,
    deleteCTB,
    receiveCTB,
    consumeItem,
    markAsWaste,
    relocateCTB,
    takeOutCTB,
    returnCTB,
    ctbs: allCTBs,
  } = useInventory();

  const { user } = useAuth();
  const { isSupported: nfcSupported } = useNFC();
  const { showDialog } = useDialog();

  const [currentCTB, setCurrentCTB] = useState<CTB | null>(ctb);
  const [navigationStack, setNavigationStack] = useState<CTB[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("ctb");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showRelocateModal, setShowRelocateModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showDeleteCTBModal, setShowDeleteCTBModal] = useState(false);
  const [ctbDeletePassword, setCTBDeletePassword] = useState("");
  const [showMoveCTBModal, setShowMoveCTBModal] = useState(false);
  const [moveTargetStack, setMoveTargetStack] = useState<string>("S1");
  const [moveTargetPosition, setMoveTargetPosition] = useState("");

  const [showUndoToast, setShowUndoToast] = useState(false);
  const [undoMessage, setUndoMessage] = useState("");
  const pendingDeleteRef = useRef<{
    type: "item" | "ctb";
    id: string;
    data: InventoryItem | CTB;
  } | null>(null);

  const [showNFCScanner, setShowNFCScanner] = useState(false);

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
    showDialog(
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
    showDialog(
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
    setSelectedItem({ ...item, notes });
  };

  const handleDeleteItem = () => {
    if (!selectedItem) return;

    showDialog(
      "Delete Item",
      `Are you sure you want to delete "${selectedItem.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            pendingDeleteRef.current = {
              type: "item",
              id: selectedItem.id,
              data: selectedItem,
            };
            setUndoMessage(`"${selectedItem.name}" deleted`);
            setShowUndoToast(true);

            setViewMode("ctb");
            setSelectedItem(null);
          },
        },
      ],
    );
  };

  const handleUndoDelete = () => {
    pendingDeleteRef.current = null;
    setShowUndoToast(false);
  };

  const handleConfirmDelete = () => {
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
    if (
      ctbDeletePassword.toLowerCase() === "delete" ||
      ctbDeletePassword === "1234"
    ) {
      if (currentCTB) {
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
      showDialog(
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
    setSelectedItem({
      ...item,
      location: newLocation,
      ctbId: newCtbId,
    });
    const newCTB = findCTBById(newCtbId);
    if (newCTB) {
      setCurrentCTB(newCTB);
    }
  };

  const handleMoveCTB = () => {
    if (!currentCTB) return;
    setMoveTargetStack(currentCTB.location.stack === "INCOMING" ? "S1" : currentCTB.location.stack);
    setMoveTargetPosition("");
    setShowMoveCTBModal(true);
  };

  const confirmMoveCTB = async () => {
    if (!currentCTB) return;
    const pos = parseInt(moveTargetPosition, 10);
    if (!pos || pos < 1 || pos > 16) {
      showDialog("Invalid Position", "Please enter a position between 1 and 16.");
      return;
    }
    const newLocation: Location = {
      stack: moveTargetStack as Location["stack"],
      position: pos,
      layer: 1,
      path: `${moveTargetStack}-P${pos}-L1`,
    };
    setShowMoveCTBModal(false);
    if (currentCTB.isOutside) {
      await updateCTBInDb(currentCTB.id, { isOutside: false, previousLocation: undefined });
    }
    await relocateCTB(currentCTB.id, newLocation, user?.id);
    setCurrentCTB({ ...currentCTB, location: newLocation, isOutside: false, previousLocation: undefined });
  };

  const handleTakeOutCTB = () => {
    if (!currentCTB) return;
    showDialog(
      "Take Out CTB",
      `Remove ${currentCTB.id} from ${currentCTB.location.path}? You can return it later.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Take Out",
          onPress: async () => {
            await takeOutCTB(currentCTB.id, user?.id);
            setCurrentCTB({ ...currentCTB, isOutside: true, previousLocation: currentCTB.location });
          },
        },
      ],
    );
  };

  const handleReturnCTB = () => {
    if (!currentCTB || !currentCTB.previousLocation) return;

    const prevLoc = currentCTB.previousLocation;
    const slotsForCTB = Math.max(1, Math.ceil(currentCTB.size));
    const isOccupied = allCTBs.some((c) => {
      if (c.id === currentCTB.id || c.location.stack !== prevLoc.stack || c.isOutside) return false;
      const cSlots = Math.max(1, Math.ceil(c.size));
      const cEnd = c.location.position + cSlots - 1;
      const myEnd = prevLoc.position + slotsForCTB - 1;
      return c.location.position <= myEnd && cEnd >= prevLoc.position;
    });

    if (isOccupied) {
      showDialog(
        "Position Occupied",
        `${prevLoc.path} is no longer free. Use Move CTB to place it in a new position.`,
        [{ text: "OK" }],
      );
      return;
    }

    showDialog(
      "Return to Stack",
      `Return ${currentCTB.id} to its original position at ${prevLoc.path}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Return",
          onPress: async () => {
            await returnCTB(currentCTB.id, user?.id);
            setCurrentCTB({ ...currentCTB, isOutside: false, previousLocation: undefined, location: prevLoc });
          },
        },
      ],
    );
  };

  const handleDeleteNFCTag = () => {
    if (!currentCTB) return;
    showDialog(
      "Remove NFC Tag",
      `Remove the NFC tag assignment from ${currentCTB.id}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const defaultTag = {
              type: "RFID" as const,
              id: `RFID-${currentCTB.id}`,
              assignedDate: new Date(),
            };
            await updateCTBTag(currentCTB.id, defaultTag);
            setCurrentCTB({ ...currentCTB, rfidTag: defaultTag });
          },
        },
      ],
    );
  };

  const slotsNeeded = currentCTB ? Math.max(1, Math.ceil(currentCTB.size)) : 1;

  const occupiedPositions = useMemo(() => {
    if (!currentCTB) return new Set<number>();
    const occupied = new Set<number>();
    const stackCtbs = allCTBs.filter(
      (c) => c.location.stack === moveTargetStack && c.id !== currentCTB.id,
    );
    for (const c of stackCtbs) {
      const slots = Math.max(1, Math.ceil(c.size));
      for (let p = c.location.position; p < c.location.position + slots; p++) {
        occupied.add(p);
      }
    }
    return occupied;
  }, [allCTBs, moveTargetStack, currentCTB]);

  const canFitAtPosition = useCallback(
    (pos: number) => {
      if (pos + slotsNeeded - 1 > 16) return false;
      for (let p = pos; p < pos + slotsNeeded; p++) {
        if (occupiedPositions.has(p)) return false;
      }
      return true;
    },
    [occupiedPositions, slotsNeeded],
  );

  // findCTBById excluded from deps — its identity changes on every context
  // update, which would reset local state and revert in-flight edits.
  const prevVisibleRef = useRef(false);
  useEffect(() => {
    const justOpened = visible && !prevVisibleRef.current;
    prevVisibleRef.current = visible;

    if (!justOpened) return;

    if (initialItem) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ctb, initialItem]);

  if (!currentCTB) return null;

  const childCTBs = getChildCTBs(currentCTB.id);
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
      setViewMode("ctb");
      setSelectedItem(null);
    } else if (navigationStack.length > 0) {
      const parent = navigationStack[navigationStack.length - 1];
      setNavigationStack((prev) => prev.slice(0, -1));
      setCurrentCTB(parent);
    }
  };

  const canGoBack = viewMode === "item" || navigationStack.length > 0;

  const renderItemView = () => {
    if (!selectedItem) return null;

    const isItemIncoming = selectedItem.status === "incoming";

    return (
      <ScrollView style={styles.content}>
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

        <View style={styles.actionsSection}>
          <ThemedText style={styles.sectionTitle}>Actions</ThemedText>

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

          {(selectedItem.status === "stock" || selectedItem.status === "delivered") && (
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

  const formatVolume = (volumeM3: number): string => {
    return `${Math.round(volumeM3 * 1000)}L`;
  };

  const renderCTBView = () => (
    <ScrollView style={styles.content}>
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

      {currentCTB.rfidTag && nfcSupported && (!currentCTB.rfidTag.id || currentCTB.rfidTag.id.startsWith('RFID-')) && (
        <Pressable
          style={({ pressed }) => [
            styles.nfcAssignCTA,
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => setShowNFCScanner(true)}
        >
          <View style={styles.nfcAssignCTAIcon}>
            <Ionicons name="radio-outline" size={28} color={Colors.warning} />
          </View>
          <View style={styles.nfcAssignCTAContent}>
            <ThemedText style={styles.nfcAssignCTATitle}>No NFC Tag Assigned</ThemedText>
            <ThemedText style={styles.nfcAssignCTASubtitle}>
              Tap to scan and assign a tag for tracking
            </ThemedText>
          </View>
          <View style={styles.nfcAssignCTAButton}>
            <Ionicons name="scan" size={18} color="#000" />
            <ThemedText style={styles.nfcAssignCTAButtonText}>Scan</ThemedText>
          </View>
        </Pressable>
      )}

      {currentCTB.rfidTag && currentCTB.rfidTag.id && !currentCTB.rfidTag.id.startsWith('RFID-') && (
        <View style={styles.nfcTagInfo}>
          <View style={styles.nfcTagRow}>
            <View style={[styles.nfcTagIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="radio-outline" size={18} color={Colors.success} />
            </View>
            <View style={styles.nfcTagDetails}>
              <ThemedText style={styles.nfcTagLabel}>NFC Tag</ThemedText>
              <ThemedText style={styles.nfcTagId}>
                {`Assigned: ${currentCTB.rfidTag.id.slice(0, 12)}...`}
              </ThemedText>
            </View>
            {nfcSupported && (
              <View style={styles.nfcTagActions}>
                <Pressable
                  style={styles.nfcScanButton}
                  onPress={() => setShowNFCScanner(true)}
                >
                  <Ionicons name="scan" size={16} color={Colors.blue} />
                  <ThemedText style={styles.nfcScanButtonText}>Reassign</ThemedText>
                </Pressable>
                <Pressable
                  style={styles.nfcDeleteButton}
                  onPress={handleDeleteNFCTag}
                >
                  <Ionicons name="close-circle" size={16} color={Colors.error} />
                  <ThemedText style={styles.nfcDeleteButtonText}>Remove</ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      )}

      {canReceive && navigationStack.length === 0 && (
        <Pressable
          style={({ pressed }) => [
            styles.receiveButton,
            pressed && styles.receiveButtonPressed,
          ]}
          onPress={() => {
            if (onReceive) {
              onReceive(currentCTB.id);
            } else {
              showDialog(
                "Receive CTB",
                `Confirm receipt of ${currentCTB.id}?\n\nThis will move the CTB and its contents to stock.`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Confirm Receipt",
                    onPress: () => {
                      receiveCTB(currentCTB.id);
                      showDialog("Success", `${currentCTB.id} received into inventory`);
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

      <View style={styles.actionsSection}>
        <ThemedText style={styles.sectionTitle}>CTB Actions</ThemedText>

        {!isIncomingCTB && !currentCTB.isOutside && (
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.actionButtonWarn,
              pressed && styles.actionButtonPressed,
            ]}
            onPress={handleTakeOutCTB}
          >
            <View style={[styles.actionIcon, styles.actionIconWarn]}>
              <Ionicons name="log-out-outline" size={20} color={Colors.warning} />
            </View>
            <View style={styles.actionInfo}>
              <ThemedText style={styles.actionTitleWarn}>Take Out</ThemedText>
              <ThemedText style={styles.actionSubtitle}>
                Remove from stack for access
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </Pressable>
        )}

        {currentCTB.isOutside && currentCTB.previousLocation && (
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
            ]}
            onPress={handleReturnCTB}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="log-in-outline" size={20} color={Colors.blue} />
            </View>
            <View style={styles.actionInfo}>
              <ThemedText style={styles.actionTitle}>Return to Stack</ThemedText>
              <ThemedText style={styles.actionSubtitle}>
                Restore to {currentCTB.previousLocation.path}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </Pressable>
        )}

        {!isIncomingCTB && (
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
              styles.actionButtonSpaced,
            ]}
            onPress={handleMoveCTB}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="swap-horizontal" size={20} color={Colors.blue} />
            </View>
            <View style={styles.actionInfo}>
              <ThemedText style={styles.actionTitle}>Move CTB</ThemedText>
              <ThemedText style={styles.actionSubtitle}>
                {currentCTB.isOutside ? "Place in a stack position" : "Relocate to a different stack position"}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            styles.actionButtonDanger,
            pressed && styles.actionButtonPressed,
            styles.actionButtonSpaced,
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

        <RelocateItemModal
          visible={showRelocateModal}
          item={selectedItem}
          onClose={() => setShowRelocateModal(false)}
          onRelocated={handleItemRelocated}
        />

        <ItemNotesModal
          visible={showNotesModal}
          item={selectedItem}
          onClose={() => setShowNotesModal(false)}
          onSave={handleSaveNotes}
        />

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

        <Modal
          visible={showMoveCTBModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowMoveCTBModal(false)}
        >
          <Pressable
            style={styles.deleteModalOverlay}
            onPress={() => setShowMoveCTBModal(false)}
          >
            <Pressable style={styles.deleteModalContent} onPress={() => {}}>
              <View style={[styles.deleteModalIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Ionicons name="swap-horizontal" size={32} color={Colors.blue} />
              </View>
              <ThemedText style={styles.deleteModalTitle}>
                Move CTB
              </ThemedText>
              <ThemedText style={styles.deleteModalMessage}>
                Select a destination stack and position for {currentCTB?.id}.
              </ThemedText>

              <View style={styles.moveStackPicker}>
                {(["S1", "S2", "S3", "C1", "C2"] as const).map((stackId) => (
                  <Pressable
                    key={stackId}
                    style={[
                      styles.moveStackButton,
                      moveTargetStack === stackId && styles.moveStackButtonActive,
                    ]}
                    onPress={() => {
                      setMoveTargetStack(stackId);
                      setMoveTargetPosition("");
                    }}
                  >
                    <ThemedText
                      style={[
                        styles.moveStackButtonText,
                        moveTargetStack === stackId && styles.moveStackButtonTextActive,
                      ]}
                    >
                      {stackId}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <ThemedText style={styles.movePositionLabel}>
                {slotsNeeded > 1
                  ? `Starting position (needs ${slotsNeeded} consecutive slots)`
                  : "Position (1–16)"}
              </ThemedText>
              <View style={styles.movePositionGrid}>
                {Array.from({ length: 16 }, (_, i) => i + 1).map((pos) => {
                  const isOccupied = occupiedPositions.has(pos);
                  const canFit = canFitAtPosition(pos);
                  const selectedPos = moveTargetPosition ? parseInt(moveTargetPosition, 10) : 0;
                  const isInSpan = selectedPos > 0 && pos >= selectedPos && pos < selectedPos + slotsNeeded;
                  const isDisabled = isOccupied || !canFit;
                  return (
                    <Pressable
                      key={pos}
                      style={[
                        styles.movePositionButton,
                        isOccupied && styles.movePositionOccupied,
                        !isOccupied && !canFit && styles.movePositionCantFit,
                        isInSpan && styles.movePositionSelected,
                      ]}
                      onPress={() => !isDisabled && setMoveTargetPosition(String(pos))}
                      disabled={isDisabled}
                    >
                      <ThemedText
                        style={[
                          styles.movePositionText,
                          isDisabled && styles.movePositionTextOccupied,
                          isInSpan && styles.movePositionTextSelected,
                        ]}
                      >
                        {pos}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.deleteModalButtons}>
                <Pressable
                  style={[styles.deleteModalButton, styles.deleteModalButtonCancel]}
                  onPress={() => setShowMoveCTBModal(false)}
                >
                  <ThemedText style={styles.deleteModalButtonTextCancel}>
                    Cancel
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.deleteModalButton,
                    { backgroundColor: Colors.blue },
                    !moveTargetPosition && { opacity: 0.5 },
                  ]}
                  onPress={confirmMoveCTB}
                  disabled={!moveTargetPosition}
                >
                  <ThemedText style={[styles.deleteModalButtonTextConfirm, { color: '#000' }]}>
                    Move
                  </ThemedText>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <NFCScannerModal
          visible={showNFCScanner}
          mode="write"
          writeData={currentCTB?.id}
          title="Assign NFC Tag"
          subtitle={`Hold device near NFC tag to assign it to ${currentCTB?.id}`}
          onClose={() => setShowNFCScanner(false)}
          onWriteSuccess={async (result) => {
            if (result.success && currentCTB) {
              const newTag = {
                type: "RFID" as const,
                id: result.tagId || `NFC-${Date.now()}`,
                assignedDate: new Date(),
              };
              await updateCTBTag(currentCTB.id, newTag);
              setCurrentCTB({ ...currentCTB, rfidTag: newTag });

              const ctbItemsForLog = getItemsInCTB(currentCTB.id);
              for (const item of ctbItemsForLog) {
                const entry = {
                  timestamp: new Date(),
                  action: "nfc-assigned" as const,
                  userId: user?.id,
                  notes: `NFC tag assigned to CTB ${currentCTB.id}`,
                };
                await createHistoryEntry(item.id, entry);
              }
              showDialog('Success', `NFC tag assigned to ${currentCTB.id}`);
            }
            setShowNFCScanner(false);
          }}
        />

        {/* Dialog overlay — renders inside this Modal so dialogs
            appear above modal content instead of behind it */}
        <DialogOverlay />

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
  nfcAssignCTA: {
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "rgba(234, 179, 8, 0.4)",
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  nfcAssignCTAIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(234, 179, 8, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  nfcAssignCTAContent: {
    flex: 1,
  },
  nfcAssignCTATitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.warning,
    marginBottom: 2,
  },
  nfcAssignCTASubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  nfcAssignCTAButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.warning,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  nfcAssignCTAButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },
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
  nfcTagActions: {
    flexDirection: "row",
    gap: 8,
  },
  nfcDeleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  nfcDeleteButtonText: {
    fontSize: 13,
    color: Colors.error,
    fontWeight: "600",
  },
  moveStackPicker: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    width: "100%",
    justifyContent: "center",
  },
  moveStackButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  moveStackButtonActive: {
    backgroundColor: Colors.blue,
    borderColor: Colors.blue,
  },
  moveStackButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  moveStackButtonTextActive: {
    color: "#000",
  },
  movePositionLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    textAlign: "center",
  },
  movePositionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    marginBottom: 20,
    width: "100%",
  },
  movePositionButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  movePositionOccupied: {
    backgroundColor: "rgba(107, 114, 128, 0.15)",
    borderColor: "rgba(107, 114, 128, 0.3)",
  },
  movePositionCantFit: {
    backgroundColor: "rgba(107, 114, 128, 0.08)",
    borderColor: "rgba(107, 114, 128, 0.15)",
    borderStyle: "dashed" as const,
  },
  movePositionSelected: {
    backgroundColor: Colors.blue,
    borderColor: Colors.blue,
  },
  movePositionText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  movePositionTextOccupied: {
    color: Colors.textTertiary,
  },
  movePositionTextSelected: {
    color: "#000",
  },
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
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
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
