import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CTBViewer } from "../../components/ctb-viewer";
import { NFCScannerModal } from "../../components/nfc-scanner-modal";
import { OfflineBanner } from "../../components/offline-banner";
import { ThemedText } from "../../components/themed-text";
import { ThemedView } from "../../components/themed-view";
import { Colors } from "../../constants/colors";
import { useAuth } from "../../contexts/auth-context";
import { useDialog } from '../../hooks/use-dialog';
import { useInventory } from "../../hooks/use-inventory";
import { useNFC, ScannedTag } from "../../hooks/use-nfc";
import type { CTB, InventoryItem } from "../../types/dslm";

export default function HomeScreen() {
  const {
    inventoryItems,
    ctbs,
    wasteItems,
    getExpiringItems,
    getIncomingCTBs,
    getWasteVolume,
    findCTBById,
  } = useInventory();
  const { user, logout } = useAuth();
  const router = useRouter();
  const { scanTag, isSupported, isScanning } = useNFC();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedCTB, setSelectedCTB] = useState<CTB | null>(null);
  const [activeFilter, setActiveFilter] = useState<
    "all" | "ctbs" | "important" | "expiring"
  >("ctbs");

  const [showNFCScanner, setShowNFCScanner] = useState(false);
  const [showAllCTBs, setShowAllCTBs] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);
  const { showDialog } = useDialog();

  const handleNFCScanSuccess = (tag: ScannedTag) => {
    const tagId = tag.payload || tag.id;

    let matchedCTB = ctbs.find(
      (ctb) =>
        ctb.rfidTag?.id === tagId ||
        ctb.id === tagId ||
        ctb.id.includes(tagId)
    );

    if (!matchedCTB) {
      matchedCTB = ctbs.find((ctb) =>
        tagId.includes(ctb.id) || ctb.id.includes(tagId)
      );
    }

    if (matchedCTB) {
      setSelectedCTB(matchedCTB);
      setSelectedItem(null);
      return;
    }

    const matchedItem = inventoryItems.find(
      (item) =>
        item.rfidTag?.id === tagId ||
        item.barcode === tagId ||
        item.id === tagId,
    );
    if (matchedItem) {
      const itemCTB = findCTBById(matchedItem.ctbId);
      if (itemCTB) setSelectedCTB(itemCTB);
      setSelectedItem(matchedItem);
      return;
    }

    showDialog(
      "Tag Not Found",
      `No CTB or item found matching tag: ${tagId}`,
      [
        { text: "Search", onPress: () => setSearchQuery(tagId) },
        { text: "OK", style: "cancel" }
      ]
    );
  };

  const handleScan = () => {
    setShowNFCScanner(true);
  };

  const handleLogout = () => {
    showDialog("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          logout();
          router.replace("/");
        },
      },
    ]);
  };

  const incomingCTBs = useMemo(() => getIncomingCTBs(), [getIncomingCTBs]);

  const wasteAndConsumedCount = useMemo(
    () => inventoryItems.filter((i) => i.status === 'waste' || i.status === 'consumed').length,
    [inventoryItems],
  );

  const stats = useMemo(
    () => ({
      totalItems: inventoryItems.length,
      totalCTBs: ctbs.length,
      incomingCTBCount: incomingCTBs.length,
      expiringItems: getExpiringItems(30).length,
    }),
    [inventoryItems, ctbs, incomingCTBs, getExpiringItems],
  );

  const recentActivity = useMemo(() => {
    const entries: { item: InventoryItem; entry: InventoryItem["history"][0] }[] = [];
    for (const item of inventoryItems) {
      for (const entry of item.history) {
        entries.push({ item, entry });
      }
    }
    return entries
      .sort((a, b) => new Date(b.entry.timestamp).getTime() - new Date(a.entry.timestamp).getTime())
      .slice(0, 5);
  }, [inventoryItems]);

  const criticalLowStock = useMemo(
    () =>
      inventoryItems.filter(
        (i) =>
          i.criticality === "critical" &&
          i.quantity <= 2 &&
          i.status !== "consumed" &&
          i.status !== "waste",
      ),
    [inventoryItems],
  );

  const filteredItems = useMemo(() => {
    let items = inventoryItems;
    if (activeFilter === "expiring") items = getExpiringItems(30);

    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.location.path.toLowerCase().includes(query) ||
        item.ctbId.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query),
    );
  }, [
    inventoryItems,
    searchQuery,
    activeFilter,
    getExpiringItems,
  ]);

  const filteredCTBs = useMemo(() => {
    if (!searchQuery) return ctbs;
    const query = searchQuery.toLowerCase();
    return ctbs.filter(
      (ctb) =>
        ctb.id.toLowerCase().includes(query) ||
        ctb.location.path.toLowerCase().includes(query) ||
        ctb.rfidTag?.id?.toLowerCase().includes(query),
    );
  }, [ctbs, searchQuery]);

  const groupedItems = useMemo(() => {
    const incoming = filteredItems.filter((i) => i.status === "incoming");
    const stock = filteredItems.filter(
      (i) => i.status === "stock" || i.status === "delivered",
    );
    return { incoming, stock };
  }, [filteredItems]);

  const handleItemPress = (item: InventoryItem) => {
    const itemCTB = findCTBById(item.ctbId);
    if (itemCTB) setSelectedCTB(itemCTB);
    setSelectedItem(item);
  };

  const handleCTBPress = (ctb: CTB) => {
    setSelectedCTB(ctb);
    setSelectedItem(null);
  };

  const renderCTB = (ctb: CTB) => {
    const itemCount = inventoryItems.filter((i) => i.ctbId === ctb.id).length;
    // Check if CTB has a real NFC tag assigned (not just the default RFID-xxx)
    const hasNFCTag = ctb.rfidTag?.id && !ctb.rfidTag.id.startsWith('RFID-');

    return (
      <Pressable
        key={ctb.id}
        style={styles.itemRow}
        onPress={() => handleCTBPress(ctb)}
      >
        <View style={[styles.itemIcon, { backgroundColor: Colors.blueGlow }]}>
          <Ionicons name="cube-outline" size={20} color={Colors.blue} />
        </View>
        <View style={styles.itemInfo}>
          <View style={styles.itemNameRow}>
            <ThemedText numberOfLines={1} style={styles.itemName}>
              {ctb.id}
            </ThemedText>
            {hasNFCTag && (
              <View style={styles.nfcBadge}>
                <Ionicons name="radio-outline" size={10} color={Colors.success} />
              </View>
            )}
          </View>
          <ThemedText style={styles.itemMeta}>{ctb.location.path}</ThemedText>
        </View>
        <View style={styles.itemRight}>
          <Text style={styles.itemQty}>{itemCount} items</Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={Colors.textTertiary}
          />
        </View>
      </Pressable>
    );
  };

  const renderItem = (item: InventoryItem) => (
    <Pressable
      key={item.id}
      style={styles.itemRow}
      onPress={() => handleItemPress(item)}
    >
      <View
        style={[
          styles.itemIcon,
          item.criticality === "critical" && styles.itemIconCritical,
        ]}
      >
        <Ionicons
          name={item.status === "incoming" ? "arrow-down-circle" : "cube"}
          size={20}
          color={item.criticality === "critical" ? Colors.red : Colors.blue}
        />
      </View>
      <View style={styles.itemInfo}>
        <ThemedText numberOfLines={1} style={styles.itemName}>
          {item.name}
        </ThemedText>
        <ThemedText style={styles.itemMeta}>{item.location.path}</ThemedText>
      </View>
      <View style={styles.itemRight}>
        <Text style={styles.itemQty}>×{item.quantity}</Text>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={Colors.textTertiary}
        />
      </View>
    </Pressable>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={handleLogout}>
            <Image
              source={{
                uri: `https://ui-avatars.com/api/?name=${user?.name || "U"}&background=0F6FFF&color=fff&size=64`,
              }}
              style={styles.avatar}
            />
          </Pressable>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Find item or location..."
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={Colors.textTertiary}
                />
              </Pressable>
            )}
          </View>

          {isSupported && (
            <Pressable
              style={[styles.scanBtn, isScanning && styles.scanBtnActive]}
              onPress={handleScan}
              disabled={isScanning}
            >
              <Ionicons
                name="scan"
                size={22}
                color={isScanning ? Colors.background : Colors.blue}
              />
            </Pressable>
          )}
        </View>

        <OfflineBanner />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statsRow}>
            <Pressable
              style={[
                styles.statChip,
                activeFilter === "all" && styles.statChipActive,
              ]}
              onPress={() => setActiveFilter("all")}
            >
              <ThemedText
                style={[
                  styles.statNum,
                  activeFilter === "all" && styles.statNumActive,
                ]}
              >
                {stats.totalItems}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Items</ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.statChip,
                activeFilter === "ctbs" && styles.statChipActive,
              ]}
              onPress={() =>
                setActiveFilter(activeFilter === "ctbs" ? "all" : "ctbs")
              }
            >
              <ThemedText
                style={[
                  styles.statNum,
                  activeFilter === "ctbs" && styles.statNumActive,
                ]}
              >
                {stats.totalCTBs}
              </ThemedText>
              <ThemedText style={styles.statLabel}>CTBs</ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.statChip,
                stats.incomingCTBCount > 0 && styles.incomingStatChip,
              ]}
              onPress={() => router.push("/incoming")}
            >
              <ThemedText
                style={[
                  styles.statNum,
                  stats.incomingCTBCount > 0 && { color: Colors.warning },
                ]}
              >
                {stats.incomingCTBCount}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Incoming</ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.statChip,
                activeFilter === "expiring" && styles.statChipActive,
              ]}
              onPress={() =>
                setActiveFilter(
                  activeFilter === "expiring" ? "all" : "expiring",
                )
              }
            >
              <ThemedText
                style={[
                  styles.statNum,
                  activeFilter === "expiring" && styles.statNumActive,
                ]}
              >
                {stats.expiringItems}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Expiring</ThemedText>
            </Pressable>
          </View>

          {!searchQuery && criticalLowStock.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="warning" size={18} color={Colors.error} />
                <ThemedText style={styles.sectionTitle}>Low Stock - Critical</ThemedText>
                <View style={styles.wasteBadge}>
                  <Text style={styles.wasteBadgeText}>{criticalLowStock.length}</Text>
                </View>
              </View>
              <View style={styles.list}>
                {criticalLowStock.slice(0, 5).map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.itemRow}
                    onPress={() => handleItemPress(item)}
                  >
                    <View style={[styles.itemIcon, styles.itemIconCritical]}>
                      <Ionicons name="alert-circle" size={20} color={Colors.red} />
                    </View>
                    <View style={styles.itemInfo}>
                      <ThemedText numberOfLines={1} style={styles.itemName}>
                        {item.name}
                      </ThemedText>
                      <ThemedText style={styles.itemMeta}>{item.location.path}</ThemedText>
                    </View>
                    <View style={styles.itemRight}>
                      <Text style={[styles.itemQty, { color: Colors.error }]}>
                        x{item.quantity}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {!searchQuery && recentActivity.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="time-outline" size={18} color={Colors.blue} />
                <ThemedText style={styles.sectionTitle}>Recent Activity</ThemedText>
              </View>
              <View style={styles.list}>
                {recentActivity.map(({ item, entry }, index) => {
                  const actionMap: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
                    loaded: { icon: "arrow-up-circle", color: Colors.blue, label: "Loaded" },
                    delivered: { icon: "checkmark-circle", color: Colors.success, label: "Delivered" },
                    consumed: { icon: "nutrition", color: Colors.warning, label: "Consumed" },
                    moved: { icon: "swap-horizontal", color: Colors.blue, label: "Moved" },
                    relocated: { icon: "navigate", color: Colors.blue, label: "Relocated" },
                    "marked-waste": { icon: "trash", color: Colors.error, label: "Waste" },
                    inspected: { icon: "eye", color: Colors.blue, label: "Inspected" },
                    "nfc-assigned": { icon: "radio", color: Colors.success, label: "NFC Tag" },
                  };
                  const info = actionMap[entry.action] || { icon: "ellipse" as keyof typeof Ionicons.glyphMap, color: Colors.textSecondary, label: entry.action };
                  const ts = new Date(entry.timestamp);
                  const timeStr = `${ts.getMonth() + 1}/${ts.getDate()} ${ts.getHours().toString().padStart(2, "0")}:${ts.getMinutes().toString().padStart(2, "0")}`;
                  return (
                    <Pressable
                      key={`${item.id}-${index}`}
                      style={styles.itemRow}
                      onPress={() => handleItemPress(item)}
                    >
                      <View style={[styles.itemIcon, { backgroundColor: `${info.color}15` }]}>
                        <Ionicons name={info.icon} size={18} color={info.color} />
                      </View>
                      <View style={styles.itemInfo}>
                        <ThemedText numberOfLines={1} style={styles.itemName}>
                          {info.label}: {item.name}
                        </ThemedText>
                        <ThemedText style={styles.itemMeta}>
                          {entry.notes || item.location.path}
                        </ThemedText>
                      </View>
                      <View style={styles.itemRight}>
                        <Text style={[styles.activityTime]}>{timeStr}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {activeFilter !== "ctbs" && groupedItems.incoming.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons
                  name="arrow-down-circle"
                  size={18}
                  color={Colors.blue}
                />
                <ThemedText style={styles.sectionTitle}>Incoming</ThemedText>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {groupedItems.incoming.length}
                  </Text>
                </View>
              </View>
              <View style={styles.list}>
                {groupedItems.incoming.slice(0, 5).map(renderItem)}
                {groupedItems.incoming.length > 5 && (
                  <Pressable
                    style={styles.showMore}
                    onPress={() => router.push("/incoming")}
                  >
                    <ThemedText style={styles.showMoreText}>
                      View all {groupedItems.incoming.length} incoming →
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {activeFilter === "ctbs" && filteredCTBs.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="cube-outline" size={18} color={Colors.blue} />
                <ThemedText style={styles.sectionTitle}>All CTBs</ThemedText>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{filteredCTBs.length}</Text>
                </View>
              </View>
              <View style={styles.list}>
                {(showAllCTBs ? filteredCTBs : filteredCTBs.slice(0, 10)).map(renderCTB)}
                {filteredCTBs.length > 10 && (
                  <Pressable
                    style={styles.showMore}
                    onPress={() => setShowAllCTBs(!showAllCTBs)}
                  >
                    <ThemedText style={styles.showMoreText}>
                      {showAllCTBs ? 'Show less' : `View all ${filteredCTBs.length} CTBs`} →
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {activeFilter !== "ctbs" && groupedItems.stock.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="cube" size={18} color={Colors.success} />
                <ThemedText style={styles.sectionTitle}>In Stock</ThemedText>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {groupedItems.stock.length}
                  </Text>
                </View>
              </View>
              <View style={styles.list}>
                {(showAllItems ? groupedItems.stock : groupedItems.stock.slice(0, 10)).map(renderItem)}
                {groupedItems.stock.length > 10 && (
                  <Pressable
                    style={styles.showMore}
                    onPress={() => setShowAllItems(!showAllItems)}
                  >
                    <ThemedText style={styles.showMoreText}>
                      {showAllItems ? 'Show less' : `View all ${groupedItems.stock.length} items`} →
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {!searchQuery && (user?.role === "astronaut" || user?.role === "mission-specialist" || user?.role === "admin") &&
            incomingCTBs.length > 0 && (
            <View style={styles.section}>
              <Pressable
                style={styles.sectionLink}
                onPress={() => router.push("/incoming")}
              >
                <View style={[styles.sectionHeader, { marginBottom: 0 }]}>
                  <Ionicons
                    name="download-outline"
                    size={18}
                    color={Colors.warning}
                  />
                  <ThemedText style={styles.sectionTitle}>Receive Incoming</ThemedText>
                  <View style={styles.incomingBadge}>
                    <ThemedText style={styles.incomingBadgeText}>
                      {incomingCTBs.length}
                    </ThemedText>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={Colors.textTertiary}
                  />
                </View>
                <ThemedText style={styles.sectionDescription}>
                  Review and receive incoming CTBs into inventory
                </ThemedText>
              </Pressable>
            </View>
          )}

          {!searchQuery && wasteAndConsumedCount > 0 && (
            <View style={styles.section}>
              <Pressable
                style={styles.sectionLink}
                onPress={() => router.push("/waste")}
              >
                <View style={[styles.sectionHeader, { marginBottom: 0 }]}>
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={Colors.error}
                  />
                  <ThemedText style={styles.sectionTitle}>
                    Waste Management
                  </ThemedText>
                  <View style={styles.wasteBadge}>
                    <ThemedText style={styles.wasteBadgeText}>
                      {wasteAndConsumedCount}
                    </ThemedText>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={Colors.textTertiary}
                  />
                </View>
                <ThemedText style={styles.sectionDescription}>
                  {getWasteVolume().toFixed(3)} m³ waste volume tracked
                </ThemedText>
              </Pressable>
            </View>
          )}

          {!searchQuery && <View style={styles.section}>
            <Pressable
              style={styles.sectionLink}
              onPress={() => router.push("/logs")}
            >
              <View style={[styles.sectionHeader, { marginBottom: 0 }]}>
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={Colors.success}
                />
                <ThemedText style={styles.sectionTitle}>Activity Logs</ThemedText>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={Colors.textTertiary}
                />
              </View>
              <ThemedText style={styles.sectionDescription}>
                View all inventory activity, scans, and transfers
              </ThemedText>
            </Pressable>
          </View>}

          {!searchQuery && (user?.role === "ground-crew" ||
            user?.role === "loader" ||
            user?.role === "admin") && (
            <View style={styles.section}>
              <Pressable
                style={styles.sectionLink}
                onPress={() => router.push("/shipment")}
              >
                <View style={[styles.sectionHeader, { marginBottom: 0 }]}>
                  <Ionicons
                    name="rocket-outline"
                    size={18}
                    color={Colors.warning}
                  />
                  <ThemedText style={styles.sectionTitle}>
                    Shipment Manifest
                  </ThemedText>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={Colors.textTertiary}
                  />
                </View>
                <ThemedText style={styles.sectionDescription}>
                  Build and manage cargo manifests for missions
                </ThemedText>
              </Pressable>
            </View>
          )}

          {!searchQuery && <View style={styles.section}>
            <Pressable
              style={styles.sectionLink}
              onPress={() => router.push("/module")}
            >
              <View style={[styles.sectionHeader, { marginBottom: 0 }]}>
                <Ionicons
                  name="grid-outline"
                  size={18}
                  color={Colors.blue}
                />
                <ThemedText style={styles.sectionTitle}>Storage Module</ThemedText>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={Colors.textTertiary}
                />
              </View>
              <ThemedText style={styles.sectionDescription}>
                View DSLM stack layout and CTB positions
              </ThemedText>
            </Pressable>
          </View>}

          {activeFilter === "ctbs" && searchQuery && filteredCTBs.length === 0 && (
            <View style={styles.empty}>
              <Ionicons
                name="cube-outline"
                size={48}
                color={Colors.textTertiary}
              />
              <ThemedText style={styles.emptyText}>
                No CTBs match your search
              </ThemedText>
            </View>
          )}

          {activeFilter !== "ctbs" && filteredItems.length === 0 && (
            <View style={styles.empty}>
              <Ionicons
                name="cube-outline"
                size={48}
                color={Colors.textTertiary}
              />
              <ThemedText style={styles.emptyText}>
                {searchQuery ? "No items match your search" : "No items found"}
              </ThemedText>
            </View>
          )}
        </ScrollView>

        <CTBViewer
          visible={!!selectedItem || !!selectedCTB}
          ctb={selectedCTB}
          initialItem={selectedItem}
          onClose={() => {
            setSelectedItem(null);
            setSelectedCTB(null);
          }}
        />

        <NFCScannerModal
          visible={showNFCScanner}
          mode="scan"
          title="Scan CTB Tag"
          subtitle="Hold your device near a CTB's NFC tag to view its contents"
          onClose={() => setShowNFCScanner(false)}
          onScanSuccess={handleNFCScanSuccess}
        />

        {isSupported && (
          <Pressable
            style={({ pressed }) => [
              styles.fab,
              pressed && styles.fabPressed
            ]}
            onPress={() => setShowNFCScanner(true)}
          >
            <Ionicons name="radio-outline" size={28} color="#000" />
            <Text style={styles.fabText}>Scan</Text>
          </Pressable>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 22,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  scanBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.blueGlow,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.blue,
  },
  scanBtnActive: {
    backgroundColor: Colors.blue,
  },
  content: {
    paddingBottom: 24,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statChip: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  statChipActive: {
    backgroundColor: Colors.blueGlow,
    borderWidth: 1,
    borderColor: Colors.blue,
  },
  incomingStatChip: {
    backgroundColor: 'rgba(255,159,10,0.1)',
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  statNum: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  statNumActive: {
    color: Colors.blue,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  section: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  sectionLink: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  sectionDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  badge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  list: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: "hidden",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.blueGlow,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  itemIconCritical: {
    backgroundColor: Colors.redGlow,
  },
  itemInfo: {
    flex: 1,
  },
  itemNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 1,
  },
  nfcBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderRadius: 8,
    padding: 3,
  },
  itemMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  itemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  itemQty: {
    fontSize: 13,
    color: Colors.blue,
    fontWeight: "600",
  },
  showMore: {
    padding: 12,
    alignItems: "center",
  },
  showMoreText: {
    fontSize: 13,
    color: Colors.blue,
    fontWeight: "500",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    backgroundColor: Colors.blue,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: Colors.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  fabText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  incomingBadge: {
    backgroundColor: Colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 4,
  },
  incomingBadgeText: {
    fontSize: 12,
    color: "#000",
    fontWeight: "700",
  },
  wasteBadge: {
    backgroundColor: Colors.error,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 4,
  },
  activityTime: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  wasteBadgeText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "700",
  },
});
