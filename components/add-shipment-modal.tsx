import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Colors } from '../constants/colors';
import { useDialog } from '../hooks/use-dialog';
import { useInventory } from '../hooks/use-inventory';
import { useNFC } from '../hooks/use-nfc';
import type { CTB, CTBSize, InventoryItem, ItemCategory, Location, StackId } from '../types/dslm';
import { CTB_VOLUME_SPECS } from '../types/dslm';
import { NFCScannerModal } from './nfc-scanner-modal';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

type Props = {
    visible: boolean;
    onClose: () => void;
};

export function AddShipmentModal({ visible, onClose }: Props) {
    const { addCTB, addItem } = useInventory();
    const { showDialog } = useDialog();
    const { isSupported: nfcSupported } = useNFC();
    const [showNFCScanner, setShowNFCScanner] = useState(false);
    const [nfcTargetCtbId, setNfcTargetCtbId] = useState<string | null>(null);

    const [ctbId, setCtbId] = useState('');
    const [ctbSize, setCtbSize] = useState<CTBSize>(1.0);
    const [targetStack, setTargetStack] = useState<StackId>('S1');
    const [targetPosition, setTargetPosition] = useState(1);
    const [showStackPicker, setShowStackPicker] = useState(false);
    const [showPositionPicker, setShowPositionPicker] = useState(false);

    const STACKS: StackId[] = ['S1', 'S2', 'S3', 'C1', 'C2'];
    const POSITIONS = Array.from({ length: 16 }, (_, i) => i + 1);

    const [items, setItems] = useState<Partial<InventoryItem>[]>([]);
    const [newItemName, setNewItemName] = useState('');
    const [newItemQty, setNewItemQty] = useState('1');
    const [newItemCategory, setNewItemCategory] = useState<ItemCategory>('misc');

    const handleAddItem = () => {
        if (!newItemName) return;

        setItems(prev => [
            ...prev,
            {
                id: `ITEM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: newItemName,
                quantity: parseInt(newItemQty) || 1,
                category: newItemCategory,
                status: 'incoming',
                mass: 1.0,
                volume: 0.1,
            }
        ]);

        setNewItemName('');
        setNewItemQty('1');
    };

    const handleRemoveItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = () => {
        if (!ctbId) {
            showDialog('Error', 'Please enter a CTB ID');
            return;
        }

        const location: Location = {
            stack: targetStack,
            position: targetPosition,
            layer: 1,
            path: `${targetStack}-P${targetPosition}-L1`
        };

        const volumeSpecs = CTB_VOLUME_SPECS[ctbSize] ?? { packed: ctbSize * 0.028, unpacked: ctbSize * 0.025 };

        const newCTB: CTB = {
            id: ctbId,
            rfidTag: {
                type: 'RFID',
                id: `RFID-${ctbId}`,
                assignedDate: new Date(),
                batteryLife: 365
            },
            size: ctbSize,
            location,
            childCTBs: [],
            items: items.map(i => i.id!),
            mass: items.reduce((sum, i) => sum + (i.mass || 0), 0) + 1.0, // Items + container
            volume: ctbSize * 0.1, // Approximation
            packedVolume: volumeSpecs.packed,
            unpackedVolume: volumeSpecs.unpacked,
            nestingDepth: 0,
            isWaste: false,
            loadedDate: new Date(),
        };

        addCTB(newCTB);

        items.forEach(item => {
            addItem({
                ...item,
                ctbId: ctbId,
                location,
                loadedDate: new Date(),
                description: 'Incoming shipment item',
                history: [{
                    timestamp: new Date(),
                    action: 'loaded',
                    notes: 'Initial shipment load'
                }]
            } as InventoryItem);
        });

        if (nfcSupported) {
            showDialog(
                'Assign NFC Tag',
                `Scan an NFC tag for ${ctbId}?\n\nNFC tags are strongly recommended for tracking CTBs.`,
                [
                    {
                        text: 'Skip',
                        style: 'cancel',
                        onPress: () => {
                            setCtbId('');
                            setItems([]);
                            onClose();
                        },
                    },
                    {
                        text: 'Scan NFC Tag',
                        onPress: () => {
                            setNfcTargetCtbId(ctbId);
                            setShowNFCScanner(true);
                        },
                    },
                ],
            );
        } else {
            setCtbId('');
            setItems([]);
            onClose();
        }
    };

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
                    <ThemedText style={styles.headerTitle}>New Incoming Shipment</ThemedText>
                    <Pressable onPress={onClose}>
                        <ThemedText style={styles.closeButton}>Cancel</ThemedText>
                    </Pressable>
                </View>

                <ScrollView style={styles.content}>
                    <View style={styles.section}>
                        <ThemedText style={styles.sectionTitle}>Container Details</ThemedText>

                        <View style={styles.inputGroup}>
                            <ThemedText style={styles.label}>CTB ID</ThemedText>
                            <TextInput
                                style={styles.input}
                                value={ctbId}
                                onChangeText={setCtbId}
                                placeholder="e.g., CTB-NEW-001"
                                placeholderTextColor="#666"
                            />
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                <ThemedText style={styles.label}>Stack</ThemedText>
                                <Pressable
                                    style={styles.dropdown}
                                    onPress={() => setShowStackPicker(!showStackPicker)}
                                >
                                    <ThemedText style={styles.dropdownText}>{targetStack}</ThemedText>
                                    <Ionicons name={showStackPicker ? 'chevron-up' : 'chevron-down'} size={18} color="#888" />
                                </Pressable>
                                {showStackPicker && (
                                    <View style={styles.pickerContainer}>
                                        {STACKS.map((stack) => (
                                            <Pressable
                                                key={stack}
                                                style={[
                                                    styles.pickerItem,
                                                    targetStack === stack && styles.pickerItemSelected,
                                                ]}
                                                onPress={() => {
                                                    setTargetStack(stack);
                                                    setShowStackPicker(false);
                                                }}
                                            >
                                                <ThemedText
                                                    style={[
                                                        styles.pickerItemText,
                                                        targetStack === stack && styles.pickerItemTextSelected,
                                                    ]}
                                                >
                                                    {stack}
                                                </ThemedText>
                                                {targetStack === stack && (
                                                    <Ionicons name="checkmark" size={18} color="#FFF" />
                                                )}
                                            </Pressable>
                                        ))}
                                    </View>
                                )}
                            </View>
                            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                                <ThemedText style={styles.label}>Position</ThemedText>
                                <Pressable
                                    style={styles.dropdown}
                                    onPress={() => setShowPositionPicker(!showPositionPicker)}
                                >
                                    <ThemedText style={styles.dropdownText}>{targetPosition}</ThemedText>
                                    <Ionicons name={showPositionPicker ? 'chevron-up' : 'chevron-down'} size={18} color="#888" />
                                </Pressable>
                                {showPositionPicker && (
                                    <View style={styles.pickerContainer}>
                                        <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                                            {POSITIONS.map((pos) => (
                                                <Pressable
                                                    key={pos}
                                                    style={[
                                                        styles.pickerItem,
                                                        targetPosition === pos && styles.pickerItemSelected,
                                                    ]}
                                                    onPress={() => {
                                                        setTargetPosition(pos);
                                                        setShowPositionPicker(false);
                                                    }}
                                                >
                                                    <ThemedText
                                                        style={[
                                                            styles.pickerItemText,
                                                            targetPosition === pos && styles.pickerItemTextSelected,
                                                        ]}
                                                    >
                                                        Position {pos}
                                                    </ThemedText>
                                                    {targetPosition === pos && (
                                                        <Ionicons name="checkmark" size={18} color="#FFF" />
                                                    )}
                                                </Pressable>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <ThemedText style={styles.sectionTitle}>Contents</ThemedText>

                        <View style={styles.addItemForm}>
                            <TextInput
                                style={[styles.input, { marginBottom: 8 }]}
                                value={newItemName}
                                onChangeText={setNewItemName}
                                placeholder="Item Name"
                                placeholderTextColor="#666"
                            />
                            <View style={styles.row}>
                                <TextInput
                                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                                    value={newItemQty}
                                    onChangeText={setNewItemQty}
                                    keyboardType="numeric"
                                    placeholder="Qty"
                                    placeholderTextColor="#666"
                                />
                                <Pressable style={styles.addButton} onPress={handleAddItem}>
                                    <Ionicons name="add" size={24} color="#000" />
                                </Pressable>
                            </View>
                        </View>

                        {items.map((item, index) => (
                            <View key={index} style={styles.itemRow}>
                                <View style={styles.itemInfo}>
                                    <ThemedText style={styles.itemName}>{item.name}</ThemedText>
                                    <ThemedText style={styles.itemMeta}>Qty: {item.quantity}</ThemedText>
                                </View>
                                <Pressable onPress={() => handleRemoveItem(index)}>
                                    <Ionicons name="trash-outline" size={20} color="#FF4444" />
                                </Pressable>
                            </View>
                        ))}
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <Pressable style={styles.submitButton} onPress={handleSubmit}>
                        <ThemedText style={styles.submitButtonText}>Create Shipment</ThemedText>
                    </Pressable>
                </View>

                <NFCScannerModal
                    visible={showNFCScanner}
                    mode="write"
                    writeData={nfcTargetCtbId || undefined}
                    title="Assign NFC Tag"
                    subtitle={`Hold device near NFC tag to assign it to ${nfcTargetCtbId}`}
                    onClose={() => {
                        setShowNFCScanner(false);
                        setNfcTargetCtbId(null);
                        setCtbId('');
                        setItems([]);
                        onClose();
                    }}
                    onWriteSuccess={(result) => {
                        if (result.success) {
                            showDialog('Success', `NFC tag assigned to ${nfcTargetCtbId}`);
                        }
                        setShowNFCScanner(false);
                        setNfcTargetCtbId(null);
                        setCtbId('');
                        setItems([]);
                        onClose();
                    }}
                />
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2B2E',
        backgroundColor: '#111214',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    closeButton: {
        color: Colors.textSecondary,
        fontSize: 16,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
        opacity: 0.7,
        textTransform: 'uppercase',
    },
    inputGroup: {
        marginBottom: 12,
    },
    label: {
        fontSize: 12,
        marginBottom: 6,
        opacity: 0.8,
    },
    input: {
        backgroundColor: '#1A1B1E',
        borderWidth: 1,
        borderColor: '#2A2B2E',
        borderRadius: 8,
        padding: 12,
        color: '#FFF',
        fontSize: 16,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    dropdown: {
        backgroundColor: '#1A1B1E',
        borderWidth: 1,
        borderColor: '#2A2B2E',
        borderRadius: 8,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dropdownText: {
        color: '#FFF',
        fontSize: 16,
    },
    pickerContainer: {
        backgroundColor: '#1A1B1E',
        borderWidth: 1,
        borderColor: '#2A2B2E',
        borderRadius: 8,
        marginTop: 4,
        overflow: 'hidden',
    },
    pickerScroll: {
        maxHeight: 200,
    },
    pickerItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2B2E',
    },
    pickerItemSelected: {
        backgroundColor: Colors.blueGlow,
    },
    pickerItemText: {
        color: '#FFF',
        fontSize: 14,
    },
    pickerItemTextSelected: {
        color: Colors.textPrimary,
        fontWeight: '600',
    },
    addItemForm: {
        backgroundColor: '#111214',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#2A2B2E',
    },
    addButton: {
        backgroundColor: Colors.blue,
        width: 44,
        height: 44,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1A1B1E',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#2A2B2E',
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '500',
    },
    itemMeta: {
        fontSize: 12,
        opacity: 0.5,
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#2A2B2E',
        backgroundColor: '#111214',
    },
    submitButton: {
        backgroundColor: Colors.blue,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    submitButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
});
