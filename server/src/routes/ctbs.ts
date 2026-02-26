import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { logChange, incrementSyncVersion } from '../services/sync';
import {
  validateNesting,
  calculateNestingDepth,
  propagateLocationToChildren,
  calculateAvailableVolume,
  getPackedVolume,
  getUnpackedVolume,
} from '../services/ctb-nesting';
import { createLogger } from '../services/logger';

const router = Router();
const prisma = new PrismaClient();
const log = createLogger('ctbs');

// GET /api/ctbs - Get all CTBs
router.get('/', async (req, res: Response): Promise<void> => {
  const { stackId, includeDeleted } = req.query;

  try {
    const ctbs = await prisma.cTB.findMany({
      where: {
        ...(stackId && { stackId: String(stackId) }),
        ...(includeDeleted !== 'true' && { deletedAt: null }),
      },
      include: {
        items: { where: { deletedAt: null } },
      },
      orderBy: [{ stackId: 'asc' }, { position: 'asc' }, { layer: 'asc' }],
    });

    res.json(ctbs);
  } catch (error) {
    log.error('Failed to get CTBs', error);
    res.status(500).json({ error: 'Failed to fetch CTBs' });
  }
});

// GET /api/ctbs/:id - Get single CTB
router.get('/:id', async (req, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const ctb = await prisma.cTB.findFirst({
      where: { OR: [{ id }, { ctbId: id }], deletedAt: null },
      include: {
        items: { where: { deletedAt: null } },
        childCTBs: { where: { deletedAt: null } },
      },
    });

    if (!ctb) {
      res.status(404).json({ error: 'CTB not found' });
      return;
    }

    // Calculate available volume (unpacked - sum of child packed volumes)
    const availableVolume = await calculateAvailableVolume(id);

    res.json({
      ...ctb,
      availableVolume,
    });
  } catch (error) {
    log.error('Failed to get CTB', error);
    res.status(500).json({ error: 'Failed to fetch CTB' });
  }
});

// POST /api/ctbs - Create CTB
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const {
    ctbId,
    size,
    stackId,
    position,
    layer = 1,
    mass,
    volume,
    parentCTBId,
    shipmentId,
    notes,
  } = req.body;

  if (!ctbId || size === undefined || !stackId || position === undefined) {
    res.status(400).json({ error: 'ctbId, size, stackId, and position are required' });
    return;
  }

  try {
    // Check if stack exists
    const stack = await prisma.stack.findUnique({ where: { stackId } });
    if (!stack) {
      res.status(400).json({ error: `Stack ${stackId} not found` });
      return;
    }

    // Validate nesting if parentCTBId is provided
    if (parentCTBId) {
      const nestingValidation = await validateNesting(size, parentCTBId);
      if (!nestingValidation.valid) {
        res.status(400).json({ error: nestingValidation.error });
        return;
      }
    }

    // Calculate nesting depth based on parent
    const nestingDepth = await calculateNestingDepth(parentCTBId);

    // Get volume specs for this size
    const packedVolume = getPackedVolume(size);
    const unpackedVolume = getUnpackedVolume(size);

    const syncVersion = await incrementSyncVersion();

    const ctb = await prisma.cTB.create({
      data: {
        ctbId,
        rfidTagId: `RFID-${ctbId}`,
        size,
        stackId,
        position,
        layer,
        locationPath: `${stackId}-P${position}-L${layer}`,
        mass: mass ?? size * 2.0,
        volume: volume ?? size * 0.1,
        packedVolume,
        unpackedVolume,
        nestingDepth,
        parentCTBId,
        shipmentId,
        notes,
        syncVersion,
      },
    });

    await logChange('CTB', ctb.id, 'create', ctb);

    res.status(201).json(ctb);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'CTB with this ID already exists' });
      return;
    }
    log.error('Failed to create CTB', error);
    res.status(500).json({ error: 'Failed to create CTB' });
  }
});

