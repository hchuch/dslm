import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { logChange, incrementSyncVersion } from '../services/sync';
import { createLogger } from '../services/logger';

const router = Router();
const prisma = new PrismaClient();
const log = createLogger('shipments');

// GET /api/shipments - Get all shipments
router.get('/', async (req, res: Response): Promise<void> => {
  const { status, includeDeleted } = req.query;

  try {
    const shipments = await prisma.shipment.findMany({
      where: {
        ...(status && { status: String(status) }),
        ...(includeDeleted !== 'true' && { deletedAt: null }),
      },
      include: {
        ctbs: {
          where: { deletedAt: null },
          include: {
            items: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(shipments);
  } catch (error) {
    log.error('Failed to get shipments', error);
    res.status(500).json({ error: 'Failed to fetch shipments' });
  }
});

// GET /api/shipments/:id - Get single shipment
router.get('/:id', async (req, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const shipment = await prisma.shipment.findFirst({
      where: { OR: [{ id }, { manifestId: id }], deletedAt: null },
      include: {
        ctbs: {
          where: { deletedAt: null },
          include: {
            items: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!shipment) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }

    res.json(shipment);
  } catch (error) {
    log.error('Failed to get shipment', error);
    res.status(500).json({ error: 'Failed to fetch shipment' });
  }
});

// POST /api/shipments - Create shipment with CTBs and items
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const {
    manifestId,
    destination,
    priority = 'Normal',
    notes,
    ctbs = [],
    items = [],
  } = req.body;

  if (!manifestId || !destination) {
    res.status(400).json({ error: 'manifestId and destination are required' });
    return;
  }

  try {
    const syncVersion = await incrementSyncVersion();

    // Create shipment
    const shipment = await prisma.shipment.create({
      data: {
        manifestId,
        destination,
        priority,
        notes,
        status: 'draft',
        syncVersion,
      },
    });

    // Create CTBs
    for (const ctbData of ctbs) {
      await prisma.cTB.create({
        data: {
          ctbId: ctbData.id || ctbData.ctbId,
          rfidTagId: `RFID-${ctbData.id || ctbData.ctbId}`,
          size: ctbData.size,
          stackId: 'INCOMING',
          position: 0,
          layer: 1,
          locationPath: 'INCOMING',
          mass: ctbData.mass ?? ctbData.size * 2.0,
          volume: ctbData.volume ?? ctbData.size * 0.1,
          shipmentId: shipment.id,
          notes: ctbData.notes,
          syncVersion,
        },
      });
    }

    // Create items
    for (const itemData of items) {
      const itemSyncVersion = await incrementSyncVersion();

      await prisma.inventoryItem.create({
        data: {
          itemId: itemData.id || itemData.itemId,
          name: itemData.name,
          description: itemData.description || '',
          categoryName: itemData.category || itemData.categoryName || 'misc',
          status: 'incoming',
          ctbId: itemData.ctbId,
          stackId: 'INCOMING',
          position: 0,
          layer: 1,
          locationPath: 'INCOMING',
          mass: itemData.mass ?? 0.5,
          volume: itemData.volume ?? 0.01,
          quantity: itemData.quantity ?? 1,
          criticality: itemData.criticality || 'medium',
          notes: itemData.notes,
          syncVersion: itemSyncVersion,
        },
      });

      // Create initial history entry
      await prisma.itemHistoryEntry.create({
        data: {
          itemId: itemData.id || itemData.itemId,
          action: 'loaded',
          userId: req.user?.id,
          toStackId: 'INCOMING',
          toPath: 'INCOMING',
          notes: `Loaded into shipment ${manifestId}`,
          syncVersion: itemSyncVersion,
        },
      });
    }

    await logChange('Shipment', shipment.id, 'create', { manifestId, destination, priority, ctbCount: ctbs.length, itemCount: items.length });

    // Return full shipment with relations
    const fullShipment = await prisma.shipment.findUnique({
      where: { id: shipment.id },
      include: {
        ctbs: {
          include: { items: true },
        },
      },
    });

    res.status(201).json(fullShipment);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Shipment with this manifest ID already exists' });
      return;
    }
    log.error('Failed to create shipment', error);
    res.status(500).json({ error: 'Failed to create shipment' });
  }
});

// PATCH /api/shipments/:id - Update shipment
router.patch('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { destination, priority, notes, status } = req.body;

  try {
    const existing = await prisma.shipment.findFirst({
      where: { OR: [{ id }, { manifestId: id }], deletedAt: null },
    });

    if (!existing) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }

    const syncVersion = await incrementSyncVersion();

    const updated = await prisma.shipment.update({
      where: { id: existing.id },
      data: {
        ...(destination && { destination }),
        ...(priority && { priority }),
        ...(notes !== undefined && { notes }),
        ...(status && { status }),
        syncVersion,
      },
    });

    await logChange('Shipment', existing.id, 'update', { destination, priority, notes, status });

    res.json(updated);
  } catch (error) {
    log.error('Failed to update shipment', error);
    res.status(500).json({ error: 'Failed to update shipment' });
  }
});

// POST /api/shipments/:id/launch - Launch shipment
router.post('/:id/launch', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const existing = await prisma.shipment.findFirst({
      where: { OR: [{ id }, { manifestId: id }], deletedAt: null },
      include: { ctbs: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }

    if (existing.status === 'launched' || existing.status === 'in-transit') {
      res.status(400).json({ error: 'Shipment already launched' });
      return;
    }

    if (existing.ctbs.length === 0) {
      res.status(400).json({ error: 'Cannot launch empty shipment' });
      return;
    }

    const syncVersion = await incrementSyncVersion();

    const updated = await prisma.shipment.update({
      where: { id: existing.id },
      data: {
        status: 'launched',
        launchedAt: new Date(),
        syncVersion,
      },
    });

    await logChange('Shipment', existing.id, 'update', { status: 'launched' });

    res.json(updated);
  } catch (error) {
    log.error('Failed to launch shipment', error);
    res.status(500).json({ error: 'Failed to launch shipment' });
  }
});

export default router;
