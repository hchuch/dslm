import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthenticatedRequest, optionalAuth } from '../middleware/auth';
import { getChangesSince, getFullDataDump, getCurrentSyncVersion, updateClientSyncVersion, incrementSyncVersion } from '../services/sync';
import { createLogger } from '../services/logger';

const router = Router();
const prisma = new PrismaClient();
const log = createLogger('sync');

// Flatten nested location object to Prisma columns
function flattenData(data: any): any {
  const { location, lastAccessedDate, deliveredDate, ...rest } = data;
  const flat: any = { ...rest };
  if (location) {
    if (location.stack) flat.stackId = location.stack;
    if (location.position !== undefined) flat.position = location.position;
    if (location.layer !== undefined) flat.layer = location.layer;
    if (location.path) flat.locationPath = location.path;
  }
  if (lastAccessedDate) flat.lastAccessedDate = new Date(lastAccessedDate);
  if (deliveredDate) flat.deliveredDate = new Date(deliveredDate);
  return flat;
}

// GET /api/sync/changes?since=<version> - Get changes since version
router.get('/changes', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  const since = parseInt(String(req.query.since) || '0', 10);

  try {
    const result = await getChangesSince(since);
    res.json(result);
  } catch (error) {
    log.error('Failed to get changes', error);
    res.status(500).json({ error: 'Failed to fetch changes' });
  }
});

// GET /api/sync/full - Full data dump for initial sync
router.get('/full', optionalAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await getFullDataDump();
    res.json(data);
  } catch (error) {
    log.error('Failed full sync', error);
    res.status(500).json({ error: 'Failed to fetch full data' });
  }
});

// GET /api/sync/version - Get current sync version
router.get('/version', async (_req: Request, res: Response): Promise<void> => {
  try {
    const version = await getCurrentSyncVersion();
    res.json({ version });
  } catch (error) {
    log.error('Failed to get version', error);
    res.status(500).json({ error: 'Failed to get sync version' });
  }
});

