// CTB Nesting Validation Service
// Enforces nesting rules at API level per NASA DSLM requirements

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// CTB size type
type CTBSize = 0.5 | 1.0 | 2.0 | 4.0 | 6.0 | 8.0 | 10.0;

// Maximum nesting depth (0 = root, max 3 levels deep)
export const MAX_NESTING_DEPTH = 3;

// Nesting rules: which child sizes fit in which parent sizes
interface NestingRule {
  parentSize: CTBSize;
  allowedChildSizes: CTBSize[];
  maxChildren: number;
}

export const NESTING_RULES: NestingRule[] = [
  { parentSize: 0.5, allowedChildSizes: [], maxChildren: 0 },
  { parentSize: 1.0, allowedChildSizes: [0.5], maxChildren: 2 },
  { parentSize: 2.0, allowedChildSizes: [1.0, 0.5], maxChildren: 2 },
  { parentSize: 4.0, allowedChildSizes: [2.0, 1.0, 0.5], maxChildren: 2 },
  { parentSize: 6.0, allowedChildSizes: [4.0, 2.0, 1.0, 0.5], maxChildren: 2 },
  { parentSize: 8.0, allowedChildSizes: [6.0, 4.0, 2.0, 1.0, 0.5], maxChildren: 2 },
  { parentSize: 10.0, allowedChildSizes: [8.0, 6.0, 4.0, 2.0, 1.0, 0.5], maxChildren: 3 },
];

// Volume specifications for each CTB size (m³)
// Per NASA specs: packed = external storage volume, unpacked = internal capacity
export const CTB_VOLUME_SPECS: Record<CTBSize, { packed: number; unpacked: number }> = {
  0.5:  { packed: 0.014, unpacked: 0.012 },
  1.0:  { packed: 0.028, unpacked: 0.025 },
  2.0:  { packed: 0.057, unpacked: 0.051 },
  4.0:  { packed: 0.113, unpacked: 0.100 },
  6.0:  { packed: 0.170, unpacked: 0.150 },
  8.0:  { packed: 0.227, unpacked: 0.200 },
  10.0: { packed: 0.283, unpacked: 0.250 },
};

/**
 * Get the packed volume (external) for a CTB size
 */
export function getPackedVolume(size: number): number {
  const specs = CTB_VOLUME_SPECS[size as CTBSize];
  return specs?.packed ?? size * 0.028; // Fallback to linear estimate
}

/**
 * Get the unpacked volume (internal capacity) for a CTB size
 */
export function getUnpackedVolume(size: number): number {
  const specs = CTB_VOLUME_SPECS[size as CTBSize];
  return specs?.unpacked ?? size * 0.025; // Fallback to linear estimate
}

/**
 * Get the nesting rule for a parent CTB size
 */
export function getNestingRule(parentSize: number): NestingRule | undefined {
  return NESTING_RULES.find(rule => rule.parentSize === parentSize);
}

/**
 * Validation result type
 */
export interface NestingValidationResult {
  valid: boolean;
  error?: string;
  parentNestingDepth?: number;
}

/**
 * Validate if a child CTB can be nested inside a parent CTB
 *
 * Checks:
 * 1. Parent size allows child size
 * 2. Parent has room for more children
 * 3. Nesting depth limit not exceeded
 * 4. Child packed volume fits in parent's available space
 */
