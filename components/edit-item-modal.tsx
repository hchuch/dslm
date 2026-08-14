import React, { useState, useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { InventoryItem, ItemCategory } from '../types/dslm';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Colors } from '../constants/colors';

type EditItemModalProps = {
    visible: boolean;
    item: InventoryItem | null;
    onClose: () => void;
    onSave: (updates: Partial<InventoryItem>) => void;
};

const CATEGORIES: ItemCategory[] = [
    'food', 'water', 'medical', 'hygiene', 'clothing',
    'scientific-equipment', 'spare-parts', 'lab-equipment', 'lunar-equipment', 'misc',
];

const CRITICALITY_LEVELS: InventoryItem['criticality'][] = ['low', 'medium', 'high', 'critical'];

const CRITICALITY_COLORS: Record<string, string> = {
    low: '#10B981',
    medium: Colors.blue,
    high: '#F59E0B',
    critical: '#EF4444',
};

export function EditItemModal({ visible, item, onClose, onSave }: EditItemModalProps) {
    const [name, setName] = useState('');
    const [category, setCategory] = useState<ItemCategory>('misc');
    const [quantity, setQuantity] = useState('');
    const [mass, setMass] = useState('');
    const [volume, setVolume] = useState('');
    const [criticality, setCriticality] = useState<InventoryItem['criticality']>('medium');
    const [expiryDate, setExpiryDate] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (item && visible) {
            setName(item.name);
            setCategory(item.category);
            setQuantity(String(item.quantity));
            setMass(String(item.mass));
            setVolume(String(item.volume));
            setCriticality(item.criticality);
            setExpiryDate(item.expiryDate ? item.expiryDate.toISOString().split('T')[0] : '');
            setDescription(item.description || '');
        }
    }, [item, visible]);

    const handleSave = () => {
        if (!item) return;

        const updates: Partial<InventoryItem> = {};

        if (name !== item.name) updates.name = name;
        if (category !== item.category) updates.category = category;
        const parsedQty = parseInt(quantity);
        if (!isNaN(parsedQty) && parsedQty !== item.quantity) updates.quantity = parsedQty;
        const parsedMass = parseFloat(mass);
        if (!isNaN(parsedMass) && parsedMass !== item.mass) updates.mass = parsedMass;
        const parsedVolume = parseFloat(volume);
        if (!isNaN(parsedVolume) && parsedVolume !== item.volume) updates.volume = parsedVolume;
        if (criticality !== item.criticality) updates.criticality = criticality;
        if (description !== (item.description || '')) updates.description = description;

        const existingExpiry = item.expiryDate ? item.expiryDate.toISOString().split('T')[0] : '';
        if (expiryDate !== existingExpiry) {
            updates.expiryDate = expiryDate ? new Date(expiryDate) : undefined;
        }

        if (Object.keys(updates).length > 0) {
            onSave(updates);
        }
        onClose();
    };

    if (!item) return null;

    return (
        <Modal
            animationType="fade"
            transparent
            visible={visible}
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <ThemedView style={styles.modal}>
                    <ThemedText type="title" style={styles.title}>Edit Item</ThemedText>

                    <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
                        <ThemedText style={styles.label}>Name</ThemedText>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholderTextColor="#666"
                        />

                        <ThemedText style={styles.label}>Category</ThemedText>
                        <View style={styles.chipContainer}>
                            {CATEGORIES.map((cat) => (
                                <Pressable
                                    key={cat}
                                    style={[styles.chip, category === cat && styles.chipSelected]}
                                    onPress={() => setCategory(cat)}
                                >
                                    <ThemedText style={[
                                        styles.chipText,
                                        category === cat && styles.chipTextSelected,
                                    ]}>
                                        {cat}
                                    </ThemedText>
                                </Pressable>
                            ))}
                        </View>

                        <ThemedText style={styles.label}>Quantity</ThemedText>
                        <TextInput
                            style={styles.input}
                            value={quantity}
                            onChangeText={setQuantity}
                            keyboardType="numeric"
                            placeholderTextColor="#666"
                        />

                        <ThemedText style={styles.label}>Mass (kg)</ThemedText>
                        <TextInput
                            style={styles.input}
                            value={mass}
                            onChangeText={setMass}
                            keyboardType="numeric"
                            placeholderTextColor="#666"
                        />

                        <ThemedText style={styles.label}>Volume (m³)</ThemedText>
                        <TextInput
                            style={styles.input}
                            value={volume}
                            onChangeText={setVolume}
                            keyboardType="numeric"
                            placeholderTextColor="#666"
                        />

                        <ThemedText style={styles.label}>Criticality</ThemedText>
                        <View style={styles.chipContainer}>
                            {CRITICALITY_LEVELS.map((level) => (
                                <Pressable
                                    key={level}
                                    style={[
                                        styles.chip,
                                        criticality === level && {
                                            backgroundColor: CRITICALITY_COLORS[level],
                                            borderColor: CRITICALITY_COLORS[level],
                                        },
                                    ]}
                                    onPress={() => setCriticality(level)}
                                >
                                    <ThemedText style={[
                                        styles.chipText,
                                        criticality === level && { color: '#000', fontWeight: '600' },
                                    ]}>
                                        {level}
                                    </ThemedText>
                                </Pressable>
                            ))}
                        </View>

                        <ThemedText style={styles.label}>Expiration Date</ThemedText>
                        <TextInput
                            style={styles.input}
                            value={expiryDate}
                            onChangeText={setExpiryDate}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="#666"
                            keyboardType="numbers-and-punctuation"
                        />

                        <ThemedText style={styles.label}>Description</ThemedText>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Item description"
                            placeholderTextColor="#666"
                            multiline
                            numberOfLines={3}
                        />
                    </ScrollView>

                    <View style={styles.buttons}>
                        <Pressable style={[styles.btn, styles.btnCancel]} onPress={onClose}>
                            <ThemedText style={styles.btnText}>Cancel</ThemedText>
                        </Pressable>
                        <Pressable style={[styles.btn, styles.btnSave]} onPress={handleSave}>
                            <ThemedText style={[styles.btnText, { color: '#000' }]}>Save Changes</ThemedText>
                        </Pressable>
                    </View>
                </ThemedView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modal: {
        width: '90%',
        maxHeight: '80%',
        backgroundColor: '#1C1C1E',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    title: {
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
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#2C2C2E',
        borderWidth: 1,
        borderColor: '#3A3A3C',
    },
    chipSelected: {
        backgroundColor: Colors.blue,
        borderColor: Colors.blue,
    },
    chipText: {
        fontSize: 14,
        color: '#8E8E93',
    },
    chipTextSelected: {
        color: '#000',
        fontWeight: '600',
    },
    buttons: {
        flexDirection: 'row',
        gap: 12,
    },
    btn: {
        flex: 1,
        borderRadius: 10,
        padding: 12,
        alignItems: 'center',
    },
    btnCancel: {
        backgroundColor: '#3A3A3C',
    },
    btnSave: {
        backgroundColor: Colors.blue,
    },
    btnText: {
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
    },
});
