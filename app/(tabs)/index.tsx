import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ParallaxScrollView from '../../components/parallax-scroll-view';
import { Colors } from '../../constants/colors';
import { useInventory } from '../../hooks/use-inventory';
import type { InventoryItem } from '../../types/dslm';

export default function HomeScreen() {
  const {
    inventoryItems,
    ctbs,
    getCriticalItems,
    getExpiringItems,
  } = useInventory();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['all']));

  const categories = useMemo(
    () => [
      { id: 'all', label: 'All Items' },
      { id: 'food', label: 'Food & Meals' },
      { id: 'water', label: 'Water' },
      { id: 'scientific-equipment', label: 'Scientific Equipment' },
      { id: 'lunar-equipment', label: 'Lunar Equipment' },
      { id: 'medical', label: 'Medical' },
      { id: 'spare-parts', label: 'Spare Parts' },
      { id: 'clothing', label: 'Clothing' },
      { id: 'hygiene', label: 'Hygiene' },
      { id: 'misc', label: 'Miscellaneous' },
    ],
    []
  );

  const searchFilteredItems = useMemo(() => {
    if (!searchQuery) return inventoryItems;
    const query = searchQuery.toLowerCase();
    return inventoryItems.filter(
      item =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.location.path.toLowerCase().includes(query)
    );
  }, [inventoryItems, searchQuery]);

  const categorizedItems = useMemo(() => {
    const grouped: Record<string, { incoming: InventoryItem[]; stock: InventoryItem[] }> = {};

    categories.forEach(cat => {
      grouped[cat.id] = { incoming: [], stock: [] };
    });

    searchFilteredItems.forEach(item => {
      const category = item.category;

      if (grouped[category]) {
        if (item.status === 'incoming') {
          grouped[category].incoming.push(item);
        } else if (item.status === 'stock' || item.status === 'delivered') {
          grouped[category].stock.push(item);
        }
      }

      if (item.status === 'incoming') {
        grouped.all.incoming.push(item);
      } else if (item.status === 'stock' || item.status === 'delivered') {
        grouped.all.stock.push(item);
      }
    });

    return grouped;
  }, [searchFilteredItems, categories]);

  const stats = useMemo(() => {
    const totalItems = inventoryItems.length;
    const totalCTBs = ctbs.length;
    const criticalItems = getCriticalItems().length;
    const expiringItems = getExpiringItems(30).length;

    return { totalItems, totalCTBs, criticalItems, expiringItems };
  }, [inventoryItems, ctbs, getCriticalItems, getExpiringItems]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      incoming: Colors.blue,
      stock: Colors.blue,
      delivered: Colors.blue,
      'in-use': Colors.blue,
      consumed: Colors.textTertiary,
      waste: Colors.red,
    };
    return colors[status] || Colors.textTertiary;
  };

  const renderItemTile = (item: InventoryItem, showDeliverButton: boolean = false) => (
    <View key={item.id} style={styles.tileWrap}>
      <Pressable onPress={() => { /* placeholder */ }}>
        <View style={styles.tile}>
          <Image
            source={{
              uri: `https://via.placeholder.com/60/0A0A0A/FFFFFF?text=${encodeURIComponent(item.name.split(' ')[0])}`
            }}
            style={styles.tileImage}
          />
          <View style={styles.qtyBadge}>
            <Text style={styles.qtyText}>{item.quantity}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusBadgeText}>{item.status}</Text>
          </View>
        </View>
      </Pressable>
      <Text numberOfLines={2} style={styles.tileLabel}>
        {item.name}
      </Text>
      {item.status === 'incoming' && (
        <Text style={styles.ctbLabel}>
          In: {item.ctbId}
        </Text>
      )}
    </View>
  );

  const renderStatusGroup = (
    status: 'incoming' | 'stock',
    items: InventoryItem[],
    label: string
  ) => {
    if (items.length === 0) return null;

    return (
      <View style={styles.statusGroup}>
        <View style={styles.statusGroupHeader}>
          <View
            style={[
              styles.statusIndicator,
              status === 'incoming' ? styles.incomingIndicator : styles.deliveredIndicator,
            ]}
          />
          <Text style={styles.statusGroupTitle}>{label}</Text>
          <Text style={styles.statusCount}>({items.length})</Text>
        </View>

        <View style={styles.grid}>
          {items.map(item => renderItemTile(item, status === 'incoming'))}
        </View>
      </View>
    );
  };

  const renderCategory = (category: { id: string; label: string }) => {
    const isExpanded = expandedCategories.has(category.id);
    const items = categorizedItems[category.id];
    const totalItems = items.incoming.length + items.stock.length;

    if (totalItems === 0 && category.id !== 'all') return null;

    return (
      <View key={category.id} style={styles.categorySection}>
        <Pressable
          onPress={() => toggleCategory(category.id)}
          style={({ pressed }) => [
            styles.categoryHeader,
            pressed && styles.categoryHeaderPressed,
          ]}>
          <View style={styles.categoryHeaderLeft}>
            <View style={styles.categoryInfo}>
              <Text numberOfLines={1} ellipsizeMode="tail" style={styles.categoryTitle}>
                {category.label}
              </Text>
              <Text style={styles.categorySubtitle}>
                {totalItems} {totalItems === 1 ? 'item' : 'items'}
              </Text>
            </View>
          </View>

          <View style={styles.categoryStats}>
            {items.incoming.length > 0 && (
              <View style={styles.incomingBadge}>
                <Text style={[styles.statBadgeText, styles.incomingText]}>
                  {items.incoming.length}
                </Text>
              </View>
            )}
            {items.stock.length > 0 && (
              <View style={styles.deliveredBadge}>
                <Text style={[styles.statBadgeText, styles.deliveredText]}>
                  {items.stock.length}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.expandIcon}>
            {isExpanded ? '▼' : '▶'}
          </Text>
        </Pressable>

        {isExpanded && (
          <View style={styles.categoryContent}>
            {totalItems === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No items in this category</Text>
              </View>
            ) : (
              <>
                {renderStatusGroup('incoming', items.incoming, 'Incoming Packages')}
                {renderStatusGroup('stock', items.stock, 'Delivered / In Stock')}
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      <ParallaxScrollView
        headerHeight={100}
        headerBackgroundColor={{ light: Colors.surface, dark: Colors.surface }}
        headerImage={
          <View style={styles.headerBar}>
            <Text style={styles.headerTitle}>
              DSLM Inventory
            </Text>
            <Text style={styles.headerSubtitle}>
              Deep Space Logistics Module
            </Text>
          </View>
        }>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.blue }]}>{stats.totalItems}</Text>
            <Text style={styles.statLabel}>Total Items</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.blue }]}>{stats.totalCTBs}</Text>
            <Text style={styles.statLabel}>CTBs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.red }]}>{stats.criticalItems}</Text>
            <Text style={styles.statLabel}>Critical</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.blue }]}>{stats.expiringItems}</Text>
            <Text style={styles.statLabel}>Expiring</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search items, CTBs, locations..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Categories */}
        <View style={styles.contentArea}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {categories.map(category => renderCategory(category))}
          </ScrollView>
        </View>
      </ParallaxScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    height: 100,
    paddingHorizontal: 24,
    justifyContent: 'flex-end',
    paddingBottom: 16,
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '600',
    marginBottom: 6,
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '400',
  },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    flexWrap: 'wrap',
    paddingHorizontal: 20,
  },
  statCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: Colors.surface,
    padding: 18,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '400',
  },

  searchContainer: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  searchInput: {
    backgroundColor: Colors.surface,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    fontWeight: '400',
  },

  contentArea: {
    flex: 1,
    paddingTop: 8,
    paddingHorizontal: 20,
  },

  categorySection: {
    marginBottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  categoryHeaderPressed: {
    backgroundColor: Colors.surfaceHover,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
    flexShrink: 1,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
    color: Colors.textPrimary,
  },
  categorySubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  categoryStats: {
    flexDirection: 'row',
    gap: 6,
    marginRight: 10,
  },
  categoryStatBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  incomingBadge: {
    backgroundColor: Colors.blueGlow,
  },
  deliveredBadge: {
    backgroundColor: Colors.blueGlow,
  },
  statBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  incomingText: {
    color: Colors.blue,
  },
  deliveredText: {
    color: Colors.blue,
  },
  expandIcon: {
    fontSize: 16,
    color: Colors.textTertiary,
  },

  categoryContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: Colors.background,
  },

  statusGroup: {
    marginBottom: 16,
  },
  statusGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  incomingIndicator: {
    backgroundColor: Colors.blue,
  },
  deliveredIndicator: {
    backgroundColor: Colors.blue,
  },
  statusGroupTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  statusCount: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginLeft: 6,
    fontWeight: '400',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tileWrap: {
    flex: 1,
    minWidth: 110,
    maxWidth: 150,
  },
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 6,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  tileImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
  },
  tileLabel: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    color: Colors.textPrimary,
  },
  qtyBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    backgroundColor: Colors.blue,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  qtyText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: '#FFF',
  },
  deliverBtn: {
    marginTop: 6,
    backgroundColor: Colors.blue,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  deliverBtnPressed: {
    opacity: 0.8,
  },
  deliverBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },

  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  ctbLabel: {
    marginTop: 4,
    fontSize: 10,
    color: Colors.blue,
    textAlign: 'center',
    fontWeight: '500',
  },
});
