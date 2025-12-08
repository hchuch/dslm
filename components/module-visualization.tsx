import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { CTB, StackConfiguration, StackId } from '../types/dslm';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface ModuleVisualizationProps {
  stacks: StackConfiguration[];
  ctbs: CTB[];
  onStackPress?: (stackId: StackId) => void;
  selectedStack?: StackId;
}

export function ModuleVisualization({ stacks, ctbs, onStackPress, selectedStack }: ModuleVisualizationProps) {
  const getStackUtilization = (stackId: StackId) => {
    const stack = stacks.find(s => s.stackId === stackId);
    if (!stack) return 0;

    const ctbsInStack = ctbs.filter(ctb => ctb.location.stack === stackId);
    const usedVolume = ctbsInStack.reduce((sum, ctb) => sum + ctb.volume, 0);

    return Math.round((usedVolume / stack.totalVolume) * 100);
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization < 50) return '#2ECC71';
    if (utilization < 80) return '#FFB86B';
    return '#E74C3C';
  };

  const getCTBColor = (size: number) => {
    switch (size) {
      case 0.5: return '#3498DB'; // Blue
      case 1.0: return '#2ECC71'; // Green
      case 2.0: return '#F1C40F'; // Yellow
      case 4.0: return '#E67E22'; // Orange
      default: return '#9B59B6'; // Purple (Large)
    }
  };

  const getCTBCountInStack = (stackId: StackId) => {
    return ctbs.filter(ctb => ctb.location.stack === stackId).length;
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>DSLM Module Layout</ThemedText>
      <ThemedText style={styles.subtitle}>4-Meter Cylinder • 5 Storage Stacks • 52m³ Capacity</ThemedText>

      <View style={styles.moduleContainer}>
        {/* Main stacks S1, S2, S3 */}
        <View style={styles.mainStacksRow}>
          {(['S1', 'S2', 'S3'] as StackId[]).map((stackId) => {
            const utilization = getStackUtilization(stackId);
            const ctbCount = getCTBCountInStack(stackId);
            const isSelected = selectedStack === stackId;

            return (
              <Pressable
                key={stackId}
                onPress={() => onStackPress?.(stackId)}
                style={({ pressed }) => [
                  styles.stackCard,
                  isSelected && styles.stackCardSelected,
                  pressed && styles.stackCardPressed,
                ]}>
                <View style={styles.stackHeader}>
                  <ThemedText style={styles.stackId}>{stackId}</ThemedText>
                  <ThemedText style={styles.stackType}>Standard</ThemedText>
                </View>

                {/* Visualization of positions */}
                <View style={styles.positionsGrid}>
                  {Array.from({ length: 16 }).map((_, i) => {
                    const position = i + 1;

                    return (
                      <View key={i} style={styles.positionCellContainer}>
                        {/* Render 4 layers as strips */}
                        {Array.from({ length: 4 }).map((_, layerIndex) => {
                          const layer = layerIndex + 1;

                          const occupyingCTB = ctbs.find(ctb => {
                            if (ctb.location.stack !== stackId) return false;
                            if (ctb.location.layer !== layer) return false;

                            const startPos = ctb.location.position;
                            const slotsNeeded = Math.ceil(ctb.size);
                            return position >= startPos && position < startPos + slotsNeeded;
                          });

                          return (
                            <View
                              key={layer}
                              style={[
                                styles.layerStrip,
                                occupyingCTB && {
                                  backgroundColor: getCTBColor(occupyingCTB.size),
                                  opacity: 1 - (layerIndex * 0.15) // Slight dimming for deeper layers
                                }
                              ]}
                            />
                          );
                        })}
                      </View>
                    );
                  })}
                </View>

                <View style={styles.stackStats}>
                  <View style={styles.statRow}>
                    <ThemedText style={styles.statLabel}>CTBs:</ThemedText>
                    <ThemedText style={styles.statValue}>{ctbCount}</ThemedText>
                  </View>
                  <View style={styles.statRow}>
                    <ThemedText style={styles.statLabel}>Capacity:</ThemedText>
                    <View
                      style={[
                        styles.utilizationBar,
                        { backgroundColor: getUtilizationColor(utilization) },
                      ]}>
                      <ThemedText style={styles.utilizationText}>{utilization}%</ThemedText>
                    </View>
                  </View>
                </View>

                <View style={styles.dimensionsRow}>
                  <ThemedText style={styles.dimensionText}>16 positions</ThemedText>
                  <ThemedText style={styles.dimensionText}>4 layers</ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Flexible stacks C1, C2 */}
        <ThemedText style={styles.sectionLabel}>Flexible Shape Stacks</ThemedText>
        <View style={styles.flexStacksRow}>
          {(['C1', 'C2'] as StackId[]).map((stackId) => {
            const utilization = getStackUtilization(stackId);
            const ctbCount = getCTBCountInStack(stackId);
            const isSelected = selectedStack === stackId;

            return (
              <Pressable
                key={stackId}
                onPress={() => onStackPress?.(stackId)}
                style={({ pressed }) => [
                  styles.stackCard,
                  styles.flexStackCard,
                  isSelected && styles.stackCardSelected,
                  pressed && styles.stackCardPressed,
                ]}>
                <View style={styles.stackHeader}>
                  <ThemedText style={styles.stackId}>{stackId}</ThemedText>
                  <ThemedText style={[styles.stackType, { color: '#FFB86B' }]}>Flex</ThemedText>
                </View>

                {/* Curved visualization for flex stacks */}
                <View style={styles.flexPositionsContainer}>
                  <View style={styles.flexShapeIndicator}>
                    <ThemedText style={{ fontSize: 40, opacity: 0.3 }}>⬬</ThemedText>
                  </View>
                </View>

                <View style={styles.stackStats}>
                  <View style={styles.statRow}>
                    <ThemedText style={styles.statLabel}>CTBs:</ThemedText>
                    <ThemedText style={styles.statValue}>{ctbCount}</ThemedText>
                  </View>
                  <View style={styles.statRow}>
                    <ThemedText style={styles.statLabel}>Capacity:</ThemedText>
                    <View
                      style={[
                        styles.utilizationBar,
                        { backgroundColor: getUtilizationColor(utilization) },
                      ]}>
                      <ThemedText style={styles.utilizationText}>{utilization}%</ThemedText>
                    </View>
                  </View>
                </View>

                <View style={styles.dimensionsRow}>
                  <ThemedText style={styles.dimensionText}>Irregular</ThemedText>
                  <ThemedText style={styles.dimensionText}>Soft CTBs</ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <ThemedText style={styles.legendTitle}>Legend</ThemedText>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#3498DB' }]} />
          <ThemedText style={styles.legendText}>0.5 CTB</ThemedText>
          <View style={[styles.legendDot, { backgroundColor: '#2ECC71', marginLeft: 12 }]} />
          <ThemedText style={styles.legendText}>1.0 CTB</ThemedText>
          <View style={[styles.legendDot, { backgroundColor: '#F1C40F', marginLeft: 12 }]} />
          <ThemedText style={styles.legendText}>2.0 CTB</ThemedText>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#E67E22' }]} />
          <ThemedText style={styles.legendText}>4.0 CTB</ThemedText>
          <View style={[styles.legendDot, { backgroundColor: '#9B59B6', marginLeft: 12 }]} />
          <ThemedText style={styles.legendText}>Large CTB</ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    opacity: 0.7,
    marginBottom: 24,
    lineHeight: 18,
  },
  moduleContainer: {
    marginBottom: 20,
  },
  mainStacksRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
    marginBottom: 12,
  },
  flexStacksRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  stackCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#1A1B1E',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#2A2B2E',
  },
  stackCardSelected: {
    borderColor: '#0F6FFF',
    backgroundColor: '#0F6FFF10',
  },
  stackCardPressed: {
    opacity: 0.8,
  },
  flexStackCard: {
    borderColor: '#FFB86B40',
  },
  stackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stackId: {
    fontSize: 18,
    fontWeight: '700',
  },
  stackType: {
    fontSize: 11,
    opacity: 0.6,
    textTransform: 'uppercase',
  },
  positionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginBottom: 12,
    justifyContent: 'center',
  },
  positionCellContainer: {
    width: 24,
    height: 24,
    backgroundColor: '#2A2B2E',
    borderRadius: 3,
    overflow: 'hidden',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: 1,
  },
  layerStrip: {
    flex: 1,
    marginBottom: 1,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  flexPositionsContainer: {
    height: 100,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexShapeIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackStats: {
    gap: 8,
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.6,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  utilizationBar: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 50,
    alignItems: 'center',
  },
  utilizationText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dimensionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2B2E',
  },
  dimensionText: {
    fontSize: 10,
    opacity: 0.5,
  },
  legend: {
    backgroundColor: '#1A1B1E',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2A2B2E',
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    opacity: 0.8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 11,
    opacity: 0.7,
  },
});
