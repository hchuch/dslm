import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CTBViewer } from '../../components/ctb-viewer';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/auth-context';
import { useInventory } from '../../hooks/use-inventory';
import type { CTB } from '../../types/dslm';

export default function IncomingScreen() {
  const { getIncomingCTBs, receiveCTB } = useInventory();
  const { user } = useAuth();
  const incomingCTBs = useMemo(() => getIncomingCTBs(), [getIncomingCTBs]);
  const [selectedCTB, setSelectedCTB] = useState<CTB | null>(null);

  const handleReceiveCTB = (ctbId: string) => {
    const ctb = incomingCTBs.find(c => c.id === ctbId);
    if (!ctb) return;

    Alert.alert(
      "Receive CTB",
      `Confirm receipt of ${ctb.id}?\n\nTarget Location:\nStack: ${ctb.location.stack}\nPosition: ${ctb.location.position}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Receipt",
          onPress: () => {
            receiveCTB(ctbId);
            setSelectedCTB(null);
          }
        }
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <ThemedText type="title" style={styles.headerTitle}>Incoming Logistics</ThemedText>
            <ThemedText style={styles.headerSubtitle}>
              {incomingCTBs.length} {incomingCTBs.length === 1 ? 'CTB' : 'CTBs'} en route to Gateway
            </ThemedText>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          {incomingCTBs.length === 0 ? (
            <ThemedView style={styles.emptyState}>
              <Ionicons name="file-tray-outline" size={60} color="#666" style={{ marginBottom: 16, opacity: 0.5 }} />
              <ThemedText style={styles.emptyTitle}>No Incoming CTBs</ThemedText>
              <ThemedText style={styles.emptyText}>
                All Cargo Transfer Bags have been received
              </ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.gridContainer}>
              {incomingCTBs.map((ctb) => (
                <Pressable
                  key={ctb.id}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                  onPress={() => setSelectedCTB(ctb)}
                >
                  <View style={styles.iconContainer}>
                    <Ionicons name="cube" size={40} color={Colors.blue} />
                    <View style={styles.sizeBadge}>
                      <ThemedText style={styles.sizeText}>{ctb.size * 2}</ThemedText>
                    </View>
                  </View>

                  <View style={styles.cardContent}>
                    <ThemedText style={styles.ctbId} numberOfLines={1}>
                      {ctb.id}
                    </ThemedText>
                    <ThemedText style={styles.ctbLocation} numberOfLines={1}>
                      Location: {ctb.location.path}
                    </ThemedText>

                    <View style={styles.statsRow}>
                      <ThemedText style={styles.statText}>
                        Mass: {ctb.mass}kg
                      </ThemedText>
                      <ThemedText style={styles.statText}>
                        Items: {ctb.items.length}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.actionRow}>
                    {user?.role !== 'ground-crew' ? (
                      <Pressable
                        style={({ pressed }) => [styles.receiveButton, pressed && styles.receiveButtonPressed]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleReceiveCTB(ctb.id);
                        }}
                      >
                        <Ionicons name="download-outline" size={16} color={Colors.textPrimary} style={{ marginRight: 6 }} />
                        <ThemedText style={styles.receiveButtonText}>Receive</ThemedText>
                      </Pressable>
                    ) : (
                      <ThemedText style={styles.statText}>En Route to Gateway</ThemedText>
                    )}

                    <View style={styles.inspectHint}>
                      <ThemedText style={styles.tapText}>Inspect</ThemedText>
                      <Ionicons name="chevron-forward" size={14} color="#666" />
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        <CTBViewer
          visible={!!selectedCTB}
          ctb={selectedCTB}
          onClose={() => setSelectedCTB(null)}
          onReceive={handleReceiveCTB}
        />
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 24,
    // inherited from type="title"
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  contentContainer: {
    paddingBottom: 24,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
    backgroundColor: 'transparent',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.5,
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 40,
  },
  card: {
    width: '48%', // 2 columns with gap
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  iconContainer: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: '#1A1B1E',
    borderRadius: 8,
    position: 'relative',
  },
  sizeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#2A2B2E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight, // Using borderLight for subtle contrast
  },
  sizeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cardContent: {
    marginBottom: 12,
    alignItems: 'flex-start', // Ensure default left alignment for text in card
  },
  ctbId: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  ctbLocation: {
    fontSize: 11,
    opacity: 0.5,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  statText: {
    fontSize: 10,
    opacity: 0.6,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
  },
  tapText: {
    fontSize: 10,
    color: '#0F6FFF',
    fontWeight: '600',
  },
  receiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.blue,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  receiveButtonPressed: {
    opacity: 0.8,
  },
  receiveButtonText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  inspectHint: {
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.7,
  },
});
