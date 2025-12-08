import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Colors } from '../constants/colors';
import type { InventoryItem } from '../types/dslm';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

type ItemDetailModalProps = {
    visible: boolean;
    item: InventoryItem | null;
    onClose: () => void;
};

export default function ItemDetailModal({ visible, item, onClose }: ItemDetailModalProps) {
    if (!item) return null;

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <ThemedView style={styles.modalView}>
                    <View style={styles.header}>
                        <ThemedText type="title" style={styles.modalTitle}>{item.name}</ThemedText>
                        <Pressable onPress={onClose}>
                            <ThemedText style={styles.closeButton}>✕</ThemedText>
                        </Pressable>
                    </View>

                    <ScrollView style={styles.content}>
                        <View style={styles.section}>
                            <ThemedText style={styles.label}>ID</ThemedText>
                            <ThemedText style={styles.value}>{item.id}</ThemedText>
                        </View>

                        <View style={styles.row}>
                            <View style={styles.halfSection}>
                                <ThemedText style={styles.label}>Category</ThemedText>
                                <View style={styles.badge}>
                                    <ThemedText style={styles.badgeText}>{item.category}</ThemedText>
                                </View>
                            </View>
                            <View style={styles.halfSection}>
                                <ThemedText style={styles.label}>Status</ThemedText>
                                <View style={[styles.badge, { backgroundColor: Colors.blue }]}>
                                    <ThemedText style={styles.badgeText}>{item.status}</ThemedText>
                                </View>
                            </View>
                        </View>

                        <View style={styles.section}>
                            <ThemedText style={styles.label}>Location</ThemedText>
                            <ThemedText style={styles.value}>
                                {item.location.path} (Stack: {item.location.stack})
                            </ThemedText>
                        </View>

                        <View style={styles.section}>
                            <ThemedText style={styles.label}>Container</ThemedText>
                            <ThemedText style={styles.value}>{item.ctbId}</ThemedText>
                        </View>

                        <View style={styles.row}>
                            <View style={styles.halfSection}>
                                <ThemedText style={styles.label}>Quantity</ThemedText>
                                <ThemedText style={styles.value}>{item.quantity}</ThemedText>
                            </View>
                            <View style={styles.halfSection}>
                                <ThemedText style={styles.label}>Mass</ThemedText>
                                <ThemedText style={styles.value}>{item.mass} kg</ThemedText>
                            </View>
                        </View>

                        <View style={styles.section}>
                            <ThemedText style={styles.label}>Description</ThemedText>
                            <ThemedText style={styles.value}>{item.description}</ThemedText>
                        </View>

                        {item.rfidTag && (
                            <View style={styles.section}>
                                <ThemedText style={styles.label}>Tracking Tag</ThemedText>
                                <ThemedText style={styles.value}>{item.rfidTag.id} ({item.rfidTag.type})</ThemedText>
                            </View>
                        )}
                    </ScrollView>
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
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    modalView: {
        width: '90%',
        maxHeight: '80%',
        backgroundColor: '#1C1C1E',
        borderRadius: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
        flex: 1,
    },
    closeButton: {
        fontSize: 20,
        color: '#8E8E93',
        padding: 4,
    },
    content: {
        marginBottom: 20,
    },
    section: {
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 16,
    },
    halfSection: {
        flex: 1,
    },
    label: {
        fontSize: 12,
        color: '#8E8E93',
        marginBottom: 4,
        textTransform: 'uppercase',
        fontWeight: '600',
    },
    value: {
        fontSize: 16,
        color: '#FFFFFF',
    },
    badge: {
        backgroundColor: '#2C2C2E',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    badgeText: {
        fontSize: 12,
        color: '#FFFFFF',
        fontWeight: '600',
        textTransform: 'uppercase',
    },
});
