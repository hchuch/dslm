import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { logChange } from '../services/sync';
import { createLogger } from '../services/logger';

const router = Router();
const prisma = new PrismaClient();
const log = createLogger('categories');

// GET /api/categories - Get all categories
router.get('/', async (_req, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: [{ isSystem: 'desc' }, { label: 'asc' }],
    });

    res.json(categories);
  } catch (error) {
    log.error('Failed to get categories', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/categories - Create custom category
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { name, label, prefix, icon } = req.body;

  if (!name || !label || !prefix) {
    res.status(400).json({ error: 'Name, label, and prefix are required' });
    return;
  }

  // Validate name format (lowercase, alphanumeric with hyphens)
  if (!/^[a-z0-9-]+$/.test(name)) {
    res.status(400).json({ error: 'Name must be lowercase alphanumeric with hyphens only' });
    return;
  }

  try {
    const category = await prisma.category.create({
      data: {
        name: name.toLowerCase(),
        label,
        prefix: prefix.toUpperCase(),
        icon,
        isSystem: false,
      },
    });

    await logChange('Category', category.id, 'create', category);

    res.status(201).json(category);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Category with this name already exists' });
      return;
    }
    log.error('Failed to create category', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PATCH /api/categories/:id - Update category
router.patch('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { label, prefix, icon } = req.body;

  try {
    const existing = await prisma.category.findUnique({ where: { id } });

    if (!existing || existing.deletedAt) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    // Cannot modify system categories (except icon)
    if (existing.isSystem && (label || prefix)) {
      res.status(403).json({ error: 'Cannot modify system category label or prefix' });
      return;
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        ...(label && { label }),
        ...(prefix && { prefix: prefix.toUpperCase() }),
        ...(icon !== undefined && { icon }),
      },
    });

    await logChange('Category', id, 'update', { label, prefix, icon });

    res.json(updated);
  } catch (error) {
    log.error('Failed to update category', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/categories/:id - Delete custom category
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const existing = await prisma.category.findUnique({ where: { id } });

    if (!existing || existing.deletedAt) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    if (existing.isSystem) {
      res.status(403).json({ error: 'Cannot delete system category' });
      return;
    }

    // Check if category has items
    const itemCount = await prisma.inventoryItem.count({
      where: { categoryName: existing.name, deletedAt: null },
    });

    if (itemCount > 0) {
      res.status(409).json({ error: `Cannot delete category with ${itemCount} items. Reassign items first.` });
      return;
    }

    // Soft delete
    await prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logChange('Category', id, 'delete', { name: existing.name });

    res.json({ success: true });
  } catch (error) {
    log.error('Failed to delete category', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
