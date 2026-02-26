import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AddItemModal from '../../components/add-item-modal';
import { NFCScannerModal } from '../../components/nfc-scanner-modal';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { Colors } from '../../constants/colors';
import { useInventory } from '../../hooks/use-inventory';
import { useNFC } from '../../hooks/use-nfc';
import type { CTB, CTBSize, InventoryItem, ItemCategory } from '../../types/dslm';
import { CTB_VOLUME_SPECS } from '../../types/dslm';

// Category to ID prefix mapping
const CATEGORY_PREFIXES: Record<ItemCategory, string> = {
    'food': 'FOOD',
    'water': 'WATER',
    'clothing': 'CLOTH',
    'hygiene': 'HYG',
    'medical': 'MED',
    'scientific-equipment': 'SCI',
    'spare-parts': 'SPARE',
    'lab-equipment': 'LAB',
    'lunar-equipment': 'LUNAR',
    'waste': 'WASTE',
    'misc': 'MISC',
};

// Display labels for categories
const CATEGORY_LABELS: Record<ItemCategory, string> = {
    'food': 'Food',
    'water': 'Water',
    'clothing': 'Clothing',
    'hygiene': 'Hygiene',
    'medical': 'Medical',
    'scientific-equipment': 'Scientific Equipment',
    'spare-parts': 'Spare Parts',
    'lab-equipment': 'Lab Equipment',
    'lunar-equipment': 'Lunar Equipment',
    'waste': 'Waste',
    'misc': 'Miscellaneous',
};

type ShipmentView = 'dashboard' | 'builder';
type BuilderTab = 'details' | 'cargo';

