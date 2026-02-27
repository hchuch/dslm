import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/colors';
import { useInventory } from '@/hooks/use-inventory';
import { ItemHistoryEntry } from '@/types/dslm';
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Extended type for flattened logs
type LogEntry = ItemHistoryEntry & {
    itemId: string;
    itemName: string;
    itemCategory: string;
    id: string; // unique ID for key
};

const ACTION_FILTERS = ['All', 'moved', 'consumed', 'delivered', 'loaded', 'inspected', 'relocated', 'marked-waste', 'nfc-assigned'];

export default function LogsScreen() {
    const { inventoryItems } = useInventory();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');
    const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

    // Flatten and sort history from all items
    const allLogs = useMemo(() => {
        const logs: LogEntry[] = [];
        inventoryItems.forEach((item) => {
            if (item.history) {
                item.history.forEach((entry, index) => {
                    logs.push({
                        ...entry,
                        itemId: item.id,
                        itemName: item.name,
                        itemCategory: item.category,
                        id: `${item.id}-${index}-${entry.timestamp.getTime()}`,
                    });
                });
            }
        });
        return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [inventoryItems]);

    // Filter logs based on search and active filter
    const filteredLogs = useMemo(() => {
        return allLogs.filter((log) => {
            const matchesSearch =
                log.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                log.itemId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (log.notes && log.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (log.userId && log.userId.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesFilter = activeFilter === 'All' || log.action === activeFilter;

            return matchesSearch && matchesFilter;
        });
    }, [allLogs, searchQuery, activeFilter]);

    const formatDate = (date: Date) => {
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const renderLogItem = ({ item }: { item: LogEntry }) => (
        <TouchableOpacity
            style={[
                styles.logItem,
                { backgroundColor: Colors.surface },
            ]}
            onPress={() => setSelectedLog(item)}>
            <View style={styles.logHeader}>
                <View style={styles.iconContainer}>
                    <IconSymbol
                        name={
                            item.action === 'moved' || item.action === 'relocated'
                                ? 'tray.and.arrow.up.fill' // Approximation for move
                                : item.action === 'delivered'
                                    ? 'checkmark.seal.fill'
                                    : item.action === 'consumed'
                                        ? 'tray.fill'
                                        : item.action === 'marked-waste'
                                            ? 'trash.fill'
                                            : item.action === 'nfc-assigned'
                                                ? 'antenna.radiowaves.left.and.right'
                                                : 'clock.fill'
                        }
                        size={20}
                        color={Colors.blue}
                    />
                </View>
                <View style={styles.logHeaderText}>
                    <ThemedText type="defaultSemiBold" style={styles.itemName}>
                        {item.itemName}
                    </ThemedText>
                    <ThemedText style={styles.actionText}>
                        {item.action.toUpperCase()} • {formatDate(item.timestamp)}
                    </ThemedText>
                </View>
            </View>
            {item.notes && (
                <ThemedText style={styles.notesText} numberOfLines={2}>
                    {item.notes}
                </ThemedText>
            )}
        </TouchableOpacity>
    );

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.header}>
                    <ThemedText type="title">Activity Log</ThemedText>
                </View>

                {/* Search Bar */}
                <View style={[styles.searchContainer, { backgroundColor: Colors.surface }]}>
                    <IconSymbol name="chevron.right" size={20} color={Colors.textSecondary} style={{ transform: [{ rotate: '90deg' }] }} />
                    {/* Using chevron as generic search/magnifier fallback if needed, or just omit icon */}
                    {/* Actually 'magnifyingglass' is generic, let's assume we don't have it mapped and use generic text input space */}
                    <TextInput
                        style={[styles.searchInput, { color: Colors.textPrimary }]}
                        placeholder="Search logs..."
                        placeholderTextColor={Colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* Filters */}
                <View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filtersContainer}>
                        {ACTION_FILTERS.map((filter) => (
                            <TouchableOpacity
                                key={filter}
                                style={[
                                    styles.filterChip,
                                    activeFilter === filter && styles.activeFilterChip,
                                    { borderColor: Colors.border },
                                ]}
                                onPress={() => setActiveFilter(filter)}>
                                <ThemedText
                                    style={[
                                        styles.filterText,
                                        activeFilter === filter && styles.activeFilterText,
                                    ]}>
                                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                                </ThemedText>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Log List */}
                <FlatList
                    data={filteredLogs}
                    keyExtractor={(item) => item.id}
                    renderItem={renderLogItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <ThemedText>No logs found.</ThemedText>
                        </View>
                    }
                />

                {/* Detail Modal */}
                <Modal
                    visible={!!selectedLog}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setSelectedLog(null)}>
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: Colors.surface }]}>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setSelectedLog(null)}>
                                <IconSymbol name="chevron.right" size={24} color={Colors.textSecondary} style={{ transform: [{ rotate: '90deg' }] }} />
                            </TouchableOpacity>

                            {selectedLog && (
                                <View>
                                    <ThemedText type="title" style={styles.modalTitle}>{selectedLog.itemName}</ThemedText>
                                    <ThemedText style={styles.modalSubtitle}>{selectedLog.itemId}</ThemedText>

                                    <View style={styles.detailRow}>
                                        <ThemedText type="defaultSemiBold">Action:</ThemedText>
                                        <ThemedText>{selectedLog.action.toUpperCase()}</ThemedText>
                                    </View>

                                    <View style={styles.detailRow}>
                                        <ThemedText type="defaultSemiBold">Time:</ThemedText>
                                        <ThemedText>{formatDate(selectedLog.timestamp)}</ThemedText>
                                    </View>

                                    {selectedLog.userId && (
                                        <View style={styles.detailRow}>
                                            <ThemedText type="defaultSemiBold">User:</ThemedText>
                                            <ThemedText>{selectedLog.userId}</ThemedText>
                                        </View>
                                    )}

                                    {selectedLog.fromLocation && (
                                        <View style={styles.detailSection}>
                                            <ThemedText type="defaultSemiBold">From:</ThemedText>
                                            <ThemedText>{selectedLog.fromLocation.path}</ThemedText>
                                        </View>
                                    )}

                                    {selectedLog.toLocation && (
                                        <View style={styles.detailSection}>
                                            <ThemedText type="defaultSemiBold">To:</ThemedText>
                                            <ThemedText>{selectedLog.toLocation.path}</ThemedText>
                                        </View>
                                    )}

                                    <View style={styles.detailSection}>
                                        <ThemedText type="defaultSemiBold">Notes:</ThemedText>
                                        <ThemedText>{selectedLog.notes || 'No notes available.'}</ThemedText>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                </Modal>
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
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 40,
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
    },
    filtersContainer: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        marginRight: 8,
    },
    activeFilterChip: {
        backgroundColor: Colors.blue,
        borderColor: Colors.blue,
    },
    filterText: {
        fontSize: 14,
    },
    activeFilterText: {
        color: '#000',
        fontWeight: '600',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    logItem: {
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    logHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.blueGlow,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    logHeaderText: {
        flex: 1,
    },
    itemName: {
        fontSize: 16,
    },
    actionText: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    notesText: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginTop: 4,
    },
    emptyContainer: {
        padding: 20,
        alignItems: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        minHeight: 400,
    },
    closeButton: {
        alignSelf: 'flex-end',
        padding: 4,
    },
    modalTitle: {
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginBottom: 20,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.border,
        paddingBottom: 8,
    },
    detailSection: {
        marginTop: 12,
    },
});
