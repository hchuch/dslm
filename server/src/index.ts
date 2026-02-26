import cors from 'cors';
import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';
import open from 'open';

// Import middleware
import { requestLogger } from './middleware/request-logger';

// Import logger and log viewer
import logger, { printStartupBanner, printShutdownMessage } from './services/logger';
import { logViewer, logViewerHTML } from './services/log-viewer';

// Import routes
import authRoutes from './routes/auth';
import categoryRoutes from './routes/categories';
import ctbRoutes from './routes/ctbs';
import itemRoutes from './routes/items';
import shipmentRoutes from './routes/shipments';
import syncRoutes from './routes/sync';
import userRoutes from './routes/users';

const app = express();
const server = createServer(app);
const port = Number(process.env.PORT || 4000);
const prisma = new PrismaClient();

// Initialize WebSocket for log viewer
logViewer.initialize(server);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

// Health check
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, now: Date.now(), database: 'connected' });
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(500).json({ ok: false, now: Date.now(), database: 'disconnected' });
  }
});

// Log viewer page
app.get('/logs', (_req: Request, res: Response) => {
  res.type('html').send(logViewerHTML);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/ctbs', ctbRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/users', userRoutes);

// Legacy compatibility routes
app.get('/items', async (_req: Request, res: Response) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: { deletedAt: null },
      select: {
        itemId: true,
        name: true,
        quantity: true,
        categoryName: true,
        status: true,
      },
    });

    const legacyItems = items.map((item) => ({
      id: item.itemId,
      name: item.name,
      qty: item.quantity,
      category: item.categoryName,
      status: item.status === 'incoming' ? 'incoming' : 'stock',
    }));

    res.json(legacyItems);
  } catch (error) {
    logger.error('Legacy items endpoint failed', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: Function) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
server.listen(port, '0.0.0.0', () => {
  printStartupBanner(port);
  logger.info('Server started successfully', { port });

  // Open log viewer in browser
  const logViewerUrl = `http://localhost:${port}/logs`;
  open(logViewerUrl).catch(() => {
    logger.info('Log viewer available at', { url: logViewerUrl });
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  printShutdownMessage();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  printShutdownMessage();
  await prisma.$disconnect();
  process.exit(0);
});
