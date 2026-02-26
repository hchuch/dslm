import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { createLogger } from '../services/logger';

const router = Router();
const prisma = new PrismaClient();
const log = createLogger('users');

// Middleware to check admin role
const adminOnly = (req: AuthenticatedRequest, res: any, next: any) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Get all users (admin only)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        currentLocation: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { username: 'asc' },
    });
    res.json({ users });
  } catch (error) {
    log.error('Failed to fetch users', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get single user (admin only)
router.get('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        currentLocation: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    log.error('Failed to fetch user', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create new user (admin only)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { username, password, name, role, currentLocation } = req.body;

    if (!username || !password || !name || !role) {
      return res.status(400).json({ error: 'Username, password, name, and role are required' });
    }

    // Check if username exists
    const existing = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });

    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Validate role
    const validRoles = ['admin', 'astronaut', 'mission-specialist', 'ground-crew', 'loader'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        name,
        role,
        currentLocation: currentLocation || 'Earth',
        passwordHash,
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        currentLocation: true,
        createdAt: true,
      },
    });

    res.status(201).json({ user });
  } catch (error) {
    log.error('Failed to create user', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user (admin only)
router.patch('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, role, currentLocation, password } = req.body;
    const updateData: any = {};

    if (name) updateData.name = name;
    if (role) {
      const validRoles = ['admin', 'astronaut', 'mission-specialist', 'ground-crew', 'loader'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updateData.role = role;
    }
    if (currentLocation) updateData.currentLocation = currentLocation;
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        currentLocation: true,
        updatedAt: true,
      },
    });

    res.json({ user });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    log.error('Failed to update user', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (admin only)
router.delete('/:id', authMiddleware, adminOnly, async (req: AuthenticatedRequest, res) => {
  try {
    // Prevent self-deletion
    if (req.params.id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await prisma.user.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    log.error('Failed to delete user', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Reset user password (admin only)
router.post('/:id/reset-password', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash },
    });

    res.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    log.error('Failed to reset password', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
