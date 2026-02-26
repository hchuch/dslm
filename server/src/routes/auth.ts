import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { createLogger } from '../services/logger';

const router = Router();
const log = createLogger('auth');
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dslm-super-secret-key';
const TOKEN_EXPIRY = '7d';

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });

    if (!user || user.deletedAt) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token: '', // Will be updated with JWT
        expiresAt,
      },
    });

    // Generate JWT with session ID
    const token = jwt.sign({ sessionId: session.id }, JWT_SECRET, {
      expiresIn: TOKEN_EXPIRY,
    });

    // Update session with token
    await prisma.session.update({
      where: { id: session.id },
      data: { token },
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        currentLocation: user.currentLocation,
      },
    });
  } catch (error) {
    log.error('Login failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.substring(7);

  if (token) {
    try {
      await prisma.session.deleteMany({
        where: { token },
      });
    } catch (error) {
      log.error('Logout failed', error);
    }
  }

  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.json({ user: req.user });
});

// PUT /api/auth/me - Update current user profile
router.put('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { name, currentLocation } = req.body;

  try {
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(name && { name }),
        ...(currentLocation && { currentLocation }),
      },
    });

    res.json({
      user: {
        id: updated.id,
        username: updated.username,
        name: updated.name,
        role: updated.role,
        currentLocation: updated.currentLocation,
      },
    });
  } catch (error) {
    log.error('Update profile failed', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
