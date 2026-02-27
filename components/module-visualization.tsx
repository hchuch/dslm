import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';
import type { CTB, StackConfiguration, StackId } from '../types/dslm';
import { ThemedText } from './themed-text';

interface ModuleVisualizationProps {
  stacks: StackConfiguration[];
  ctbs: CTB[];
  onStackPress?: (stackId: StackId) => void;
  selectedStack?: StackId;
}

const CELL_SIZE = 18;
const CELL_GAP = 2;

const getCTBColor = (size: number): string => {
  switch (size) {
    case 0.5: return '#3498DB';
    case 1.0: return '#3498DB';
    case 2.0: return '#9B59B6';
    case 4.0: return '#E67E22';
    case 6.0: return '#2ECC71';
    case 8.0: return '#E91E63';
    case 10.0: return '#00BCD4';
    default: return '#9B59B6';
  }
};

const getUtilizationColor = (utilization: number) => {
  if (utilization < 50) return '#2ECC71';
  if (utilization < 80) return '#FFB86B';
  return '#E74C3C';
};

export function ModuleVisualization({ stacks, ctbs, onStackPress, selectedStack }: ModuleVisualizationProps) {
  const getStackUtilization = (stackId: StackId) => {
    const stack = stacks.find(s => s.stackId === stackId);
    if (!stack) return 0;
    const ctbsInStack = ctbs.filter(ctb => ctb.location.stack === stackId && !ctb.isOutside);
    const usedVolume = ctbsInStack.reduce((sum, ctb) => sum + ctb.volume, 0);
    return Math.round((usedVolume / stack.totalVolume) * 100);
  };

  const getCTBCountInStack = (stackId: StackId) => {
    return ctbs.filter(ctb => ctb.location.stack === stackId && !ctb.isOutside).length;
  };

  const getTotalMassInStack = (stackId: StackId) => {
    return ctbs.filter(ctb => ctb.location.stack === stackId && !ctb.isOutside).reduce((sum, ctb) => sum + ctb.mass, 0);
  };

  const getOccupiedCells = (stackId: StackId) => {
    const stackCtbs = ctbs.filter(ctb => ctb.location.stack === stackId && !ctb.isOutside);
    // Map: "layer-position" → ctb color
    const occupied = new Map<string, string>();
    for (const ctb of stackCtbs) {
      const layer = ctb.location.layer || 1;
      const pos = ctb.location.position;
      const slotsNeeded = Math.max(1, Math.ceil(ctb.size));
      const color = getCTBColor(ctb.size);
      for (let p = pos; p < pos + slotsNeeded; p++) {
        occupied.set(`${layer}-${p}`, color);
      }
    }
    return occupied;
  };

  const renderStackCard = (stackId: StackId, isFlex: boolean = false) => {
    const stack = stacks.find(s => s.stackId === stackId);
    const utilization = getStackUtilization(stackId);
    const ctbCount = getCTBCountInStack(stackId);
    const totalMass = getTotalMassInStack(stackId);
    const isSelected = selectedStack === stackId;
    const positions = stack?.positions || 16;
    const maxLayers = stack?.maxLayers || 4;
    const occupied = getOccupiedCells(stackId);

    return (
      <TouchableOpacity
        key={stackId}
        activeOpacity={0.7}
        onPress={() => onStackPress?.(stackId)}
        style={[
          styles.stackCard,
          isFlex && styles.flexStackCard,
          isSelected && styles.stackCardSelected,
        ]}>
        <View style={styles.stackHeader}>
          <ThemedText style={styles.stackIdText}>{stackId}</ThemedText>
          <ThemedText style={[styles.stackType, isFlex && { color: '#FFB86B' }]}>
            {isFlex ? 'FLEX' : 'STANDARD'}
          </ThemedText>
        </View>

        {/* Grid */}
        <View style={styles.gridContainer}>
          {isFlex ? (
            <View style={styles.flexGrid}>
              {Array.from({ length: 8 }, (_, i) => {
                const cellColor = occupied.get(`1-${i + 1}`);
                return (
                  <View key={i} style={[styles.flexCell, cellColor && { backgroundColor: cellColor, borderColor: cellColor }]} />
                );
              })}
            </View>
          ) : (
            Array.from({ length: maxLayers }, (_, layerIdx) => (
              <View key={layerIdx} style={styles.gridRow}>
                {Array.from({ length: positions }, (_, posIdx) => {
                  const cellColor = occupied.get(`${layerIdx + 1}-${posIdx + 1}`);
                  return (
                    <View key={posIdx} style={[styles.gridCell, cellColor && { backgroundColor: cellColor, borderColor: cellColor }]} />
                  );
                })}
              </View>
            ))
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <ThemedText style={styles.statLabel}>CTBs:</ThemedText>
            <ThemedText style={styles.statValue}>{ctbCount}</ThemedText>
          </View>
          <View style={styles.statRow}>
            <ThemedText style={styles.statLabel}>Total Mass:</ThemedText>
            <ThemedText style={styles.statValue}>{totalMass.toFixed(1)} kg</ThemedText>
          </View>
          <View style={styles.statRow}>
            <ThemedText style={styles.statLabel}>Capacity:</ThemedText>
            <View style={[styles.capacityBadge, { backgroundColor: getUtilizationColor(utilization) }]}>
              <ThemedText style={styles.capacityText}>{utilization}%</ThemedText>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>
            {isFlex ? 'Irregular shape' : `${positions} positions`}
          </ThemedText>
          <ThemedText style={styles.footerText}>
            {isFlex ? 'Soft CTBs only' : `${maxLayers} layers`}
          </ThemedText>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View>
      {/* Main Stacks */}
      <View style={styles.stacksContainer}>
        {renderStackCard('S1')}
        {renderStackCard('S2')}
        {renderStackCard('S3')}
      </View>

      {/* Flex Stacks */}
      <ThemedText style={styles.sectionLabel}>Flexible Shape Stacks</ThemedText>
      <View style={styles.stacksContainer}>
        {renderStackCard('C1', true)}
        {renderStackCard('C2', true)}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <ThemedText style={styles.legendTitle}>CTB Sizes</ThemedText>
        <View style={styles.legendGrid}>
          {[
            { color: '#3498DB', label: '1 slot' },
            { color: '#9B59B6', label: '2 slots' },
            { color: '#E67E22', label: '4 slots' },
            { color: '#2ECC71', label: '6+ slots' },
          ].map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <ThemedText style={styles.legendText}>{item.label}</ThemedText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stacksContainer: {
    gap: 12,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
    marginBottom: 12,
  },
  stackCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  flexStackCard: {
    borderColor: Colors.warning,
    borderStyle: 'dashed',
  },
  stackCardSelected: {
    borderColor: Colors.blue,
    backgroundColor: Colors.blueGlow,
  },
  stackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stackIdText: {
    fontSize: 18,
    fontWeight: '700',
  },
  stackType: {
    fontSize: 11,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  gridContainer: {
    alignItems: 'center',
    marginBottom: 16,
    gap: CELL_GAP,
  },
  gridRow: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  gridCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  flexGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CELL_GAP,
    width: (CELL_SIZE * 4) + (CELL_GAP * 3),
  },
  flexCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statsContainer: {
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
  capacityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 50,
    alignItems: 'center',
  },
  capacityText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerText: {
    fontSize: 10,
    opacity: 0.5,
  },
  legend: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
    opacity: 0.8,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 70,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    opacity: 0.7,
  },
});
