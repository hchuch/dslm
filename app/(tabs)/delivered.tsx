import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CTBViewer } from '../../components/ctb-viewer';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { Colors } from '../../constants/colors';
import { useInventory } from '../../hooks/use-inventory';
import type { CTB } from '../../types/dslm';

export default function DeliveredScreen() {
    const { ctbs, inventoryItems } = useInventory();
    const [selectedCTB, setSelectedCTB] = useState<CTB | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const deliveredCTBs = useMemo(() => {
        const stockItemCtbIds = new Set(
            inventoryItems.filter(i => i.status === 'stock').map(i => i.ctbId)
        );
        return ctbs.filter(ctb => stockItemCtbIds.has(ctb.id));
    }, [ctbs, inventoryItems]);

    const stockItems = useMemo(() => {
        return inventoryItems.filter(i => i.status === 'stock');
    }, [inventoryItems]);

    const totalMass = useMemo(() => {
        return deliveredCTBs.reduce((sum, ctb) => sum + ctb.mass, 0);
    }, [deliveredCTBs]);

    const filteredCTBs = useMemo(() => {
        if (!searchQuery.trim()) return deliveredCTBs;
        const q = searchQuery.toLowerCase().trim();
        return deliveredCTBs.filter(ctb => {
            if (ctb.id.toLowerCase().includes(q)) return true;
            const ctbItemNames = inventoryItems
                .filter(i => i.ctbId === ctb.id && i.status === 'stock')
                .some(i => i.name.toLowerCase().includes(q));
            return ctbItemNames;
        });
    }, [deliveredCTBs, searchQuery, inventoryItems]);

    const formatDate = (date: Date | string | undefined): string | null => {
        if (!date) return null;
        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return null;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.header}>
                    <View>
                        <ThemedText type="title" style={styles.headerTitle}>Delivered Cargo</ThemedText>
                        <ThemedText style={styles.headerSubtitle}>
                            {deliveredCTBs.length} {deliveredCTBs.length === 1 ? 'CTB' : 'CTBs'} processed at Gateway
                        </ThemedText>
                    </View>
                </View>

                <View style={styles.summaryRow}>
                    <View style={styles.summaryCard}>
                        <ThemedText style={styles.summaryValue}>{deliveredCTBs.length}</ThemedText>
                        <ThemedText style={styles.summaryLabel}>CTBs</ThemedText>
                    </View>
                    <View style={styles.summaryCard}>
                        <ThemedText style={styles.summaryValue}>{totalMass.toFixed(1)}</ThemedText>
                        <ThemedText style={styles.summaryLabel}>Total kg</ThemedText>
                    </View>
                    <View style={styles.summaryCard}>
                        <ThemedText style={styles.summaryValue}>{stockItems.length}</ThemedText>
                        <ThemedText style={styles.summaryLabel}>In Stock</ThemedText>
                    </View>
                </View>

                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={18} color={Colors.textSecondary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Filter by CTB ID or item name..."
                        placeholderTextColor={Colors.textTertiary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                            <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
                        </Pressable>
                    )}
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                    {filteredCTBs.length === 0 ? (
                        <ThemedView style={styles.emptyState}>
                            <Ionicons name={searchQuery ? "search-outline" : "checkmark-circle-outline"} size={60} color={Colors.textTertiary} style={{ marginBottom: 16, opacity: 0.5 }} />
                            <ThemedText style={styles.emptyTitle}>{searchQuery ? 'No Results' : 'No Delivered Cargo'}</ThemedText>
                            <ThemedText style={styles.emptyText}>
                                {searchQuery
                                    ? `No CTBs match "${searchQuery}".`
                                    : 'No Cargo Transfer Bags have been processed yet.'}
                            </ThemedText>
                        </ThemedView>
                    ) : (
                        <View style={styles.gridContainer}>
                            {filteredCTBs.map((ctb) => (
                                <Pressable 
                                    key={ctb.id} 
                                    style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
                                    onPress={() => setSelectedCTB(ctb)}
                                >
                                    <View style={styles.iconContainer}>
                                        <Ionicons name="checkmark-done" size={40} color={Colors.success} />
                                        <View style={styles.sizeBadge}>
                                            <ThemedText style={styles.sizeText}>{ctb.size * 2}</ThemedText>
                                        </View>
                                    </View>

                                    <View style={styles.cardContent}>
                                        <ThemedText style={styles.ctbId} numberOfLines={1}>
                                            {ctb.id}
                                        </ThemedText>
                                        <ThemedText style={styles.ctbLocation} numberOfLines={1}>
                                            Stored: {ctb.location.path}
                                        </ThemedText>

                                        {formatDate(ctb.lastAccessedDate ?? ctb.loadedDate) && (
                                            <ThemedText style={styles.deliveryDate} numberOfLines={1}>
                                                {formatDate(ctb.lastAccessedDate ?? ctb.loadedDate)}
                                            </ThemedText>
                                        )}

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
                                        <View style={styles.statusBadge}>
                                            <Ionicons name="shield-checkmark" size={12} color={Colors.background} style={{ marginRight: 4 }} />
                                            <ThemedText style={styles.statusText}>Secure</ThemedText>
                                        </View>
                                        <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
                                    </View>
                                </Pressable>
                            ))}
                        </View>
                    )}
                </ScrollView>

                <CTBViewer
                    visible={!!selectedCTB}
                    ctb={selectedCTB}
                    onClose={() => setSelectedCTB(null)}
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
    summaryRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 12,
        gap: 10,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: Colors.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingVertical: 10,
        alignItems: 'center',
    },
    summaryValue: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    summaryLabel: {
        fontSize: 11,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.border,
        marginHorizontal: 16,
        marginTop: 12,
        paddingHorizontal: 12,
        height: 40,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
        color: Colors.textPrimary,
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
        color: Colors.textPrimary,
    },
    emptyText: {
        fontSize: 14,
        color: Colors.textTertiary,
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
    iconContainer: {
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        backgroundColor: Colors.surfaceHover,
        borderRadius: 8,
        position: 'relative',
    },
    sizeBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: Colors.surface,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: Colors.borderLight,
    },
    sizeText: {
        fontSize: 10,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    cardContent: {
        marginBottom: 12,
    },
    ctbId: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 4,
        color: Colors.textPrimary,
    },
    ctbLocation: {
        fontSize: 11,
        color: Colors.textSecondary,
        marginBottom: 4,
    },
    deliveryDate: {
        fontSize: 10,
        color: Colors.textTertiary,
        marginBottom: 8,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statText: {
        fontSize: 10,
        color: Colors.textSecondary,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        paddingTop: 8,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.success,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        color: Colors.background,
    }
});
