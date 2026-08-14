import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DiscrepancyType, InventoryItem } from '../types/dslm';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Colors } from '../constants/colors';

type ReportDiscrepancyModalProps = {
    visible: boolean;
    item: InventoryItem | null;
    onClose: () => void;
    onReport: (type: DiscrepancyType, description: string) => void;
};

const DISCREPANCY_TYPES: { type: DiscrepancyType; label: string; icon: string; color: string; desc: string }[] = [
    { type: 'wrong-quantity', label: 'Wrong Quantity', icon: 'calculator-outline', color: '#F59E0B', desc: 'Count does not match manifest' },
    { type: 'missing', label: 'Missing Item', icon: 'help-circle-outline', color: '#EF4444', desc: 'Item not found in CTB' },
    { type: 'damaged', label: 'Damaged', icon: 'alert-circle-outline', color: '#F97316', desc: 'Item arrived damaged or broken' },
    { type: 'wrong-item', label: 'Wrong Item', icon: 'swap-horizontal-outline', color: '#8B5CF6', desc: 'Different item than expected' },
];

export function ReportDiscrepancyModal({ visible, item, onClose, onReport }: ReportDiscrepancyModalProps) {
    const [selectedType, setSelectedType] = useState<DiscrepancyType | null>(null);
    const [description, setDescription] = useState('');

    const handleSubmit = () => {
        if (!selectedType || !description.trim()) return;
        onReport(selectedType, description.trim());
        setSelectedType(null);
        setDescription('');
        onClose();
    };

    const handleClose = () => {
        setSelectedType(null);
        setDescription('');
        onClose();
    };

    if (!item) return null;

    return (
        <Modal
            animationType="fade"
            transparent
            visible={visible}
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <ThemedView style={styles.modal}>
                    <ThemedText type="title" style={styles.title}>Report Discrepancy</ThemedText>
                    <ThemedText style={styles.subtitle}>for "{item.name}"</ThemedText>

                    <ThemedText style={styles.label}>Type</ThemedText>
                    <View style={styles.typeGrid}>
                        {DISCREPANCY_TYPES.map(({ type, label, icon, color, desc }) => (
                            <Pressable
                                key={type}
                                style={[
                                    styles.typeCard,
                                    selectedType === type && { borderColor: color, backgroundColor: `${color}15` },
                                ]}
                                onPress={() => setSelectedType(type)}
                            >
                                <Ionicons
                                    name={icon as any}
                                    size={24}
                                    color={selectedType === type ? color : Colors.textSecondary}
                                />
                                <ThemedText style={[
                                    styles.typeLabel,
                                    selectedType === type && { color },
                                ]}>
                                    {label}
                                </ThemedText>
                                <ThemedText style={styles.typeDesc}>{desc}</ThemedText>
                            </Pressable>
                        ))}
                    </View>

                    <ThemedText style={styles.label}>
                        Description <ThemedText style={styles.required}>*</ThemedText>
                    </ThemedText>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Describe the discrepancy..."
                        placeholderTextColor="#666"
                        multiline
                        numberOfLines={4}
                    />

                    <View style={styles.buttons}>
                        <Pressable style={[styles.btn, styles.btnCancel]} onPress={handleClose}>
                            <ThemedText style={styles.btnText}>Cancel</ThemedText>
                        </Pressable>
                        <Pressable
                            style={[
                                styles.btn,
                                styles.btnSubmit,
                                (!selectedType || !description.trim()) && styles.btnDisabled,
                            ]}
                            onPress={handleSubmit}
                            disabled={!selectedType || !description.trim()}
                        >
                            <ThemedText style={[styles.btnText, { color: '#000' }]}>Submit Report</ThemedText>
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
        maxHeight: '85%',
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
        textAlign: 'center',
        color: '#FFFFFF',
    },
    subtitle: {
        textAlign: 'center',
        fontSize: 14,
        color: Colors.textSecondary,
        marginBottom: 20,
    },
    label: {
        marginBottom: 8,
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    required: {
        color: '#FF453A',
        fontWeight: '600',
    },
    typeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 20,
    },
    typeCard: {
        width: '47%',
        backgroundColor: '#2C2C2E',
        borderRadius: 12,
        padding: 14,
        borderWidth: 2,
        borderColor: '#3A3A3C',
        gap: 4,
    },
    typeLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginTop: 4,
    },
    typeDesc: {
        fontSize: 11,
        color: Colors.textTertiary,
    },
    input: {
        backgroundColor: '#2C2C2E',
        borderRadius: 10,
        padding: 12,
        marginBottom: 20,
        color: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#3A3A3C',
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
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
    btnSubmit: {
        backgroundColor: '#F59E0B',
    },
    btnDisabled: {
        opacity: 0.4,
    },
    btnText: {
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
    },
});
