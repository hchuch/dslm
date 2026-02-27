import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useInventory } from '../hooks/use-inventory';
import { useDialog } from '../hooks/use-dialog';
import type { InventoryItem, ItemCategory } from '../types/dslm';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Colors } from '../constants/colors';

type AddItemModalProps = {
    visible: boolean;
    onClose: () => void;
    onAdd?: (item: InventoryItem) => void;
    targetCtbId?: string;
};

// Categories that require expiration dates
const EXPIRY_REQUIRED_CATEGORIES: ItemCategory[] = ['food', 'medical'];

export default function AddItemModal({ visible, onClose, onAdd, targetCtbId }: AddItemModalProps) {
    const { addItem } = useInventory();
    const { showDialog } = useDialog();
    const [name, setName] = useState('');
    const [category, setCategory] = useState<ItemCategory>('misc');
    const [quantity, setQuantity] = useState('1');
    const [mass, setMass] = useState('1.0');
    const [expiryDate, setExpiryDate] = useState(''); // Format: YYYY-MM-DD
    const [subItems, setSubItems] = useState<string[]>([]);
    const [subItemName, setSubItemName] = useState('');

    const requiresExpiry = EXPIRY_REQUIRED_CATEGORIES.includes(category);

    const handleAdd = (keepOpen = false) => {
        if (!name) {
            showDialog('Required', 'Please enter an item name.');
            return;
        }

        // Validate expiry date for food/medical items
        if (requiresExpiry && !expiryDate) {
            showDialog('Required', `Expiration date is required for ${category} items.`);
            return;
        }

        // Parse expiry date if provided
        let parsedExpiryDate: Date | undefined;
        if (expiryDate) {
            parsedExpiryDate = new Date(expiryDate);
            if (isNaN(parsedExpiryDate.getTime())) {
                showDialog('Invalid Date', 'Please enter a valid expiration date (YYYY-MM-DD).');
                return;
            }
        }

        const newItem: InventoryItem = {
            id: `ITEM-${Date.now()}`,
            name,
            description: 'User added item',
            category,
            status: 'incoming',
            rfidTag: {
                type: 'barcode',
                id: `BC-${Date.now()}`,
                assignedDate: new Date(),
            },
            ctbId: targetCtbId || 'CTB-USER',
            location: { stack: 'INCOMING' as any, position: 0, layer: 0, path: 'INCOMING' },
            mass: parseFloat(mass) || 1.0,
            volume: 0.1,
            quantity: parseInt(quantity) || 1,
            loadedDate: new Date(),
            expiryDate: parsedExpiryDate,
            criticality: 'low',

            history: [],
            subItems: subItems.map((subName, index) => ({
                id: `SUB-${Date.now()}-${index}`,
                name: subName,
                description: 'Nested item',
                category: 'misc',
                status: 'incoming',
                ctbId: targetCtbId || 'CTB-USER',
                location: { stack: 'INCOMING' as any, position: 0, layer: 0, path: 'INCOMING' },
                mass: 0.1,
                volume: 0.01,
                quantity: 1,
                loadedDate: new Date(),
                criticality: 'low',
                history: [],
            })),
        };

        if (onAdd) {
            onAdd(newItem);
        } else {
            addItem(newItem);
        }
        setName('');
        setQuantity('1');
        setMass('1.0');
        setExpiryDate('');
        setSubItems([]);
        setSubItemName('');

        if (!keepOpen) {
            onClose();
        }
    };

    const handleAddSubItem = () => {
        if (!subItemName.trim()) return;
        setSubItems([...subItems, subItemName.trim()]);
        setSubItemName('');
    };

    const removeSubItem = (index: number) => {
        setSubItems(subItems.filter((_, i) => i !== index));
    };

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={styles.centeredView}>
                <ThemedView style={styles.modalView}>
                    <ThemedText type="title" style={styles.modalTitle}>Add New Item</ThemedText>

                    <ScrollView style={styles.form}>
                        <ThemedText style={styles.label}>Item Name</ThemedText>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter item name"
                            placeholderTextColor="#666"
                            value={name}
                            onChangeText={setName}
                        />

                        <ThemedText style={styles.label}>Category</ThemedText>
                        <View style={styles.categoryContainer}>
                            {(['food', 'medical', 'spare-parts', 'misc'] as ItemCategory[]).map((cat) => (
                                <Pressable
                                    key={cat}
                                    style={[
                                        styles.categoryChip,
                                        category === cat && styles.categoryChipSelected
                                    ]}
                                    onPress={() => setCategory(cat)}
                                >
                                    <ThemedText style={[
                                        styles.categoryText,
                                        category === cat && styles.categoryTextSelected
                                    ]}>
                                        {cat}
                                    </ThemedText>
                                </Pressable>
                            ))}
                        </View>

                        <ThemedText style={styles.label}>Quantity</ThemedText>
                        <TextInput
                            style={styles.input}
                            placeholder="1"
                            placeholderTextColor="#666"
                            keyboardType="numeric"
                            value={quantity}
                            onChangeText={setQuantity}
                        />

                        <ThemedText style={styles.label}>Mass (kg)</ThemedText>
                        <TextInput
                            style={styles.input}
                            placeholder="1.0"
                            placeholderTextColor="#666"
                            keyboardType="numeric"
                            value={mass}
                            onChangeText={setMass}
                        />

                        {/* Expiration Date - Required for food/medical */}
                        {requiresExpiry ? (
                            <>
                                <ThemedText style={styles.label}>
                                    Expiration Date <ThemedText style={styles.required}>*</ThemedText>
                                </ThemedText>
                                <TextInput
                                    style={styles.input}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor="#666"
                                    value={expiryDate}
                                    onChangeText={setExpiryDate}
                                    keyboardType="numbers-and-punctuation"
                                />
                                <ThemedText style={styles.expiryHint}>
                                    Required for {category} items
                                </ThemedText>
                            </>
                        ) : (
                            <>
                                <ThemedText style={styles.label}>Expiration Date (Optional)</ThemedText>
                                <TextInput
                                    style={styles.input}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor="#666"
                                    value={expiryDate}
                                    onChangeText={setExpiryDate}
                                    keyboardType="numbers-and-punctuation"
                                />
                            </>
                        )}

                        <ThemedText style={styles.label}>Sub-Items (Nesting)</ThemedText>
                        <View style={styles.subItemInputContainer}>
                            <TextInput
                                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                placeholder="Add sub-item name"
                                placeholderTextColor="#666"
                                value={subItemName}
                                onChangeText={setSubItemName}
                            />
                            <Pressable style={styles.addSubItemBtn} onPress={handleAddSubItem}>
                                <ThemedText style={styles.addSubItemText}>+</ThemedText>
                            </Pressable>
                        </View>

                        {subItems.length > 0 && (
                            <View style={styles.subItemsList}>
                                {subItems.map((item, index) => (
                                    <View key={index} style={styles.subItemRow}>
                                        <ThemedText style={styles.subItemText}>• {item}</ThemedText>
                                        <Pressable onPress={() => removeSubItem(index)}>
                                            <ThemedText style={styles.removeSubItemText}>✕</ThemedText>
                                        </Pressable>
                                    </View>
                                ))}
                            </View>
                        )}
                    </ScrollView>

                    <View style={styles.buttonContainer}>
                        <Pressable style={[styles.button, styles.buttonCancel]} onPress={onClose}>
                            <ThemedText style={styles.textStyle}>Cancel</ThemedText>
                        </Pressable>
                        <Pressable style={[styles.button, styles.buttonNext]} onPress={() => handleAdd(true)}>
                            <ThemedText style={[styles.textStyle, { color: '#000' }]}>Add & Next</ThemedText>
                        </Pressable>
                        <Pressable style={[styles.button, styles.buttonAdd]} onPress={() => handleAdd(false)}>
                            <ThemedText style={styles.textStyle}>Done</ThemedText>
                        </Pressable>
                    </View>
                </ThemedView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        width: '90%',
        maxHeight: '80%',
        backgroundColor: '#1C1C1E',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: {
        marginBottom: 20,
        textAlign: 'center',
        color: '#FFFFFF',
    },
    form: {
        marginBottom: 20,
    },
    label: {
        marginBottom: 8,
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    input: {
        backgroundColor: '#2C2C2E',
        borderRadius: 10,
        padding: 12,
        marginBottom: 16,
        color: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#3A3A3C',
    },
    categoryContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    categoryChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#2C2C2E',
        borderWidth: 1,
        borderColor: '#3A3A3C',
    },
    categoryChipSelected: {
        backgroundColor: Colors.blue,
        borderColor: Colors.blue,
    },
    categoryText: {
        fontSize: 14,
        color: '#8E8E93',
    },
    categoryTextSelected: {
        color: '#000',
        fontWeight: '600',
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    button: {
        flex: 1,
        borderRadius: 10,
        padding: 12,
        elevation: 2,
        alignItems: 'center',
    },
    buttonCancel: {
        backgroundColor: '#3A3A3C',
    },
    buttonNext: {
        backgroundColor: Colors.blue,
        marginHorizontal: 4,
    },
    buttonAdd: {
        backgroundColor: '#10B981',
    },
    textStyle: {
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    subItemInputContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    addSubItemBtn: {
        backgroundColor: '#2C2C2E',
        width: 44,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#3A3A3C',
    },
    addSubItemText: {
        fontSize: 24,
        color: Colors.textPrimary,
        marginTop: -2,
    },
    subItemsList: {
        backgroundColor: '#111214',
        borderRadius: 10,
        padding: 12,
        marginBottom: 20,
    },
    subItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    subItemText: {
        fontSize: 14,
        color: '#CCC',
    },
    removeSubItemText: {
        color: '#FF453A',
        fontSize: 14,
        fontWeight: 'bold',
    },
    required: {
        color: '#FF453A',
        fontWeight: '600',
    },
    expiryHint: {
        fontSize: 12,
        color: '#888',
        marginTop: -12,
        marginBottom: 16,
        fontStyle: 'italic',
    },
});
