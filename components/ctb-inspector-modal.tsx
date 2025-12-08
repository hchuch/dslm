import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useInventory } from '../hooks/use-inventory';
import type { CTB } from '../types/dslm';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

type Props = {
    visible: boolean;
    ctb: CTB | null;
    onClose: () => void;
    onReceive?: (ctbId: string) => void;
};

export function CTBInspectorModal({ visible, ctb, onClose, onReceive }: Props) {
    const { getChildCTBs, getItemsInCTB } = useInventory();
    const [currentCTB, setCurrentCTB] = useState<CTB | null>(ctb);
    const [navigationStack, setNavigationStack] = useState<CTB[]>([]);

    // Reset state when modal opens with a new CTB
    React.useEffect(() => {
        if (visible && ctb) {
            setCurrentCTB(ctb);
            setNavigationStack([]);
        }
    }, [visible, ctb]);

    if (!currentCTB) return null;

    const childCTBs = getChildCTBs(currentCTB.id);
    const items = getItemsInCTB(currentCTB.id);

    const handleDrillDown = (child: CTB) => {
        setNavigationStack((prev) => [...prev, currentCTB]);
        setCurrentCTB(child);
    };

    const handleGoBack = () => {
        if (navigationStack.length > 0) {
            const parent = navigationStack[navigationStack.length - 1];
            setNavigationStack((prev) => prev.slice(0, -1));
            setCurrentCTB(parent);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <ThemedView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerTop}>
                        {navigationStack.length > 0 ? (
                            <Pressable onPress={handleGoBack} style={styles.backButton}>
                                <Ionicons name="chevron-back" size={24} color="#0F6FFF" />
                                <ThemedText style={styles.backButtonText}>Back</ThemedText>
                            </Pressable>
                        ) : (
                            <View style={{ width: 60 }} /> // Spacer
                        )}

                        <ThemedText style={styles.headerTitle}>CTB Inspector</ThemedText>

                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <ThemedText style={styles.closeButtonText}>Done</ThemedText>
                        </Pressable>
                    </View>

                    <View style={styles.ctbInfo}>
                        <ThemedText style={styles.ctbId}>{currentCTB.id}</ThemedText>
                        <ThemedText style={styles.ctbPath}>
                            {navigationStack.map(c => c.id).join(' > ')}
                            {navigationStack.length > 0 ? ' > ' : ''}
                            {currentCTB.id}
                        </ThemedText>
                    </View>
                </View>

                <ScrollView style={styles.content}>
                    {/* Action Button (Receive) */}
                    {onReceive && navigationStack.length === 0 && (
                        <Pressable
                            style={({ pressed }) => [styles.receiveButton, pressed && styles.receiveButtonPressed]}
                            onPress={() => onReceive(currentCTB.id)}
                        >
                            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                            <ThemedText style={styles.receiveButtonText}>Receive Entire CTB</ThemedText>
                        </Pressable>
                    )}

                    {/* Nested CTBs Section */}
                    {childCTBs.length > 0 && (
                        <View style={styles.section}>
                            <ThemedText style={styles.sectionTitle}>Nested CTBs ({childCTBs.length})</ThemedText>
                            <View style={styles.grid}>
                                {childCTBs.map((child) => (
                                    <Pressable
                                        key={child.id}
                                        style={styles.ctbCard}
                                        onPress={() => handleDrillDown(child)}
                                    >
                                        <View style={styles.ctbIcon}>
                                            <Ionicons name="cube-outline" size={32} color="#0F6FFF" />
                                        </View>
                                        <ThemedText style={styles.ctbCardId} numberOfLines={1}>{child.id}</ThemedText>
                                        <ThemedText style={styles.ctbCardSize}>Size: {child.size}</ThemedText>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Items Section */}
                    <View style={styles.section}>
                        <ThemedText style={styles.sectionTitle}>Contents ({items.length})</ThemedText>
                        {items.length === 0 ? (
                            <ThemedText style={styles.emptyText}>No loose items in this CTB</ThemedText>
                        ) : (
                            items.map((item) => (
                                <View key={item.id}>
                                    <ThemedView style={styles.itemRow}>
                                        <View style={styles.itemIcon}>
                                            <Ionicons name="cube" size={20} color="#888" />
                                        </View>
                                        <View style={styles.itemInfo}>
                                            <ThemedText style={styles.itemName}>{item.name}</ThemedText>
                                            <ThemedText style={styles.itemMeta}>
                                                Qty: {item.quantity} | {item.mass}kg
                                            </ThemedText>
                                        </View>
                                        <View style={[
                                            styles.statusBadge,
                                            item.status === 'incoming' ? styles.statusIncoming : styles.statusStock
                                        ]}>
                                            <ThemedText style={styles.statusText}>
                                                {item.status.toUpperCase()}
                                            </ThemedText>
                                        </View>
                                    </ThemedView>
                                    {item.subItems && item.subItems.length > 0 && (
                                        <View style={styles.subItemsContainer}>
                                            {item.subItems.map((subItem, idx) => (
                                                <View key={subItem.id || idx} style={styles.subItemRow}>
                                                    <Ionicons name="return-down-forward" size={16} color="#666" style={{ marginRight: 8 }} />
                                                    <ThemedText style={styles.subItemName}>{subItem.name}</ThemedText>
                                                    <ThemedText style={styles.subItemMeta}>Qty: {subItem.quantity}</ThemedText>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            ))
                        )}
                    </View>
                </ScrollView>
            </ThemedView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0B0D',
    },
    header: {
        backgroundColor: '#111214',
        borderBottomWidth: 1,
        borderBottomColor: '#2A2B2E',
        paddingBottom: 16,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        height: 56,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        width: 60,
    },
    backButtonText: {
        color: '#0F6FFF',
        fontSize: 17,
        marginLeft: 4,
    },
    closeButton: {
        width: 60,
        alignItems: 'flex-end',
    },
    closeButtonText: {
        color: '#0F6FFF',
        fontSize: 17,
        fontWeight: '600',
    },
    ctbInfo: {
        paddingHorizontal: 16,
        marginTop: 8,
    },
    ctbId: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 4,
    },
    ctbPath: {
        fontSize: 12,
        opacity: 0.5,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    receiveButton: {
        backgroundColor: '#10B981',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        marginBottom: 24,
        gap: 8,
    },
    receiveButtonPressed: {
        opacity: 0.8,
    },
    receiveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 12,
        opacity: 0.8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    ctbCard: {
        width: '48%',
        backgroundColor: '#1A1B1E',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#2A2B2E',
        alignItems: 'center',
    },
    ctbIcon: {
        marginBottom: 12,
        opacity: 0.8,
    },
    ctbCardId: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 4,
    },
    ctbCardSize: {
        fontSize: 11,
        opacity: 0.5,
    },
    emptyText: {
        opacity: 0.4,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 8,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111214',
        padding: 12,
        borderRadius: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#2A2B2E',
    },
    itemIcon: {
        width: 36,
        height: 36,
        backgroundColor: '#1A1B1E',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 2,
    },
    itemMeta: {
        fontSize: 12,
        opacity: 0.5,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusIncoming: {
        backgroundColor: 'rgba(234, 179, 8, 0.2)',
    },
    statusStock: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
        opacity: 0.9,
    },
    subItemsContainer: {
        marginLeft: 48,
        marginBottom: 12,
        paddingLeft: 12,
        borderLeftWidth: 1,
        borderLeftColor: '#2A2B2E',
    },
    subItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    subItemName: {
        fontSize: 13,
        color: '#CCC',
        marginRight: 8,
    },
    subItemMeta: {
        fontSize: 11,
        color: '#666',
    },
});
