import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useInventory } from '../hooks/use-inventory';
import type { InventoryItem } from '../types/dslm';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

type AddItemModalProps = {
    visible: boolean;
    onClose: () => void;
};

export default function AddItemModal({ visible, onClose }: AddItemModalProps) {
    const { addItem } = useInventory();
    const [name, setName] = useState('');
    const [category, setCategory] = useState('misc');
    const [quantity, setQuantity] = useState('1');

    const handleAdd = () => {
        if (!name) return;

        const newItem: InventoryItem = {
            id: `ITEM-${Date.now()}`,
            name,
            description: 'User added item',
            category: category as any,
            status: 'incoming',
            rfidTag: {
                type: 'barcode',
                id: `BC-${Date.now()}`,
                assignedDate: new Date(),
            },
            ctbId: 'CTB-USER',
            location: { stack: 'S1', position: 1, layer: 1, path: 'S1-P1-L1' },
            mass: 1.0,
            volume: 0.1,
            quantity: parseInt(quantity) || 1,
            loadedDate: new Date(),
            criticality: 'low',
            history: [],
        };

        addItem(newItem);
        setName('');
        setQuantity('1');
        onClose();
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
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
                            {['food', 'medical', 'spare-parts', 'misc'].map((cat) => (
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
                    </ScrollView>

                    <View style={styles.buttonContainer}>
                        <Pressable style={[styles.button, styles.buttonCancel]} onPress={onClose}>
                            <ThemedText style={styles.textStyle}>Cancel</ThemedText>
                        </Pressable>
                        <Pressable style={[styles.button, styles.buttonAdd]} onPress={handleAdd}>
                            <ThemedText style={styles.textStyle}>Add Item</ThemedText>
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
        backgroundColor: '#0B3D91',
        borderColor: '#0B3D91',
    },
    categoryText: {
        fontSize: 14,
        color: '#8E8E93',
    },
    categoryTextSelected: {
        color: '#FFFFFF',
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
    buttonAdd: {
        backgroundColor: '#0B3D91',
    },
    textStyle: {
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
    },
});