// POST /api/sync/push - Push local changes to server
router.post('/push', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { clientId, changes } = req.body;

  if (!clientId || !Array.isArray(changes)) {
    res.status(400).json({ error: 'clientId and changes array are required' });
    return;
  }

  try {
    const results: Array<{ success: boolean; localId: string; serverId?: string; error?: string }> = [];

    for (const change of changes) {
      const { tableName, operation, localId, data } = change;

      try {
        let serverId: string | undefined;
        let recordSyncVersion: number | undefined;

        switch (tableName) {
          case 'Category': {
            if (operation === 'create') {
              const syncVersion = await incrementSyncVersion();
              recordSyncVersion = syncVersion;
              const category = await prisma.category.upsert({
                where: { name: data.name },
                create: {
                  name: data.name,
                  label: data.label,
                  prefix: data.prefix,
                  icon: data.icon,
                  isSystem: false,
                  syncVersion,
                },
                update: {
                  label: data.label,
                  prefix: data.prefix,
                  icon: data.icon,
                  syncVersion,
                },
              });
              serverId = category.id;
            } else if (operation === 'update') {
              recordSyncVersion = await incrementSyncVersion();
              await prisma.category.update({
                where: { id: localId },
                data: { ...data, syncVersion: recordSyncVersion },
              });
            } else if (operation === 'delete') {
              recordSyncVersion = await incrementSyncVersion();
              await prisma.category.update({
                where: { id: localId },
                data: { deletedAt: new Date(), syncVersion: recordSyncVersion },
              });
            }
            break;
          }

          case 'CTB': {
            if (operation === 'create') {
              const syncVersion = await incrementSyncVersion();
              recordSyncVersion = syncVersion;
              const ctb = await prisma.cTB.upsert({
                where: { ctbId: data.ctbId },
                create: {
                  ctbId: data.ctbId,
                  rfidTagId: data.rfidTagId || `RFID-${data.ctbId}`,
                  size: data.size,
                  stackId: data.stackId || 'INCOMING',
                  position: data.position || 0,
                  layer: data.layer || 1,
                  locationPath: data.locationPath || 'INCOMING',
                  mass: data.mass,
                  volume: data.volume,
                  shipmentId: data.shipmentId,
                  syncVersion,
                },
                update: {
                  rfidTagId: data.rfidTagId || undefined,
                  size: data.size,
                  mass: data.mass,
                  volume: data.volume,
                  shipmentId: data.shipmentId,
                  syncVersion,
                },
              });
              serverId = ctb.id;
            } else if (operation === 'update') {
              recordSyncVersion = await incrementSyncVersion();
              await prisma.cTB.updateMany({
                where: { OR: [{ id: localId }, { ctbId: localId }] },
                data: { ...flattenData(data), syncVersion: recordSyncVersion },
              });
            } else if (operation === 'delete') {
              recordSyncVersion = await incrementSyncVersion();
              await prisma.cTB.updateMany({
                where: { OR: [{ id: localId }, { ctbId: localId }] },
                data: { deletedAt: new Date(), syncVersion: recordSyncVersion },
              });
            }
            break;
          }

          case 'InventoryItem': {
            if (operation === 'create') {
              const syncVersion = await incrementSyncVersion();
              recordSyncVersion = syncVersion;
              const item = await prisma.inventoryItem.upsert({
                where: { itemId: data.itemId },
                create: {
                  itemId: data.itemId,
                  name: data.name,
                  description: data.description || '',
                  categoryName: data.categoryName || 'misc',
                  status: data.status || 'incoming',
                  ctbId: data.ctbId,
                  stackId: data.stackId || 'INCOMING',
                  position: data.position || 0,
                  layer: data.layer || 1,
                  locationPath: data.locationPath || 'INCOMING',
                  mass: data.mass || 0.5,
                  volume: data.volume || 0.01,
                  quantity: data.quantity || 1,
                  criticality: data.criticality || 'medium',
                  notes: data.notes,
                  syncVersion,
                },
                update: {
                  name: data.name,
                  description: data.description,
                  categoryName: data.categoryName,
                  status: data.status,
                  ctbId: data.ctbId,
                  mass: data.mass,
                  volume: data.volume,
                  quantity: data.quantity,
                  criticality: data.criticality,
                  notes: data.notes,
                  syncVersion,
                },
              });
              serverId = item.id;
            } else if (operation === 'update') {
              recordSyncVersion = await incrementSyncVersion();
              await prisma.inventoryItem.updateMany({
                where: { OR: [{ id: localId }, { itemId: localId }] },
                data: { ...flattenData(data), syncVersion: recordSyncVersion },
              });
            } else if (operation === 'delete') {
              recordSyncVersion = await incrementSyncVersion();
              await prisma.inventoryItem.updateMany({
                where: { OR: [{ id: localId }, { itemId: localId }] },
                data: { deletedAt: new Date(), syncVersion: recordSyncVersion },
              });
            }
            break;
          }

          case 'ItemHistoryEntry': {
            if (operation === 'create') {
              recordSyncVersion = await incrementSyncVersion();
              const entry = await prisma.itemHistoryEntry.create({
                data: {
                  itemId: data.itemId,
                  action: data.action,
                  userId: data.userId || req.user?.id,
                  fromStackId: data.fromStackId,
                  fromPosition: data.fromPosition,
                  fromLayer: data.fromLayer,
                  fromPath: data.fromPath,
                  toStackId: data.toStackId,
                  toPosition: data.toPosition,
                  toLayer: data.toLayer,
                  toPath: data.toPath,
                  notes: data.notes,
                  timeTaken: data.timeTaken,
                  syncVersion: recordSyncVersion,
                },
              });
              serverId = entry.id;
            }
            break;
          }

          case 'Shipment': {
            if (operation === 'create') {
              const syncVersion = await incrementSyncVersion();
              recordSyncVersion = syncVersion;
              const shipment = await prisma.shipment.upsert({
                where: { manifestId: data.manifestId },
                create: {
                  manifestId: data.manifestId,
                  destination: data.destination,
                  priority: data.priority || 'Normal',
                  notes: data.notes,
                  status: data.status || 'draft',
                  syncVersion,
                },
                update: {
                  destination: data.destination,
                  priority: data.priority,
                  notes: data.notes,
                  status: data.status,
                  syncVersion,
                },
              });
              serverId = shipment.id;
            } else if (operation === 'update') {
              recordSyncVersion = await incrementSyncVersion();
              await prisma.shipment.updateMany({
                where: { OR: [{ id: localId }, { manifestId: localId }] },
                data: { ...data, syncVersion: recordSyncVersion },
              });
            } else if (operation === 'delete') {
              recordSyncVersion = await incrementSyncVersion();
              await prisma.shipment.updateMany({
                where: { OR: [{ id: localId }, { manifestId: localId }] },
                data: { deletedAt: new Date(), syncVersion: recordSyncVersion },
              });
            }
            break;
          }

          default:
            results.push({ success: false, localId, error: `Unknown table: ${tableName}` });
            continue;
        }

        // Write to changeLog so other devices can pull this change
        if (recordSyncVersion) {
          await prisma.changeLog.create({
            data: {
              tableName,
              recordId: serverId || localId,
              operation,
              changeData: JSON.stringify(data),
              syncVersion: recordSyncVersion,
            },
          });
        }

        results.push({ success: true, localId, serverId });
      } catch (error: any) {
        log.error(`Push failed for ${tableName}/${localId}`, error);
        results.push({ success: false, localId, error: error.message });
      }
    }

    // Update client's last sync version
    const currentVersion = await getCurrentSyncVersion();
    await updateClientSyncVersion(clientId, currentVersion);

    res.json({
      results,
      currentVersion,
    });
  } catch (error) {
    log.error('Failed to push changes', error);
    res.status(500).json({ error: 'Failed to push changes' });
  }
});

// POST /api/sync/ack - Acknowledge sync version (for client tracking)
router.post('/ack', async (req: Request, res: Response): Promise<void> => {
  const { clientId, syncVersion } = req.body;

  if (!clientId || syncVersion === undefined) {
    res.status(400).json({ error: 'clientId and syncVersion are required' });
    return;
  }

  try {
    await updateClientSyncVersion(clientId, syncVersion);
    res.json({ success: true });
  } catch (error) {
    log.error('Failed to acknowledge sync', error);
    res.status(500).json({ error: 'Failed to acknowledge sync' });
  }
});

export default router;