// PATCH /api/ctbs/:id - Update CTB
router.patch('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const {
    stackId,
    position,
    layer,
    mass,
    volume,
    isWaste,
    parentCTBId,
    notes,
  } = req.body;

  try {
    const existing = await prisma.cTB.findFirst({
      where: { OR: [{ id }, { ctbId: id }], deletedAt: null },
    });

    if (!existing) {
      res.status(404).json({ error: 'CTB not found' });
      return;
    }

    // If parentCTBId is being changed, validate the new nesting
    let newNestingDepth = existing.nestingDepth;
    if (parentCTBId !== undefined && parentCTBId !== existing.parentCTBId) {
      if (parentCTBId === null) {
        // Un-nesting: set depth to 0 (root level)
        newNestingDepth = 0;
      } else {
        // Validate new nesting
        const nestingValidation = await validateNesting(existing.size, parentCTBId);
        if (!nestingValidation.valid) {
          res.status(400).json({ error: nestingValidation.error });
          return;
        }
        newNestingDepth = await calculateNestingDepth(parentCTBId);
      }
    }

    const newStackId = stackId ?? existing.stackId;
    const newPosition = position ?? existing.position;
    const newLayer = layer ?? existing.layer;
    const locationChanged = newStackId !== existing.stackId ||
                           newPosition !== existing.position ||
                           newLayer !== existing.layer;

    const syncVersion = await incrementSyncVersion();

    const updated = await prisma.cTB.update({
      where: { id: existing.id },
      data: {
        stackId: newStackId,
        position: newPosition,
        layer: newLayer,
        locationPath: `${newStackId}-P${newPosition}-L${newLayer}`,
        ...(mass !== undefined && { mass }),
        ...(volume !== undefined && { volume }),
        ...(isWaste !== undefined && { isWaste }),
        ...(parentCTBId !== undefined && { parentCTBId, nestingDepth: newNestingDepth }),
        ...(notes !== undefined && { notes }),
        lastAccessedDate: new Date(),
        lastAccessedBy: req.user?.id,
        syncVersion,
      },
    });

    await logChange('CTB', existing.id, 'update', { stackId, position, layer, mass, volume, isWaste, notes, parentCTBId });

    // Also update all items in this CTB to match location
    await prisma.inventoryItem.updateMany({
      where: { ctbId: existing.ctbId, deletedAt: null },
      data: {
        stackId: newStackId,
        position: newPosition,
        layer: newLayer,
        locationPath: `${newStackId}-P${newPosition}-L${newLayer}`,
        syncVersion,
      },
    });

    // If location changed, propagate to all nested children
    if (locationChanged) {
      await propagateLocationToChildren(existing.id, newStackId, newPosition, newLayer, syncVersion);
    }

    res.json(updated);
  } catch (error) {
    log.error('Failed to update CTB', error);
    res.status(500).json({ error: 'Failed to update CTB' });
  }
});

// DELETE /api/ctbs/:id - Delete CTB
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const existing = await prisma.cTB.findFirst({
      where: { OR: [{ id }, { ctbId: id }], deletedAt: null },
    });

    if (!existing) {
      res.status(404).json({ error: 'CTB not found' });
      return;
    }

    // Soft delete CTB and its items
    const syncVersion = await incrementSyncVersion();

    await prisma.cTB.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), syncVersion },
    });

    await prisma.inventoryItem.updateMany({
      where: { ctbId: existing.ctbId },
      data: { deletedAt: new Date(), syncVersion },
    });

    await logChange('CTB', existing.id, 'delete', { ctbId: existing.ctbId });

    res.json({ success: true });
  } catch (error) {
    log.error('Failed to delete CTB', error);
    res.status(500).json({ error: 'Failed to delete CTB' });
  }
});

// POST /api/ctbs/:id/receive - Receive incoming CTB (move from INCOMING to storage)
router.post('/:id/receive', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { targetStackId, targetPosition, targetLayer = 1 } = req.body;

  try {
    const ctb = await prisma.cTB.findFirst({
      where: { OR: [{ id }, { ctbId: id }], deletedAt: null },
      include: { items: { where: { deletedAt: null } } },
    });

    if (!ctb) {
      res.status(404).json({ error: 'CTB not found' });
      return;
    }

    // If no target specified, find an available position
    let stackId = targetStackId;
    let position = targetPosition;
    let layer = targetLayer;

    if (!stackId || position === undefined) {
      // Find first available position in S1, S2, S3
      for (const tryStack of ['S1', 'S2', 'S3']) {
        const existingCtbs = await prisma.cTB.findMany({
          where: { stackId: tryStack, deletedAt: null },
          select: { position: true },
        });
        const usedPositions = new Set(existingCtbs.map((c) => c.position));

        for (let p = 1; p <= 16; p++) {
          if (!usedPositions.has(p)) {
            stackId = tryStack;
            position = p;
            layer = 1;
            break;
          }
        }
        if (stackId) break;
      }

      if (!stackId) {
        res.status(409).json({ error: 'No available positions in storage stacks' });
        return;
      }
    }

    const locationPath = `${stackId}-P${position}-L${layer}`;
    const syncVersion = await incrementSyncVersion();

    // Update CTB
    const updated = await prisma.cTB.update({
      where: { id: ctb.id },
      data: {
        stackId,
        position,
        layer,
        locationPath,
        lastAccessedDate: new Date(),
        lastAccessedBy: req.user?.id,
        syncVersion,
      },
    });

    // Update all items in CTB
    for (const item of ctb.items) {
      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: {
          status: 'stock',
          stackId,
          position,
          layer,
          locationPath,
          deliveredDate: new Date(),
          syncVersion,
        },
      });

      // Create history entry
      await prisma.itemHistoryEntry.create({
        data: {
          itemId: item.itemId,
          action: 'delivered',
          userId: req.user?.id,
          fromStackId: item.stackId,
          fromPosition: item.position,
          fromLayer: item.layer,
          fromPath: item.locationPath,
          toStackId: stackId,
          toPosition: position,
          toLayer: layer,
          toPath: locationPath,
          notes: `CTB ${ctb.ctbId} received at Gateway, stored at ${locationPath}`,
          syncVersion,
        },
      });
    }

    await logChange('CTB', ctb.id, 'update', { action: 'receive', stackId, position, layer });

    res.json(updated);
  } catch (error) {
    log.error('Failed to receive CTB', error);
    res.status(500).json({ error: 'Failed to receive CTB' });
  }
});

export default router;
