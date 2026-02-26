import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { Colors } from "../constants/colors";
import type { InventoryItem } from "../types/dslm";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

type Props = {
  visible: boolean;
  item: InventoryItem | null;
  onClose: () => void;
  onSave: (item: InventoryItem, notes: string) => void;
};

export function ItemNotesModal({ visible, item, onClose, onSave }: Props) {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (visible && item) {
      setNotes(item.notes || "");
    }
  }, [visible, item]);

  const handleSave = () => {
    if (item) {
      onSave(item, notes.trim());
      onClose();
    }
  };

  if (!item) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ThemedView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.cancelButton}>
              <ThemedText style={styles.cancelText}>Cancel</ThemedText>
            </Pressable>

            <ThemedText style={styles.headerTitle}>Item Notes</ThemedText>

            <Pressable onPress={handleSave} style={styles.saveButton}>
              <ThemedText style={styles.saveText}>Save</ThemedText>
            </Pressable>
          </View>

          {/* Item Info */}
          <View style={styles.itemInfo}>
            <View style={styles.itemIcon}>
              <Ionicons name="cube" size={24} color={Colors.blue} />
            </View>
            <View style={styles.itemDetails}>
              <ThemedText style={styles.itemName}>{item.name}</ThemedText>
              <ThemedText style={styles.itemId}>{item.id}</ThemedText>
            </View>
          </View>

          {/* Notes Input */}
          <View style={styles.inputContainer}>
            <ThemedText style={styles.inputLabel}>Notes</ThemedText>
            <TextInput
              style={styles.textInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes about this item..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              autoFocus
            />
          </View>

          {/* Tips */}
          <View style={styles.tipsContainer}>
            <Ionicons
              name="information-circle"
              size={16}
              color={Colors.textSecondary}
            />
            <ThemedText style={styles.tipsText}>
              Notes are synced with the inventory database and visible to all
              crew members.
            </ThemedText>
          </View>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
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
    backgroundColor: Colors.surface,
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
    fontSize: 17,
    color: Colors.blue,
  },
  saveButton: {
    minWidth: 60,
    alignItems: "flex-end",
  },
  saveText: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.blue,
  },
  itemInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: Colors.surface,
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
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
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  itemId: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  inputContainer: {
    marginTop: 20,
    marginHorizontal: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.textPrimary,
    minHeight: 180,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tipsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    marginTop: 16,
    marginHorizontal: 16,
    gap: 8,
  },
  tipsText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
