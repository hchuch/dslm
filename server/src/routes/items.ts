import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { logChange, incrementSyncVersion } from '../services/sync';
import { createLogger } from '../services/logger';

const router = Router();
const prisma = new PrismaClient();
const log = createLogger('items');

// GET /api/items - Get all items
router.get('/', async (req, res: Response): Promise<void> => {
  const { category, status, stackId, ctbId, includeDeleted } = req.query;

  try {
    const items = await prisma.inventoryItem.findMany({
      where: {
        ...(category && { categoryName: String(category) }),
        ...(status && { status: String(status) }),
        ...(stackId && { stackId: String(stackId) }),
        ...(ctbId && { ctbId: String(ctbId) }),
        ...(includeDeleted !== 'true' && { deletedAt: null }),
      },
      include: {
        history: { orderBy: { timestamp: 'desc' }, take: 10 },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(items);
  } catch (error) {
    log.error('Failed to get items', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// GET /api/items/:id - Get single item
router.get('/:id', async (req, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const item = await prisma.inventoryItem.findFirst({
      where: { OR: [{ id }, { itemId: id }], deletedAt: null },
      include: {
        history: { orderBy: { timestamp: 'desc' } },
        ctb: true,
      },
    });

    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    res.json(item);
  } catch (error) {
    log.error('Failed to get item', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// POST /api/items - Create item
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const {
    itemId,
    name,
    description = '',
    categoryName,
    ctbId,
    mass,
    volume,
    quantity = 1,
    criticality = 'medium',
    foodData,
    expiryDate,
    manufacturer,
    partNumber,
    serialNumber,
    notes,
  } = req.body;

  if (!itemId || !name || !categoryName || !ctbId) {
    res.status(400).json({ error: 'itemId, name, categoryName, and ctbId are required' });
    return;
  }

  try {
    // Get CTB to copy location
    const ctb = await prisma.cTB.findUnique({ where: { ctbId } });
    if (!ctb) {
      res.status(400).json({ error: `CTB ${ctbId} not found` });
      return;
    }

    // Check if category exists
    const category = await prisma.category.findUnique({ where: { name: categoryName } });
    if (!category) {
      res.status(400).json({ error: `Category ${categoryName} not found` });
      return;
    }

    const syncVersion = await incrementSyncVersion();

    // Determine initial status based on CTB location
    const status = ctb.stackId === 'INCOMING' ? 'incoming' : 'stock';

    const item = await prisma.inventoryItem.create({
      data: {
        itemId,
        name,
        description,
        categoryName,
        status,
        ctbId,
        stackId: ctb.stackId,
        position: ctb.position,
        layer: ctb.layer,
        locationPath: ctb.locationPath,
        mass: mass ?? 0.5,
        volume: volume ?? 0.01,
        quantity,
        criticality,
        foodData: foodData ? JSON.stringify(foodData) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        manufacturer,
        partNumber,
        serialNumber,
        notes,
        syncVersion,
      },
    });

    // Create initial history entry
    await prisma.itemHistoryEntry.create({
      data: {
        itemId: item.itemId,
        action: 'loaded',
        userId: req.user?.id,
        toStackId: ctb.stackId,
        toPosition: ctb.position,
        toLayer: ctb.layer,
        toPath: ctb.locationPath,
        notes: 'Initial load',
        syncVersion,
      },
    });

    await logChange('InventoryItem', item.id, 'create', item);

    res.status(201).json(item);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Item with this ID already exists' });
      return;
    }
    log.error('Failed to create item', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// PATCH /api/items/:id - Update item
router.patch('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const {
    name,
    description,
    status,
    quantity,
    criticality,
    notes,
    foodData,
  } = req.body;

  try {
    const existing = await prisma.inventoryItem.findFirst({
      where: { OR: [{ id }, { itemId: id }], deletedAt: null },
    });

    if (!existing) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    const syncVersion = await incrementSyncVersion();

    const updated = await prisma.inventoryItem.update({
      where: { id: existing.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(quantity !== undefined && { quantity }),
        ...(criticality && { criticality }),
        ...(notes !== undefined && { notes }),
        ...(foodData !== undefined && { foodData: JSON.stringify(foodData) }),
        syncVersion,
      },
    });

    await logChange('InventoryItem', existing.id, 'update', { name, description, status, quantity, criticality, notes });

    res.json(updated);
  } catch (error) {
    log.error('Failed to update item', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/items/:id - Delete item
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const existing = await prisma.inventoryItem.findFirst({
      where: { OR: [{ id }, { itemId: id }], deletedAt: null },
    });

    if (!existing) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    const syncVersion = await incrementSyncVersion();

    await prisma.inventoryItem.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), syncVersion },
    });

    await logChange('InventoryItem', existing.id, 'delete', { itemId: existing.itemId });

    res.json({ success: true });
  } catch (error) {
    log.error('Failed to delete item', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// POST /api/items/:id/deliver - Mark item as delivered
router.post('/:id/deliver', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { timeTaken } = req.body;

  try {
    const existing = await prisma.inventoryItem.findFirst({
      where: { OR: [{ id }, { itemId: id }], deletedAt: null },
    });

    if (!existing) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    const syncVersion = await incrementSyncVersion();

    const updated = await prisma.inventoryItem.update({
      where: { id: existing.id },
      data: {
        status: 'delivered',
        deliveredDate: new Date(),
        syncVersion,
      },
    });

    await prisma.itemHistoryEntry.create({
      data: {
        itemId: existing.itemId,
        action: 'delivered',
        userId: req.user?.id,
        notes: 'Item delivered to crew',
        timeTaken,
        syncVersion,
      },
    });

    await logChange('InventoryItem', existing.id, 'update', { status: 'delivered' });

    res.json(updated);
  } catch (error) {
    log.error('Failed to deliver item', error);
    res.status(500).json({ error: 'Failed to deliver item' });
  }
});

// POST /api/items/:id/consume - Mark item as consumed
router.post('/:id/consume', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { timeTaken } = req.body;

  try {
    const existing = await prisma.inventoryItem.findFirst({
      where: { OR: [{ id }, { itemId: id }], deletedAt: null },
    });

    if (!existing) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    const syncVersion = await incrementSyncVersion();

    const updated = await prisma.inventoryItem.update({
      where: { id: existing.id },
      data: {
        status: 'consumed',
        consumedDate: new Date(),
        syncVersion,
      },
    });

    await prisma.itemHistoryEntry.create({
      data: {
        itemId: existing.itemId,
        action: 'consumed',
        userId: req.user?.id,
        notes: 'Item consumed',
        timeTaken,
        syncVersion,
      },
    });

    await logChange('InventoryItem', existing.id, 'update', { status: 'consumed' });

    res.json(updated);
  } catch (error) {
    log.error('Failed to consume item', error);
    res.status(500).json({ error: 'Failed to consume item' });
  }
});

// POST /api/items/:id/relocate - Move item to different location
router.post('/:id/relocate', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { newCtbId, timeTaken } = req.body;

  if (!newCtbId) {
    res.status(400).json({ error: 'newCtbId is required' });
    return;
  }

  try {
    const existing = await prisma.inventoryItem.findFirst({
      where: { OR: [{ id }, { itemId: id }], deletedAt: null },
    });

    if (!existing) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    const newCtb = await prisma.cTB.findUnique({ where: { ctbId: newCtbId } });
    if (!newCtb) {
      res.status(400).json({ error: `CTB ${newCtbId} not found` });
      return;
    }

    const syncVersion = await incrementSyncVersion();

    const updated = await prisma.inventoryItem.update({
      where: { id: existing.id },
      data: {
        ctbId: newCtbId,
        stackId: newCtb.stackId,
        position: newCtb.position,
        layer: newCtb.layer,
        locationPath: newCtb.locationPath,
        syncVersion,
      },
    });

    await prisma.itemHistoryEntry.create({
      data: {
        itemId: existing.itemId,
        action: 'relocated',
        userId: req.user?.id,
        fromStackId: existing.stackId,
        fromPosition: existing.position,
        fromLayer: existing.layer,
        fromPath: existing.locationPath,
        toStackId: newCtb.stackId,
        toPosition: newCtb.position,
        toLayer: newCtb.layer,
        toPath: newCtb.locationPath,
        notes: `Relocated from ${existing.ctbId} to ${newCtbId}`,
        timeTaken,
        syncVersion,
      },
    });

    await logChange('InventoryItem', existing.id, 'update', { ctbId: newCtbId, relocated: true });

    res.json(updated);
  } catch (error) {
    log.error('Failed to relocate item', error);
    res.status(500).json({ error: 'Failed to relocate item' });
  }
});

export default router;
