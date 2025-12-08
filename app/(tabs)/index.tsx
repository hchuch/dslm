import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import AddItemModal from '../../components/add-item-modal';
import ItemDetailModal from '../../components/item-detail-modal';
import ParallaxScrollView from '../../components/parallax-scroll-view';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/auth-context';
import { useInventory } from '../../hooks/use-inventory';
import { useNFC } from '../../hooks/use-nfc';
import type { InventoryItem } from '../../types/dslm';

export default function HomeScreen() {
  const {
    inventoryItems,
    ctbs,
    getCriticalItems,
    getExpiringItems,
  } = useInventory();
  const { user, login } = useAuth();
  const { scanTag, isSupported } = useNFC();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['all']));
  const [isAddItemVisible, setIsAddItemVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const handleScan = async () => {
    const tag = await scanTag();
    if (tag) {
      setSearchQuery(tag.id);
      Alert.alert('Item Scanned', `Filtered for tag: ${tag.id}`);
    }
  };

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

  const [activeFilter, setActiveFilter] = useState<'all' | 'critical' | 'expiring'>('all');

  const searchFilteredItems = useMemo(() => {
    let items = inventoryItems;

    // Apply Status Filter
    if (activeFilter === 'critical') {
      items = getCriticalItems();
    } else if (activeFilter === 'expiring') {
      items = getExpiringItems(30);
    }

    if (!searchQuery) return items;

    const query = searchQuery.toLowerCase();
    return items.filter(
      item =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.location.path.toLowerCase().includes(query)
    );
  }, [inventoryItems, searchQuery, activeFilter, getCriticalItems, getExpiringItems]);

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

  const recentActivity = useMemo(() => {
    const allHistory = inventoryItems.flatMap(item =>
      item.history.map(entry => ({
        ...entry,
        itemName: item.name,
        itemId: item.id
      }))
    );
    return allHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 5);
  }, [inventoryItems]);

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
      <Pressable onPress={() => setSelectedItem(item)}>
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
            <View>
              <Text style={styles.headerTitle}>
                DSLM Inventory
              </Text>
              <Text style={styles.headerSubtitle}>
                Deep Space Logistics Module
              </Text>
            </View>
            <View style={styles.headerButtons}>
              {isSupported && (
                <Pressable style={styles.iconButton} onPress={handleScan}>
                  <Ionicons name="scan" size={24} color={Colors.blue} />
                </Pressable>
              )}
              <Pressable
                style={styles.profileButton}
                onPress={() => {
                  Alert.alert(
                    'Switch Role',
                    `Current: ${user?.name} (${user?.role})`,
                    [
                      { text: 'Ground Crew', onPress: () => login('ground-crew') },
                      { text: 'Astronaut', onPress: () => login('astronaut') },
                      { text: 'Cancel', style: 'cancel' }
                    ]
                  );
                }}
              >
                <Image
                  source={{ uri: 'https://ui-avatars.com/api/?name=' + (user?.name || 'User') + '&background=0D8ABC&color=fff' }}
                  style={styles.profileImage}
                />
              </Pressable>
            </View>
          </View>
        }>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Pressable
            style={[styles.statCard, activeFilter === 'all' && styles.statCardActive]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={[styles.statValue, { color: Colors.blue }]}>{stats.totalItems}</Text>
            <Text style={[styles.statLabel, activeFilter === 'all' && styles.statLabelActive]}>Total Items</Text>
          </Pressable>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.blue }]}>{stats.totalCTBs}</Text>
            <Text style={styles.statLabel}>CTBs</Text>
          </View>
          <Pressable
            style={[styles.statCard, activeFilter === 'critical' && styles.statCardActive]}
            onPress={() => setActiveFilter(activeFilter === 'critical' ? 'all' : 'critical')}
          >
            <Text style={[styles.statValue, { color: Colors.red }]}>{stats.criticalItems}</Text>
            <Text style={[styles.statLabel, activeFilter === 'critical' && styles.statLabelActive]}>Critical</Text>
          </Pressable>
          <Pressable
            style={[styles.statCard, activeFilter === 'expiring' && styles.statCardActive]}
            onPress={() => setActiveFilter(activeFilter === 'expiring' ? 'all' : 'expiring')}
          >
            <Text style={[styles.statValue, { color: Colors.blue }]}>{stats.expiringItems}</Text>
            <Text style={[styles.statLabel, activeFilter === 'expiring' && styles.statLabelActive]}>Expiring</Text>
          </Pressable>
        </View>

        {/* Recent Activity */}
        < View style={styles.sectionContainer} >
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityList}>
            {recentActivity.map((activity, index) => (
              <View key={`${activity.itemId}-${index}`} style={styles.activityCard}>
                <View style={styles.activityHeader}>
                  <Text style={styles.activityAction}>{activity.action.toUpperCase()}</Text>
                  <Text style={styles.activityTime}>
                    {activity.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.activityItemName} numberOfLines={1}>{activity.itemName}</Text>
                {activity.timeTaken && (
                  <View style={styles.timeTakenBadge}>
                    <Text style={styles.timeTakenText}>⏱ {activity.timeTaken}s</Text>
                  </View>
                )}
              </View>
            ))}
            {recentActivity.length === 0 && (
              <Text style={styles.emptyText}>No recent activity</Text>
            )}
          </View>
        </View >

        {/* Search */}
        < View style={styles.searchContainer} >
          <TextInput
            style={styles.searchInput}
            placeholder="Search items, CTBs, locations..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View >

        {/* Categories */}
        < View style={styles.contentArea} >
          <ScrollView showsVerticalScrollIndicator={false}>
            {categories.map(category => renderCategory(category))}
          </ScrollView>
        </View >
      </ParallaxScrollView >

      {/* Add Item FAB */}
      <Pressable
        style={styles.fab}
        onPress={() => setIsAddItemVisible(true)}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </Pressable>

      <AddItemModal
        visible={isAddItemVisible}
        onClose={() => setIsAddItemVisible(false)}
      />

      <ItemDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </SafeAreaView >
  );
}

const styles = StyleSheet.create({
  headerBar: {
    height: 100,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 16,
    backgroundColor: Colors.background,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    padding: 8,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  profileButton: {
    marginBottom: 4,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.blue,
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
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: Colors.surface,
    padding: 16,
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
  statCardActive: {
    borderColor: Colors.blue,
    backgroundColor: 'rgba(15, 111, 255, 0.1)',
  },
  statLabelActive: {
    color: Colors.blue,
    fontWeight: '600',
  },

  sectionContainer: {
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: Colors.textPrimary,
  },
  activityList: {
    gap: 8,
  },
  activityCard: {
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  activityAction: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.blue,
  },
  activityTime: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  activityItemName: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
  timeTakenBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timeTakenText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '500',
  },

  searchContainer: {
    marginBottom: 20,
    paddingHorizontal: 12,
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
    paddingHorizontal: 12,
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
  },
});
