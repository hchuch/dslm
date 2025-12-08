import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import AddItemModal from '../../components/add-item-modal';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useInventory } from '../../hooks/use-inventory';
import type { CTB, CTBSize, InventoryItem } from '../../types/dslm';

export default function ShipmentScreen() {
    const { addShipment } = useInventory();
    const [manifest, setManifest] = useState<{ ctbs: CTB[], items: InventoryItem[] }>({ ctbs: [], items: [] });
    const [isAddingCTB, setIsAddingCTB] = useState(false);
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [activeCtbId, setActiveCtbId] = useState<string | null>(null);

    // Temporary state for new CTB
    const [newCTBSize, setNewCTBSize] = useState<CTBSize>(1.0);
    const [newCTBId, setNewCTBId] = useState('');

    const handleAddCTB = () => {
        if (!newCTBId) return;

        const ctbId = `CTB-${newCTBId.toUpperCase()}`;
        const newCTB: CTB = {
            id: ctbId,
            rfidTag: {
                type: 'RFID',
                id: `RFID-${ctbId}`,
                assignedDate: new Date(),
                batteryLife: 365,
            },
            size: newCTBSize,
            location: { stack: 'INCOMING', position: 0, layer: 0, path: 'INCOMING' },
            childCTBs: [],
            items: [],
            mass: 2.0 * newCTBSize,
            volume: 0.05 * newCTBSize,
            isWaste: false,
            loadedDate: new Date(),
        };

        setManifest(prev => ({
            ...prev,
            ctbs: [...prev.ctbs, newCTB]
        }));

        setNewCTBId('');
        setIsAddingCTB(false);
    };

    const handleSendShipment = () => {
        if (manifest.ctbs.length === 0) return;
        addShipment(manifest.ctbs, manifest.items);
        setManifest({ ctbs: [], items: [] });
        alert('Shipment sent to Gateway!');
    };

    const getItemsForCTB = (ctbId: string) => {
        return manifest.items.filter(item => item.ctbId === ctbId);
    };

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <ThemedText type="title">Shipment Manifest</ThemedText>
                <Pressable
                    style={[styles.sendButton, manifest.ctbs.length === 0 && styles.disabledButton]}
                    onPress={handleSendShipment}
                    disabled={manifest.ctbs.length === 0}
                >
                    <ThemedText style={styles.sendButtonText}>Send Shipment</ThemedText>
                </Pressable>
            </View>

            <ScrollView style={styles.content}>
                {manifest.ctbs.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="cube-outline" size={64} color="#333" />
                        <ThemedText style={styles.emptyText}>No CTBs in current manifest</ThemedText>
                        <ThemedText style={styles.emptySubText}>Add CTBs to start packing</ThemedText>
                    </View>
                ) : (
                    <View style={styles.manifestList}>
                        {manifest.ctbs.map((ctb, index) => {
                            const ctbItems = getItemsForCTB(ctb.id);
                            return (
                                <View key={`ctb-${index}`} style={styles.ctbCard}>
                                    <View style={styles.ctbHeader}>
                                        <View style={styles.ctbHeaderLeft}>
                                            <View style={styles.ctbIcon}>
                                                <Ionicons name="cube" size={24} color="#0F6FFF" />
                                            </View>
                                            <View>
                                                <ThemedText style={styles.ctbId}>{ctb.id}</ThemedText>
                                                <ThemedText style={styles.ctbMeta}>Size: {ctb.size} | {ctbItems.length} Items</ThemedText>
                                            </View>
                                        </View>
                                        <Pressable onPress={() => {
                                            setManifest(prev => ({
                                                ...prev,
                                                ctbs: prev.ctbs.filter((_, i) => i !== index),
                                                items: prev.items.filter(item => item.ctbId !== ctb.id)
                                            }));
                                        }}>
                                            <Ionicons name="trash-outline" size={20} color="#FF453A" />
                                        </Pressable>
                                    </View>

                                    {/* Packed Items List */}
                                    {ctbItems.length > 0 && (
                                        <View style={styles.itemsList}>
                                            {ctbItems.map((item, i) => (
                                                <View key={i} style={styles.itemRow}>
                                                    <ThemedText style={styles.itemName}>• {item.name}</ThemedText>
                                                    <ThemedText style={styles.itemQty}>x{item.quantity}</ThemedText>
                                                </View>
                                            ))}
                                        </View>
                                    )}

                                    {/* Pack Button */}
                                    <Pressable
                                        style={styles.packButton}
                                        onPress={() => {
                                            setActiveCtbId(ctb.id);
                                            setIsAddingItem(true);
                                        }}
                                    >
                                        <Ionicons name="add-circle-outline" size={18} color="#0F6FFF" />
                                        <ThemedText style={styles.packButtonText}>Pack Item</ThemedText>
                                    </Pressable>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {isAddingCTB ? (
                <View style={styles.addPanel}>
                    <View style={styles.addPanelHeader}>
                        <ThemedText style={styles.addPanelTitle}>Add CTB</ThemedText>
                        <Pressable onPress={() => setIsAddingCTB(false)}>
                            <Ionicons name="close" size={24} color="#666" />
                        </Pressable>
                    </View>

                    <TextInput
                        style={styles.input}
                        placeholder="CTB ID (e.g., FOOD-001)"
                        placeholderTextColor="#666"
                        value={newCTBId}
                        onChangeText={setNewCTBId}
                        autoCapitalize="characters"
                    />

                    <View style={styles.sizeSelector}>
                        <ThemedText style={styles.label}>Size:</ThemedText>
                        {[0.5, 1.0, 2.0, 4.0].map((size) => (
                            <Pressable
                                key={size}
                                style={[styles.sizeChip, newCTBSize === size && styles.sizeChipSelected]}
                                onPress={() => setNewCTBSize(size as CTBSize)}
                            >
                                <ThemedText style={[styles.sizeText, newCTBSize === size && styles.sizeTextSelected]}>
                                    {size}
                                </ThemedText>
                            </Pressable>
                        ))}
                    </View>

                    <Pressable style={styles.addButton} onPress={handleAddCTB}>
                        <ThemedText style={styles.addButtonText}>Add to Manifest</ThemedText>
                    </Pressable>
                </View>
            ) : (
                <Pressable style={styles.fab} onPress={() => setIsAddingCTB(true)}>
                    <Ionicons name="add" size={32} color="#FFFFFF" />
                </Pressable>
            )}

            {/* Add Item Modal */}
            <AddItemModal
                visible={isAddingItem}
                targetCtbId={activeCtbId || undefined}
                onClose={() => {
                    setIsAddingItem(false);
                    setActiveCtbId(null);
                }}
                onAdd={(item) => {
                    if (!activeCtbId) return;

                    // Add item to manifest items
                    setManifest(prev => {
                        const updatedCtbs = prev.ctbs.map(ctb => {
                            if (ctb.id === activeCtbId) {
                                return {
                                    ...ctb,
                                    items: [...ctb.items, item.id]
                                };
                            }
                            return ctb;
                        });

                        return {
                            ctbs: updatedCtbs,
                            items: [...prev.items, item]
                        };
                    });

                    // Note: We don't close modal here because AddItemModal handles its own close/next logic
                    // But we need to respect the modal's internal state if it calls onAdd multiple times
                    // Actually AddItemModal calls onClose() internally unless we changed it to keepOpen.
                    // The onAdd prop in AddItemModal is called BEFORE onClose.
                }}
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0B0D',
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 12,
        paddingBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#2A2B2E',
    },
    sendButton: {
        backgroundColor: '#10B981',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    disabledButton: {
        backgroundColor: '#333',
        opacity: 0.5,
    },
    sendButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 14,
    },
    content: {
        flex: 1,
        padding: 12,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
        opacity: 0.5,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubText: {
        fontSize: 14,
        color: '#888',
    },
    manifestList: {
        gap: 12,
    },
    ctbCard: {
        backgroundColor: '#1A1B1E',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#2A2B2E',
        overflow: 'hidden',
    },
    ctbHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    ctbHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ctbIcon: {
        width: 40,
        height: 40,
        backgroundColor: '#111214',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    ctbInfo: {
        flex: 1,
    },
    ctbId: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    ctbMeta: {
        fontSize: 12,
        color: '#888',
    },
    itemsList: {
        backgroundColor: '#111214',
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#2A2B2E',
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    itemName: {
        fontSize: 13,
        color: '#CCC',
    },
    itemQty: {
        fontSize: 13,
        color: '#888',
        fontWeight: '600',
    },
    packButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        backgroundColor: '#1A1B1E',
        borderTopWidth: 1,
        borderTopColor: '#2A2B2E',
        gap: 8,
    },
    packButtonText: {
        color: '#0F6FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    fab: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#0F6FFF',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    fabGroup: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        alignItems: 'center',
        gap: 16,
    },
    fabSmall: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#333',
    },
    addPanel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#1C1C1E',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    addPanelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    addPanelTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    input: {
        backgroundColor: '#2C2C2E',
        borderRadius: 10,
        padding: 12,
        marginBottom: 16,
        color: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#3A3A3C',
        fontSize: 16,
    },
    sizeSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 8,
    },
    label: {
        fontSize: 16,
        marginRight: 8,
    },
    sizeChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#2C2C2E',
        borderWidth: 1,
        borderColor: '#3A3A3C',
    },
    sizeChipSelected: {
        backgroundColor: '#0F6FFF',
        borderColor: '#0F6FFF',
    },
    sizeText: {
        color: '#888',
        fontSize: 14,
    },
    sizeTextSelected: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    addButton: {
        backgroundColor: '#0F6FFF',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    addButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
