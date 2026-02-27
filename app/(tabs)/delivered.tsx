import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
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

    const deliveredCTBs = useMemo(() => {
        const stockItemCtbIds = new Set(
            inventoryItems.filter(i => i.status === 'stock').map(i => i.ctbId)
        );
        return ctbs.filter(ctb => stockItemCtbIds.has(ctb.id));
    }, [ctbs, inventoryItems]);

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

                <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                    {deliveredCTBs.length === 0 ? (
                        <ThemedView style={styles.emptyState}>
                            <Ionicons name="checkmark-circle-outline" size={60} color={Colors.textTertiary} style={{ marginBottom: 16, opacity: 0.5 }} />
                            <ThemedText style={styles.emptyTitle}>No Delivered Cargo</ThemedText>
                            <ThemedText style={styles.emptyText}>
                                No Cargo Transfer Bags have been processed yet.
                            </ThemedText>
                        </ThemedView>
                    ) : (
                        <View style={styles.gridContainer}>
                            {deliveredCTBs.map((ctb) => (
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