export async function validateNesting(
  childSize: number,
  parentCTBId: string | null | undefined
): Promise<NestingValidationResult> {
  // If no parent, this is a root CTB - always valid
  if (!parentCTBId) {
    return { valid: true, parentNestingDepth: -1 }; // -1 means root, so child will be 0
  }

  // Find the parent CTB
  const parentCTB = await prisma.cTB.findFirst({
    where: {
      OR: [{ id: parentCTBId }, { ctbId: parentCTBId }],
      deletedAt: null,
    },
    include: {
      childCTBs: {
        where: { deletedAt: null },
      },
    },
  });

  if (!parentCTB) {
    return { valid: false, error: `Parent CTB ${parentCTBId} not found` };
  }

  // Get nesting rules for parent size
  const rule = getNestingRule(parentCTB.size);
  if (!rule) {
    return { valid: false, error: `No nesting rules defined for size ${parentCTB.size}` };
  }

  // Check if parent size allows this child size
  if (!rule.allowedChildSizes.includes(childSize as CTBSize)) {
    return {
      valid: false,
      error: `CTB size ${childSize} cannot be nested in size ${parentCTB.size}. Allowed: ${rule.allowedChildSizes.join(', ') || 'none'}`,
    };
  }

  // Check max children limit
  const currentChildCount = parentCTB.childCTBs.length;
  if (currentChildCount >= rule.maxChildren) {
    return {
      valid: false,
      error: `Parent CTB already has ${currentChildCount} nested CTBs (max: ${rule.maxChildren})`,
    };
  }

  // Check nesting depth limit
  const parentDepth = parentCTB.nestingDepth ?? 0;
  const childDepth = parentDepth + 1;
  if (childDepth > MAX_NESTING_DEPTH) {
    return {
      valid: false,
      error: `Nesting depth ${childDepth} exceeds maximum of ${MAX_NESTING_DEPTH}`,
    };
  }

  // Check volume constraints
  const parentUnpackedVolume = parentCTB.unpackedVolume ?? getUnpackedVolume(parentCTB.size);
  const childPackedVolume = getPackedVolume(childSize);

  // Calculate currently used volume by existing children
  let usedVolume = 0;
  for (const child of parentCTB.childCTBs) {
    usedVolume += child.packedVolume ?? getPackedVolume(child.size);
  }

  const availableVolume = parentUnpackedVolume - usedVolume;
  if (childPackedVolume > availableVolume) {
    return {
      valid: false,
      error: `Insufficient space: child needs ${childPackedVolume.toFixed(3)} m³ but only ${availableVolume.toFixed(3)} m³ available`,
    };
  }

  return { valid: true, parentNestingDepth: parentDepth };
}

/**
 * Calculate the nesting depth for a CTB based on its parent
 */
export async function calculateNestingDepth(parentCTBId: string | null | undefined): Promise<number> {
  if (!parentCTBId) {
    return 0; // Root level
  }

  const parentCTB = await prisma.cTB.findFirst({
    where: {
      OR: [{ id: parentCTBId }, { ctbId: parentCTBId }],
      deletedAt: null,
    },
  });

  if (!parentCTB) {
    return 0;
  }

  return (parentCTB.nestingDepth ?? 0) + 1;
}

/**
 * Propagate location changes to all nested children when a parent CTB moves
 */
export async function propagateLocationToChildren(
  parentId: string,
  newStackId: string,
  newPosition: number,
  newLayer: number,
  syncVersion: number
): Promise<void> {
  const newLocationPath = `${newStackId}-P${newPosition}-L${newLayer}`;

  // Find all direct children
  const children = await prisma.cTB.findMany({
    where: {
      parentCTBId: parentId,
      deletedAt: null,
    },
  });

  // Update each child and recursively update their children
  for (const child of children) {
    await prisma.cTB.update({
      where: { id: child.id },
      data: {
        stackId: newStackId,
        position: newPosition,
        layer: newLayer,
        locationPath: newLocationPath,
        syncVersion,
      },
    });

    // Update all items in this child CTB
    await prisma.inventoryItem.updateMany({
      where: { ctbId: child.ctbId, deletedAt: null },
      data: {
        stackId: newStackId,
        position: newPosition,
        layer: newLayer,
        locationPath: newLocationPath,
        syncVersion,
      },
    });

    // Recursively propagate to grandchildren
    await propagateLocationToChildren(child.id, newStackId, newPosition, newLayer, syncVersion);
  }
}

/**
 * Calculate available volume in a CTB (unpacked - sum of child packed volumes)
 */
export async function calculateAvailableVolume(ctbId: string): Promise<number> {
  const ctb = await prisma.cTB.findFirst({
    where: {
      OR: [{ id: ctbId }, { ctbId: ctbId }],
      deletedAt: null,
    },
    include: {
      childCTBs: {
        where: { deletedAt: null },
      },
    },
  });

  if (!ctb) {
    return 0;
  }

  const unpackedVolume = ctb.unpackedVolume ?? getUnpackedVolume(ctb.size);

  let usedVolume = 0;
  for (const child of ctb.childCTBs) {
    usedVolume += child.packedVolume ?? getPackedVolume(child.size);
  }

  return Math.max(0, unpackedVolume - usedVolume);
}