export default function ShipmentScreen() {
    const { addShipment, ctbs: existingCtbs } = useInventory();
    const { isSupported: nfcSupported } = useNFC();
    const insets = useSafeAreaInsets();
    const [view, setView] = useState<ShipmentView>('dashboard');
    const [builderTab, setBuilderTab] = useState<BuilderTab>('details');

    // NFC Assignment State
    const [showNFCScanner, setShowNFCScanner] = useState(false);
    const [nfcAssignTarget, setNFCAssignTarget] = useState<string | null>(null);

    // Manifest Builder State
    const [manifestId, setManifestId] = useState(`MNF-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`);
    const [manifestCtbs, setManifestCtbs] = useState<CTB[]>([]);

    const [manifestItems, setManifestItems] = useState<InventoryItem[]>([]);

    // Extended Manifest Metadata
    const [destination, setDestination] = useState('Lunar Gateway');
    const [showDestinationPicker, setShowDestinationPicker] = useState(false);
    const [priority, setPriority] = useState<'Low' | 'Normal' | 'High'>('Normal');
    const [notes, setNotes] = useState('');

    // Available destinations
    const DESTINATIONS = [
        'Lunar Gateway',
        'Lunar Surface Base',
        'Gateway HALO Module',
        'Gateway PPE Module',
        'Artemis Crew',
        'DSLM Storage',
    ];

    // Selection Selection
    const [selectedCtbId, setSelectedCtbId] = useState<string | null>(null);
    const [isAddItemVisible, setIsAddItemVisible] = useState(false);

    // New CTB Draft State
    const [isCreatingCtb, setIsCreatingCtb] = useState(false);
    const [newCtbId, setNewCtbId] = useState('');
    const [newCtbSize, setNewCtbSize] = useState<CTBSize>(1.0);
    const [newCtbMass, setNewCtbMass] = useState(''); // Empty string means auto-calc
    const [selectedCategory, setSelectedCategory] = useState<ItemCategory | null>(null);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);

    // Edit CTB State
    const [editingCtbId, setEditingCtbId] = useState<string | null>(null);
    const [editCtbSize, setEditCtbSize] = useState<CTBSize>(1.0);
    const [editCtbMass, setEditCtbMass] = useState('');

    // Edit Item State
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editItemName, setEditItemName] = useState('');
    const [editItemQty, setEditItemQty] = useState('');
    const [editItemMass, setEditItemMass] = useState('');
    const [editItemExpiry, setEditItemExpiry] = useState('');

    // Generate next CTB ID based on category
    const generateNextCtbId = useCallback((category: ItemCategory): string => {
        const prefix = CATEGORY_PREFIXES[category];

        // Combine existing CTBs from inventory with CTBs in current manifest
        const allCtbs = [...existingCtbs, ...manifestCtbs];

        // Find all CTB IDs that match this prefix pattern (CTB-PREFIX-XXX)
        const pattern = new RegExp(`^CTB-${prefix}-(\\d+)$`);
        const matchingNumbers: number[] = [];

        for (const ctb of allCtbs) {
            const match = ctb.id.match(pattern);
            if (match) {
                matchingNumbers.push(parseInt(match[1], 10));
            }
        }

        // Find the next available number
        const nextNumber = matchingNumbers.length > 0
            ? Math.max(...matchingNumbers) + 1
            : 1;

        return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
    }, [existingCtbs, manifestCtbs]);

    // Handle category selection
    const handleCategorySelect = useCallback((category: ItemCategory) => {
        setSelectedCategory(category);
        const generatedId = generateNextCtbId(category);
        setNewCtbId(generatedId);
        setShowCategoryPicker(false);
    }, [generateNextCtbId]);

    const totalMass = manifestCtbs.reduce((sum, ctb) => sum + ctb.mass, 0);
    const totalVolume = manifestCtbs.reduce((sum, ctb) => sum + ctb.volume, 0);

    const startNewShipment = () => {
        setManifestId(`MNF-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`);
        setManifestCtbs([]);

        setManifestItems([]);
        setDestination('Lunar Gateway');
        setPriority('Normal');
        setNotes('');
        setView('builder');
        setBuilderTab('details');
    };

    const handleAddCtb = () => {
        if (!selectedCategory) {
            Alert.alert('Error', 'Please select a category');
            return;
        }
        if (!newCtbId) {
            Alert.alert('Error', 'Please enter a CTB ID');
            return;
        }

        const ctbId = `CTB-${newCtbId.toUpperCase()}`;
        // Check for duplicate ID in manifest
        if (manifestCtbs.some(c => c.id === ctbId)) {
            Alert.alert('Error', 'CTB ID already exists in this manifest');
            return;
        }
        // Check for duplicate ID in existing inventory
        if (existingCtbs.some(c => c.id === ctbId)) {
            Alert.alert('Error', 'CTB ID already exists in inventory');
            return;
        }

        // Get volume specs for this size
        const volumeSpecs = CTB_VOLUME_SPECS[newCtbSize] ?? { packed: newCtbSize * 0.028, unpacked: newCtbSize * 0.025 };

        const newCTB: CTB = {
            id: ctbId,
            rfidTag: {
                type: 'RFID',
                id: `RFID-${ctbId}`,
                assignedDate: new Date(),
                batteryLife: 365,
            },
            size: newCtbSize,
            location: { stack: 'INCOMING', position: 0, layer: 0, path: 'INCOMING' },
            childCTBs: [],
            items: [],

            mass: newCtbMass ? parseFloat(newCtbMass) : (2.0 * newCtbSize), // Use override or default
            volume: 0.05 * newCtbSize, // Internal volume
            packedVolume: volumeSpecs.packed,
            unpackedVolume: volumeSpecs.unpacked,
            nestingDepth: 0,
            isWaste: false,
            loadedDate: new Date(),
        };

        setManifestCtbs(prev => [...prev, newCTB]);
        setNewCtbId('');
        setNewCtbMass(''); // Reset mass override
        setSelectedCategory(null); // Reset category
        setIsCreatingCtb(false);
        // Auto-select the new CTB to encourage packing
        setSelectedCtbId(ctbId);
    };

    const handleAddItem = (item: InventoryItem) => {
        if (!selectedCtbId) return;

        // Add item to global list
        setManifestItems(prev => [...prev, item]);

        // Link item to CTB
        setManifestCtbs(prev => prev.map(ctb => {
            if (ctb.id === selectedCtbId) {
                return {
                    ...ctb,
                    items: [...ctb.items, item.id],
                    mass: ctb.mass + item.mass, // Update mass
                };
            }
            return ctb;
        }));
    };

    // Start editing a CTB
    const startEditCtb = (ctb: CTB) => {
        setEditingCtbId(ctb.id);
        setEditCtbSize(ctb.size);
        setEditCtbMass(String(ctb.mass));
    };

    // Save CTB edits
    const saveCtbEdit = () => {
        if (!editingCtbId) return;

        const volumeSpecs = CTB_VOLUME_SPECS[editCtbSize] ?? { packed: editCtbSize * 0.028, unpacked: editCtbSize * 0.025 };

        setManifestCtbs(prev => prev.map(ctb => {
            if (ctb.id === editingCtbId) {
                return {
                    ...ctb,
                    size: editCtbSize,
                    mass: parseFloat(editCtbMass) || ctb.mass,
                    packedVolume: volumeSpecs.packed,
                    unpackedVolume: volumeSpecs.unpacked,
                };
            }
            return ctb;
        }));
        setEditingCtbId(null);
    };

    // Delete a CTB from manifest
    const deleteCtb = (ctbId: string) => {
        Alert.alert(
            'Remove CTB',
            'Are you sure you want to remove this CTB and all its items from the manifest?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => {
                        // Remove items belonging to this CTB
                        setManifestItems(prev => prev.filter(item => item.ctbId !== ctbId));
                        // Remove the CTB
                        setManifestCtbs(prev => prev.filter(ctb => ctb.id !== ctbId));
                        if (selectedCtbId === ctbId) {
                            setSelectedCtbId(null);
                        }
                    }
                }
            ]
        );
    };

    // Start editing an item
    const startEditItem = (item: InventoryItem) => {
        setEditingItemId(item.id);
        setEditItemName(item.name);
        setEditItemQty(String(item.quantity));
        setEditItemMass(String(item.mass));
        setEditItemExpiry(item.expiryDate ? item.expiryDate.toISOString().split('T')[0] : '');
    };

    // Save item edits
    const saveItemEdit = () => {
        if (!editingItemId) return;

        const oldItem = manifestItems.find(i => i.id === editingItemId);
        if (!oldItem) return;

        const newMass = parseFloat(editItemMass) || oldItem.mass;
        const massDiff = newMass - oldItem.mass;

        setManifestItems(prev => prev.map(item => {
            if (item.id === editingItemId) {
                return {
                    ...item,
                    name: editItemName || item.name,
                    quantity: parseInt(editItemQty) || item.quantity,
                    mass: newMass,
                    expiryDate: editItemExpiry ? new Date(editItemExpiry) : item.expiryDate,
                };
            }
            return item;
        }));

        // Update CTB mass if item mass changed
        if (massDiff !== 0) {
            setManifestCtbs(prev => prev.map(ctb => {
                if (ctb.id === oldItem.ctbId) {
                    return { ...ctb, mass: ctb.mass + massDiff };
                }
                return ctb;
            }));
        }

        setEditingItemId(null);
    };

    // Handle NFC tag assignment to a CTB
    const handleAssignNFC = (ctbId: string) => {
        setNFCAssignTarget(ctbId);
        setShowNFCScanner(true);
    };

    const handleNFCWriteSuccess = (result: { success: boolean; tagId?: string }) => {
        if (result.success && result.tagId && nfcAssignTarget) {
            // Update the CTB with the assigned NFC tag ID
            setManifestCtbs(prev => prev.map(ctb => {
                if (ctb.id === nfcAssignTarget) {
                    return {
                        ...ctb,
                        rfidTag: {
                            ...ctb.rfidTag,
                            id: result.tagId!,
                            lastScanned: new Date(),
                        },
                    };
                }
                return ctb;
            }));
            Alert.alert('Success', `NFC tag assigned to ${nfcAssignTarget}`);
        }
        setShowNFCScanner(false);
        setNFCAssignTarget(null);
    };

    // Delete an item from manifest
    const deleteItem = (itemId: string) => {
        const item = manifestItems.find(i => i.id === itemId);
        if (!item) return;

        Alert.alert(
            'Remove Item',
            `Remove "${item.name}" from the manifest?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => {
                        // Update CTB mass and items list
                        setManifestCtbs(prev => prev.map(ctb => {
                            if (ctb.id === item.ctbId) {
                                return {
                                    ...ctb,
                                    items: ctb.items.filter(id => id !== itemId),
                                    mass: ctb.mass - item.mass,
                                };
                            }
                            return ctb;
                        }));
                        // Remove the item
                        setManifestItems(prev => prev.filter(i => i.id !== itemId));
                    }
                }
            ]
        );
    };

    const submitShipment = () => {
        if (!destination.trim()) {
            Alert.alert('Validation Error', 'Please enter a destination for this shipment.');
            return;
        }

        if (manifestCtbs.length === 0) {
            Alert.alert('Empty Manifest', 'Cannot send an empty shipment. Please add at least one CTB.');
            return;
        }

        Alert.alert(
            'Confirm Launch',
            `Ready to launch ${manifestId}?\n\n📍 To: ${destination}\n🚀 Priority: ${priority}\n📦 Content: ${manifestCtbs.length} CTBs, ${manifestItems.length} Items\n⚖️ Total Mass: ${totalMass.toFixed(1)}kg`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Launch Shipment',
                    onPress: () => {
                        // In a real app, we'd pass priority/destination/notes to addShipment
                        // For now, we assume addShipment handles the logic or we adapt it later.
                        addShipment(manifestCtbs, manifestItems);
                        Alert.alert('Launch Initiated', `Shipment ${manifestId} has departed for ${destination}.`);
                        setView('dashboard');
                        setManifestCtbs([]);
                        setManifestItems([]);
                        setDestination('Lunar Gateway');
                        setPriority('Normal');
                        setNotes('');
                    }
                }
            ]
        );
    };

    // --- RENDER HELPERS ---

    const renderDashboard = () => (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* Hero Card */}
            <View style={styles.heroCard}>
                <View style={styles.heroContent}>
                    <Ionicons name="rocket-outline" size={48} color={Colors.blue} />
                    <ThemedText style={styles.heroTitle}>Ground Logistics</ThemedText>
                    <ThemedText style={styles.heroSubtitle}>
                        Prepare and manifest cargo for upcoming launch windows.
                    </ThemedText>
                </View>
                <Pressable style={styles.primaryButton} onPress={startNewShipment}>
                    <ThemedText style={styles.primaryButtonText}>Create New Manifest</ThemedText>
                    <Ionicons name="arrow-forward" size={20} color="#FFF" />
                </Pressable>
            </View>

            {/* Recent Activity / Drafts Placeholder */}
            <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle}>Recent Manifests</ThemedText>
            </View>
            <View style={styles.emptyRecent}>
                <ThemedText style={styles.emptyRecentText}>No recent shipments dispatched.</ThemedText>
            </View>
        </ScrollView>
    );

    const renderManifestBuilder = () => (
        <>
            <View style={styles.manifestHeader}>
                <View>
                    <ThemedText style={styles.manifestId}>{manifestId}</ThemedText>
                    <ThemedText style={styles.manifestMeta}>
                        {manifestCtbs.length} CTBs • {manifestItems.length} Items
                    </ThemedText>
                </View>
                <View style={styles.manifestStats}>
                    <ThemedText style={styles.statValue}>{totalMass.toFixed(1)}<ThemedText style={styles.statUnit}>kg</ThemedText></ThemedText>
                </View>
            </View>

            {/* Tab Selector */}
            <View style={styles.tabContainer}>
                <View style={styles.tabSelector}>
                    <Pressable
                        style={[styles.tabBtn, builderTab === 'details' && styles.tabBtnActive]}
                        onPress={() => setBuilderTab('details')}
                    >
                        <ThemedText style={[styles.tabText, builderTab === 'details' && styles.tabTextActive]}>1. Mission Details</ThemedText>
                    </Pressable>
                    <Pressable
                        style={[styles.tabBtn, builderTab === 'cargo' && styles.tabBtnActive]}
                        onPress={() => setBuilderTab('cargo')}
                    >
                        <ThemedText style={[styles.tabText, builderTab === 'cargo' && styles.tabTextActive]}>2. Cargo Manifest</ThemedText>
                    </Pressable>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.builderContent}>
                {builderTab === 'details' ? (
                    /* Manifest Metadata Form */
                    <View style={styles.metaForm}>
                        <View style={styles.metaRow}>
                            <View style={{ flex: 1 }}>
                                <ThemedText style={styles.inputLabel}>Destination <ThemedText style={{ color: Colors.red }}>*</ThemedText></ThemedText>
                                <Pressable
                                    style={styles.dropdown}
                                    onPress={() => setShowDestinationPicker(!showDestinationPicker)}
                                >
                                    <ThemedText style={styles.dropdownText}>{destination}</ThemedText>
                                    <Ionicons name={showDestinationPicker ? 'chevron-up' : 'chevron-down'} size={18} color="#888" />
                                </Pressable>
                                {showDestinationPicker && (
                                    <View style={styles.pickerContainer}>
                                        {DESTINATIONS.map((dest) => (
                                            <Pressable
                                                key={dest}
                                                style={[
                                                    styles.pickerItem,
                                                    destination === dest && styles.pickerItemSelected,
                                                ]}
                                                onPress={() => {
                                                    setDestination(dest);
                                                    setShowDestinationPicker(false);
                                                }}
                                            >
                                                <ThemedText
                                                    style={[
                                                        styles.pickerItemText,
                                                        destination === dest && styles.pickerItemTextSelected,
                                                    ]}
                                                >
                                                    {dest}
                                                </ThemedText>
                                                {destination === dest && (
                                                    <Ionicons name="checkmark" size={18} color={Colors.blue} />
                                                )}
                                            </Pressable>
                                        ))}
                                    </View>
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <ThemedText style={styles.inputLabel}>Priority Level</ThemedText>
                                <View style={styles.prioritySelector}>
                                    {(['Low', 'Normal', 'High'] as const).map(p => (
                                        <Pressable
                                            key={p}
                                            style={[styles.priorityChip, priority === p && styles.priorityChipSelected, priority === p && { borderColor: p === 'High' ? Colors.red : p === 'Low' ? '#aaa' : Colors.blue }]}
                                            onPress={() => setPriority(p)}
                                        >
                                            <ThemedText style={[styles.priorityText, priority === p && styles.priorityTextSelected]}>{p}</ThemedText>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>
                        </View>
                        <View>
                            <ThemedText style={styles.inputLabel}>Mission Notes / Instructions</ThemedText>
                            <TextInput
                                style={[styles.metaInput, styles.textArea]}
                                value={notes}
                                onChangeText={setNotes}
                                placeholder="Add mission notes..."
                                placeholderTextColor="#666"
                                multiline
                            />
                        </View>
                    </View>
                ) : (
                    /* Cargo List */
                    <>
                        {manifestCtbs.length === 0 ? (
                            <View style={styles.builderEmpty}>
                                <Ionicons name="cube-outline" size={64} color="#333" />
                                <ThemedText style={styles.builderEmptyText}>Manifest is empty</ThemedText>
                                <ThemedText style={styles.builderEmptySub}>Add a Cargo Transfer Bag to start packing</ThemedText>
                            </View>
                        ) : (
                            manifestCtbs.map((ctb, idx) => {
                                const itemCount = ctb.items.length;
                                const isSelected = selectedCtbId === ctb.id;
                                const isEditing = editingCtbId === ctb.id;

                                return (
                                    <View key={ctb.id} style={[styles.ctbCard, isSelected && styles.ctbCardSelected]}>
                                        <Pressable
                                            style={styles.ctbHeader}
                                            onPress={() => setSelectedCtbId(isSelected ? null : ctb.id)}
                                        >
                                            <View style={styles.ctbIconInfo}>
                                                <View style={[styles.ctbIcon, isSelected && styles.ctbIconSelected]}>
                                                    <Ionicons name="cube" size={24} color={isSelected ? '#FFF' : Colors.blue} />
                                                </View>
                                                <View>
                                                    <ThemedText style={styles.ctbId}>{ctb.id}</ThemedText>
                                                    <ThemedText style={styles.ctbDetails}>Size {ctb.size} • {ctb.mass.toFixed(1)}kg • {itemCount} Items</ThemedText>
                                                </View>
                                            </View>
                                            <View style={styles.ctbHeaderActions}>
                                                {/* NFC Assignment Button */}
                                                {nfcSupported && (
                                                    <Pressable
                                                        style={[
                                                            styles.ctbActionBtn,
                                                            ctb.rfidTag?.id && !ctb.rfidTag.id.startsWith('RFID-') && styles.nfcAssigned
                                                        ]}
                                                        onPress={(e) => {
                                                            e.stopPropagation();
                                                            handleAssignNFC(ctb.id);
                                                        }}
                                                    >
                                                        <Ionicons
                                                            name="radio-outline"
                                                            size={16}
                                                            color={ctb.rfidTag?.id && !ctb.rfidTag.id.startsWith('RFID-') ? Colors.success : Colors.blue}
                                                        />
                                                    </Pressable>
                                                )}
                                                <Pressable
                                                    style={styles.ctbActionBtn}
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        startEditCtb(ctb);
                                                    }}
                                                >
                                                    <Ionicons name="pencil" size={16} color={Colors.blue} />
                                                </Pressable>
                                                <Pressable
                                                    style={styles.ctbActionBtn}
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        deleteCtb(ctb.id);
                                                    }}
                                                >
                                                    <Ionicons name="trash-outline" size={16} color={Colors.error} />
                                                </Pressable>
                                                <Ionicons name={isSelected ? "chevron-up" : "chevron-down"} size={20} color="#666" />
                                            </View>
                                        </Pressable>

                                        {/* Edit CTB Form */}
                                        {isEditing && (
                                            <View style={styles.editForm}>
                                                <ThemedText style={styles.editFormTitle}>Edit CTB</ThemedText>
                                                <View style={styles.editRow}>
                                                    <ThemedText style={styles.editLabel}>Size</ThemedText>
                                                    <View style={styles.sizeRowSmall}>
                                                        {[0.5, 1.0, 2.0, 4.0].map((size) => (
                                                            <Pressable
                                                                key={size}
                                                                style={[styles.sizeOptionSmall, editCtbSize === size && styles.sizeOptionSelected]}
                                                                onPress={() => setEditCtbSize(size as CTBSize)}
                                                            >
                                                                <ThemedText style={[styles.sizeOptionTextSmall, editCtbSize === size && styles.sizeOptionTextSelected]}>
                                                                    {size}
                                                                </ThemedText>
                                                            </Pressable>
                                                        ))}
                                                    </View>
                                                </View>
                                                <View style={styles.editRow}>
                                                    <ThemedText style={styles.editLabel}>Mass (kg)</ThemedText>
                                                    <TextInput
                                                        style={styles.editInput}
                                                        value={editCtbMass}
                                                        onChangeText={setEditCtbMass}
                                                        keyboardType="numeric"
                                                        placeholder="Mass"
                                                        placeholderTextColor="#666"
                                                    />
                                                </View>
                                                <View style={styles.editActions}>
                                                    <Pressable style={styles.editCancelBtn} onPress={() => setEditingCtbId(null)}>
                                                        <ThemedText style={styles.editCancelText}>Cancel</ThemedText>
                                                    </Pressable>
                                                    <Pressable style={styles.editSaveBtn} onPress={saveCtbEdit}>
                                                        <ThemedText style={styles.editSaveText}>Save</ThemedText>
                                                    </Pressable>
                                                </View>
                                            </View>
                                        )}

                                        {isSelected && !isEditing && (
                                            <View style={styles.ctbExpanded}>
                                                {/* Items List */}
                                                {itemCount > 0 ? (
                                                    <View style={styles.packedList}>
                                                        {manifestItems.filter(i => i.ctbId === ctb.id).map((item, i) => {
                                                            const isEditingThisItem = editingItemId === item.id;

                                                            if (isEditingThisItem) {
                                                                return (
                                                                    <View key={item.id} style={styles.itemEditForm}>
                                                                        <View style={styles.itemEditRow}>
                                                                            <TextInput
                                                                                style={[styles.editInput, { flex: 2 }]}
                                                                                value={editItemName}
                                                                                onChangeText={setEditItemName}
                                                                                placeholder="Name"
                                                                                placeholderTextColor="#666"
                                                                            />
                                                                            <TextInput
                                                                                style={[styles.editInput, { flex: 1 }]}
                                                                                value={editItemQty}
                                                                                onChangeText={setEditItemQty}
                                                                                placeholder="Qty"
                                                                                placeholderTextColor="#666"
                                                                                keyboardType="numeric"
                                                                            />
                                                                        </View>
                                                                        <View style={styles.itemEditRow}>
                                                                            <TextInput
                                                                                style={[styles.editInput, { flex: 1 }]}
                                                                                value={editItemMass}
                                                                                onChangeText={setEditItemMass}
                                                                                placeholder="Mass (kg)"
                                                                                placeholderTextColor="#666"
                                                                                keyboardType="numeric"
                                                                            />
                                                                            <TextInput
                                                                                style={[styles.editInput, { flex: 1 }]}
                                                                                value={editItemExpiry}
                                                                                onChangeText={setEditItemExpiry}
                                                                                placeholder="Expiry (YYYY-MM-DD)"
                                                                                placeholderTextColor="#666"
                                                                            />
                                                                        </View>
                                                                        <View style={styles.editActions}>
                                                                            <Pressable style={styles.editCancelBtn} onPress={() => setEditingItemId(null)}>
                                                                                <ThemedText style={styles.editCancelText}>Cancel</ThemedText>
                                                                            </Pressable>
                                                                            <Pressable style={styles.editSaveBtn} onPress={saveItemEdit}>
                                                                                <ThemedText style={styles.editSaveText}>Save</ThemedText>
                                                                            </Pressable>
                                                                        </View>
                                                                    </View>
                                                                );
                                                            }

                                                            return (
                                                                <View key={item.id} style={styles.packedItem}>
                                                                    <View style={styles.packedItemInfo}>
                                                                        <ThemedText style={styles.packedName} numberOfLines={1}>{item.name}</ThemedText>
                                                                        <ThemedText style={styles.packedMeta}>
                                                                            x{item.quantity} • {item.mass}kg
                                                                            {item.expiryDate && ` • Exp: ${item.expiryDate.toLocaleDateString()}`}
                                                                        </ThemedText>
                                                                    </View>
                                                                    <View style={styles.itemActions}>
                                                                        <Pressable
                                                                            style={styles.itemActionBtn}
                                                                            onPress={() => startEditItem(item)}
                                                                        >
                                                                            <Ionicons name="pencil" size={14} color={Colors.blue} />
                                                                        </Pressable>
                                                                        <Pressable
                                                                            style={styles.itemActionBtn}
                                                                            onPress={() => deleteItem(item.id)}
                                                                        >
                                                                            <Ionicons name="trash-outline" size={14} color={Colors.error} />
                                                                        </Pressable>
                                                                    </View>
                                                                </View>
                                                            );
                                                        })}
                                                    </View>
                                                ) : (
                                                    <ThemedText style={styles.emptyPacked}>No items packed yet.</ThemedText>
                                                )}

                                                {/* Pack Action */}
                                                <Pressable
                                                    style={styles.packActionButton}
                                                    onPress={() => setIsAddItemVisible(true)}
                                                >
                                                    <Ionicons name="add-circle" size={20} color={Colors.blue} />
                                                    <ThemedText style={styles.packActionText}>Pack Item</ThemedText>
                                                </Pressable>
                                            </View>
                                        )}
                                    </View>
                                );
                            })
                        )}

                        {/* Add CTB Button (Inline) */}
                        {!isCreatingCtb ? (
                            <Pressable style={styles.addCtbButton} onPress={() => setIsCreatingCtb(true)}>
                                <Ionicons name="add" size={24} color={Colors.blue} />
                                <ThemedText style={styles.addCtbText}>Add Cargo Transfer Bag</ThemedText>
                            </Pressable>
                        ) : (
                            <View style={styles.newCtbForm}>
                                <ThemedText style={styles.formTitle}>New Container</ThemedText>

                                {/* Category Dropdown */}
                                <View style={styles.formRow}>
                                    <ThemedText style={styles.label}>Category <ThemedText style={{ color: Colors.red }}>*</ThemedText></ThemedText>
                                    <Pressable
                                        style={styles.categoryDropdown}
                                        onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                                    >
                                        <ThemedText style={[styles.categoryDropdownText, !selectedCategory && styles.placeholderText]}>
                                            {selectedCategory ? CATEGORY_LABELS[selectedCategory] : 'Select a category...'}
                                        </ThemedText>
                                        <Ionicons name={showCategoryPicker ? 'chevron-up' : 'chevron-down'} size={18} color="#888" />
                                    </Pressable>
                                    {showCategoryPicker && (
                                        <View style={styles.categoryPickerContainer}>
                                            <ScrollView style={styles.categoryPickerScroll} nestedScrollEnabled>
                                                {(Object.keys(CATEGORY_LABELS) as ItemCategory[]).map((category) => (
                                                    <Pressable
                                                        key={category}
                                                        style={[
                                                            styles.categoryPickerItem,
                                                            selectedCategory === category && styles.categoryPickerItemSelected,
                                                        ]}
                                                        onPress={() => handleCategorySelect(category)}
                                                    >
                                                        <ThemedText
                                                            style={[
                                                                styles.categoryPickerItemText,
                                                                selectedCategory === category && styles.categoryPickerItemTextSelected,
                                                            ]}
                                                        >
                                                            {CATEGORY_LABELS[category]}
                                                        </ThemedText>
                                                        {selectedCategory === category && (
                                                            <Ionicons name="checkmark" size={18} color={Colors.blue} />
                                                        )}
                                                    </Pressable>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    )}
                                </View>

                                {/* Auto-generated ID Display */}
                                <View style={styles.formRow}>
                                    <ThemedText style={styles.label}>Generated ID</ThemedText>
                                    <View style={styles.generatedIdContainer}>
                                        <ThemedText style={styles.generatedIdPrefix}>CTB-</ThemedText>
                                        <TextInput
                                            style={styles.generatedIdInput}
                                            placeholder="Select category first"
                                            placeholderTextColor="#666"
                                            value={newCtbId}
                                            onChangeText={setNewCtbId}
                                            autoCapitalize="characters"
                                            editable={!!selectedCategory}
                                        />
                                    </View>
                                    {selectedCategory && (
                                        <ThemedText style={styles.idHint}>
                                            Auto-generated based on existing {CATEGORY_LABELS[selectedCategory]} CTBs
                                        </ThemedText>
                                    )}
                                </View>

                                <View style={styles.formRow}>
                                    <ThemedText style={styles.label}>Size (m³)</ThemedText>
                                    <View style={styles.sizeRow}>
                                        {[0.5, 1.0, 2.0, 4.0].map((size) => (
                                            <Pressable
                                                key={size}
                                                style={[styles.sizeOption, newCtbSize === size && styles.sizeOptionSelected]}
                                                onPress={() => setNewCtbSize(size as CTBSize)}
                                            >
                                                <ThemedText style={[styles.sizeOptionText, newCtbSize === size && styles.sizeOptionTextSelected]}>
                                                    {size}
                                                </ThemedText>
                                            </Pressable>
                                        ))}
                                    </View>
                                </View>

                                <View style={styles.formRow}>
                                    <ThemedText style={styles.label}>Override Mass (kg) <ThemedText style={styles.hint}>(Optional)</ThemedText></ThemedText>
                                    <TextInput
                                        style={styles.input}
                                        placeholder={`Auto: ${(2.0 * newCtbSize).toFixed(1)}kg`}
                                        placeholderTextColor="#666"
                                        value={newCtbMass}
                                        onChangeText={setNewCtbMass}
                                        keyboardType="numeric"
                                    />
                                </View>

                                <View style={styles.formActions}>
                                    <Pressable style={styles.cancelButton} onPress={() => {
                                        setIsCreatingCtb(false);
                                        setSelectedCategory(null);
                                        setNewCtbId('');
                                        setShowCategoryPicker(false);
                                    }}>
                                        <ThemedText style={styles.cancelText}>Cancel</ThemedText>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.confirmButton, (!selectedCategory || !newCtbId) && styles.disabledBtn]}
                                        onPress={handleAddCtb}
                                        disabled={!selectedCategory || !newCtbId}
                                    >
                                        <ThemedText style={styles.confirmText}>Create CTB</ThemedText>
                                    </Pressable>
                                </View>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>

            {/* Footer Actions */}
            <View style={[styles.builderFooter, { paddingBottom: insets.bottom + 20 }]}>
                {builderTab === 'details' ? (
                    <>
                        <Pressable
                            style={styles.footerButtonSecondary}
                            onPress={() => {
                                Alert.alert('Discard Manifest?', 'All progress will be lost.', [
                                    { text: 'Keep Editing', style: 'cancel' },
                                    { text: 'Discard', style: 'destructive', onPress: () => setView('dashboard') }
                                ]);
                            }}
                        >
                            <ThemedText style={styles.secondaryBtnText}>Cancel</ThemedText>
                        </Pressable>
                        <Pressable
                            style={[styles.footerButtonPrimary, !destination.trim() && styles.disabledBtn]}
                            onPress={() => {
                                if (destination.trim()) setBuilderTab('cargo');
                                else Alert.alert('Required', 'Please enter a destination.');
                            }}
                        >
                            <ThemedText style={styles.primaryBtnText}>Next: Cargo</ThemedText>
                            <Ionicons name="arrow-forward" size={18} color="#FFF" />
                        </Pressable>
                    </>
                ) : (
                    <>
                        <Pressable
                            style={styles.footerButtonSecondary}
                            onPress={() => setBuilderTab('details')}
                        >
                            <ThemedText style={styles.secondaryBtnText}>Back</ThemedText>
                        </Pressable>
                        <Pressable
                            style={[styles.footerButtonPrimary, manifestCtbs.length === 0 && styles.disabledBtn]}
                            onPress={submitShipment}
                            disabled={manifestCtbs.length === 0}
                        >
                            <ThemedText style={styles.primaryBtnText}>Send Shipment</ThemedText>
                            <Ionicons name="paper-plane" size={18} color="#FFF" />
                        </Pressable>
                    </>
                )}
            </View>

            <AddItemModal
                visible={isAddItemVisible}
                onClose={() => setIsAddItemVisible(false)}
                targetCtbId={selectedCtbId || undefined}
                onAdd={handleAddItem}
            />

            {/* NFC Assignment Modal */}
            <NFCScannerModal
                visible={showNFCScanner}
                mode="write"
                writeData={nfcAssignTarget || undefined}
                title="Assign NFC Tag"
                subtitle={`Hold device near NFC tag to assign it to ${nfcAssignTarget}`}
                onClose={() => {
                    setShowNFCScanner(false);
                    setNFCAssignTarget(null);
                }}
                onWriteSuccess={handleNFCWriteSuccess}
            />
        </>
    );

    return (
        <ThemedView style={styles.container}>
            {/* Header */}
            <View style={[styles.statusBar, { paddingTop: insets.top }]}>
                {view === 'builder' && (
                    <Pressable onPress={() => setView('dashboard')} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </Pressable>
                )}
                <ThemedText style={styles.headerTitle}>
                    {view === 'dashboard' ? 'Shipment Hub' : 'Manifest Builder'}
                </ThemedText>
                <View style={{ width: 40 }} />
            </View>

            {view === 'dashboard' ? renderDashboard() : renderManifestBuilder()}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    statusBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 16,
        backgroundColor: Colors.background,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    backBtn: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#E0E0E0',
    },
    // Dashboard Styles
    heroCard: {
        margin: 16,
        backgroundColor: Colors.surface,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
        gap: 24,
    },
    heroContent: {
        alignItems: 'center',
        gap: 12,
    },
    heroTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#FFF',
        lineHeight: 36,
    },
    heroSubtitle: {
        textAlign: 'center',
        color: '#888',
        fontSize: 15,
        maxWidth: 240,
        lineHeight: 22,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.blue,
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 100,
        gap: 12,
    },
    primaryButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    sectionHeader: {
        paddingHorizontal: 20,
        marginBottom: 12,
        marginTop: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#DDD',
    },
    emptyRecent: {
        marginHorizontal: 16,
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#1A1A1A',
        borderRadius: 12,
        borderStyle: 'dashed',
    },
    emptyRecentText: {
        color: '#444',
    },

    // Builder Styles
    manifestHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: Colors.background,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    manifestId: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.blue,
        fontVariant: ['tabular-nums'],
    },
    manifestMeta: {
        fontSize: 13,
        color: '#666',
        marginTop: 2,
    },
    manifestStats: {
        alignItems: 'flex-end',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '300',
        color: '#FFF',
    },
    statUnit: {
        fontSize: 14,
        color: '#666',
        marginLeft: 2,
    },
    builderContent: {
        padding: 16,
        paddingBottom: 120,
        gap: 12,
    },
    builderEmpty: {
        alignItems: 'center',
        paddingTop: 60,
        opacity: 0.5,
    },
    builderEmptyText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 4,
    },
    builderEmptySub: {
        color: '#888',
    },

    // CTB Card
    ctbCard: {
        backgroundColor: Colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
    },
    ctbCardSelected: {
        borderColor: Colors.blue,
        backgroundColor: Colors.surfaceHover,
    },
    ctbHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    ctbIconInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    ctbIcon: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: Colors.surfaceHover,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctbIconSelected: {
        backgroundColor: Colors.blue,
    },
    ctbId: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFF',
    },
    ctbDetails: {
        fontSize: 12,
        color: '#666',
    },
    ctbHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    nfcAssigned: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderWidth: 1,
        borderColor: Colors.success,
    },
    ctbActionBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#1A1A1A',
    },
    ctbExpanded: {
        borderTopWidth: 1,
        borderTopColor: '#222',
        backgroundColor: '#080808',
        padding: 16,
    },
    packedList: {
        gap: 8,
        marginBottom: 16,
    },
    packedItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#1A1A1A',
    },
    packedItemInfo: {
        flex: 1,
    },
    packedName: {
        color: '#CCC',
        fontSize: 14,
    },
    packedMeta: {
        color: '#666',
        fontSize: 11,
        marginTop: 2,
    },
    packedQty: {
        color: '#666',
        fontVariant: ['tabular-nums'],
    },
    itemActions: {
        flexDirection: 'row',
        gap: 8,
    },
    itemActionBtn: {
        padding: 6,
        borderRadius: 6,
        backgroundColor: '#1A1A1A',
    },
    emptyPacked: {
        color: '#444',
        fontStyle: 'italic',
        marginBottom: 16,
        fontSize: 13,
    },
    packActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        backgroundColor: '#111',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    packActionText: {
        color: Colors.blue,
        fontWeight: '600',
        fontSize: 14,
    },

    // Add CTB Button
    addCtbButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderWidth: 1,
        borderColor: '#2A2A2A',
        borderRadius: 12,
        borderStyle: 'dashed',
        gap: 8,
        marginTop: 8,
    },
    addCtbText: {
        color: Colors.blue,
        fontSize: 15,
        fontWeight: '500',
    },

    // New CTB Form
    newCtbForm: {
        backgroundColor: '#161616',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
        padding: 16,
    },
    formTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#888',
        marginBottom: 12,
        textTransform: 'uppercase',
    },
    formRow: {
        marginBottom: 16,
    },
    input: {
        backgroundColor: '#000',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        padding: 12,
        color: '#FFF',
        fontSize: 16,
    },
    sizeRow: {
        flexDirection: 'row',
        gap: 8,
    },
    sizeOption: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#222',
    },
    sizeOptionSelected: {
        backgroundColor: Colors.blue,
    },
    sizeOptionText: {
        color: '#888',
        fontWeight: '600',
    },
    sizeOptionTextSelected: {
        color: '#FFF',
    },
    formActions: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        padding: 12,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: '#222',
    },
    cancelText: {
        color: '#FFF',
    },
    confirmButton: {
        flex: 1,
        padding: 12,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: Colors.blue,
    },
    confirmText: {
        color: '#FFF',
        fontWeight: '600',
    },

    // Footer Actions
    builderFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.background,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        padding: 16,
        flexDirection: 'row',
        gap: 12,
    },
    footerButtonSecondary: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        backgroundColor: '#1A1A1A',
        justifyContent: 'center',
    },
    secondaryBtnText: {
        color: Colors.error,
        fontWeight: '600',
    },
    footerButtonPrimary: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: Colors.blue,
        borderRadius: 12,
    },
    primaryBtnText: {
        color: Colors.textPrimary,
        fontWeight: '600',
        fontSize: 16,
    },
    disabledBtn: {
        opacity: 0.5,
        backgroundColor: Colors.border,
    },

    // Meta Form Styles
    metaForm: {
        padding: 16,
        backgroundColor: Colors.background,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    metaRow: {
        flexDirection: 'row',
        gap: 16,
    },
    inputLabel: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginBottom: 6,
        textTransform: 'uppercase',
        fontWeight: '600',
    },
    metaInput: {
        backgroundColor: Colors.surfaceHover,
        borderRadius: 8,
        padding: 10,
        color: Colors.textPrimary,
        fontSize: 14,
        borderWidth: 1,
        borderColor: '#333',
    },
    dropdown: {
        backgroundColor: Colors.surfaceHover,
        borderRadius: 8,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
    },
    dropdownText: {
        color: Colors.textPrimary,
        fontSize: 14,
    },
    pickerContainer: {
        backgroundColor: Colors.surfaceHover,
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        marginTop: 4,
        overflow: 'hidden',
    },
    pickerItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    pickerItemSelected: {
        backgroundColor: 'rgba(15, 111, 255, 0.1)',
    },
    pickerItemText: {
        color: Colors.textPrimary,
        fontSize: 14,
    },
    pickerItemTextSelected: {
        color: Colors.blue,
        fontWeight: '600',
    },
    textArea: {
        height: 60,
        textAlignVertical: 'top',
    },
    label: {
        color: Colors.textPrimary,
        marginBottom: 8,
        fontSize: 14,
        fontWeight: '500',
    },
    prioritySelector: {
        flexDirection: 'row',
        backgroundColor: Colors.surfaceHover,
        borderRadius: 8,
        padding: 2,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    priorityChip: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    priorityChipSelected: {
        backgroundColor: Colors.surface,
        borderColor: Colors.borderLight,
        borderWidth: 1,
    },
    priorityText: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    priorityTextSelected: {
        color: Colors.textPrimary,
    },
    hint: {
        fontSize: 12,
        color: Colors.textTertiary,
        fontWeight: '400',
        marginLeft: 4,
    },
    // Category Dropdown Styles
    categoryDropdown: {
        backgroundColor: Colors.surfaceHover,
        borderRadius: 8,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
    },
    categoryDropdownText: {
        color: Colors.textPrimary,
        fontSize: 14,
    },
    placeholderText: {
        color: '#666',
    },
    categoryPickerContainer: {
        backgroundColor: Colors.surfaceHover,
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        marginTop: 4,
        maxHeight: 200,
        overflow: 'hidden',
    },
    categoryPickerScroll: {
        maxHeight: 200,
    },
    categoryPickerItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    categoryPickerItemSelected: {
        backgroundColor: 'rgba(15, 111, 255, 0.1)',
    },
    categoryPickerItemText: {
        color: Colors.textPrimary,
        fontSize: 14,
    },
    categoryPickerItemTextSelected: {
        color: Colors.blue,
        fontWeight: '600',
    },
    // Generated ID Styles
    generatedIdContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#000',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        overflow: 'hidden',
    },
    generatedIdPrefix: {
        color: '#888',
        fontSize: 16,
        paddingLeft: 12,
        paddingVertical: 12,
        fontWeight: '600',
    },
    generatedIdInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 16,
        padding: 12,
        paddingLeft: 0,
    },
    idHint: {
        fontSize: 11,
        color: Colors.textTertiary,
        marginTop: 4,
        fontStyle: 'italic',
    },
    // Edit form styles
    editForm: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#222',
        backgroundColor: '#0A0A0A',
    },
    editFormTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#888',
        marginBottom: 12,
        textTransform: 'uppercase',
    },
    editRow: {
        marginBottom: 12,
    },
    editLabel: {
        fontSize: 12,
        color: '#888',
        marginBottom: 6,
    },
    editInput: {
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        padding: 10,
        color: '#FFF',
        fontSize: 14,
    },
    editActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
    },
    editCancelBtn: {
        flex: 1,
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#222',
        alignItems: 'center',
    },
    editCancelText: {
        color: '#888',
        fontWeight: '500',
    },
    editSaveBtn: {
        flex: 1,
        padding: 10,
        borderRadius: 8,
        backgroundColor: Colors.blue,
        alignItems: 'center',
    },
    editSaveText: {
        color: '#FFF',
        fontWeight: '600',
    },
    sizeRowSmall: {
        flexDirection: 'row',
        gap: 6,
    },
    sizeOptionSmall: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        borderRadius: 6,
        backgroundColor: '#222',
    },
    sizeOptionTextSmall: {
        color: '#888',
        fontSize: 13,
        fontWeight: '600',
    },
    itemEditForm: {
        backgroundColor: '#0A0A0A',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
    },
    itemEditRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    // Tab Styles
    tabContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: Colors.background,
    },
    tabSelector: {
        flexDirection: 'row',
        backgroundColor: Colors.surface,
        borderRadius: 8,
        padding: 4,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
    },
    tabBtnActive: {
        backgroundColor: Colors.surfaceHover,
    },
    tabText: {
        fontSize: 13,
        fontWeight: '500',
        color: Colors.textSecondary,
    },
    tabTextActive: {
        color: Colors.textPrimary,
        fontWeight: '600',
    },
});
