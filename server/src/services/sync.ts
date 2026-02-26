import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get the current global sync version
 */
export async function getCurrentSyncVersion(): Promise<number> {
  const meta = await prisma.syncMetadata.findUnique({
    where: { id: 'global' },
  });
  return meta?.currentVersion ?? 0;
}

/**
 * Increment and return the new sync version
 */
export async function incrementSyncVersion(): Promise<number> {
  const updated = await prisma.syncMetadata.update({
    where: { id: 'global' },
    data: { currentVersion: { increment: 1 } },
  });
  return updated.currentVersion;
}

/**
 * Log a change for sync tracking
 */
export async function logChange(
  tableName: string,
  recordId: string,
  operation: 'create' | 'update' | 'delete',
  changeData: Record<string, unknown>
): Promise<void> {
  const syncVersion = await incrementSyncVersion();

  await prisma.changeLog.create({
    data: {
      tableName,
      recordId,
      operation,
      changeData: JSON.stringify(changeData),
      syncVersion,
    },
  });
}

/**
 * Get all changes since a given sync version
 */
export async function getChangesSince(sinceVersion: number): Promise<{
  changes: Array<{
    tableName: string;
    recordId: string;
    operation: string;
    changeData: Record<string, unknown>;
    syncVersion: number;
    createdAt: Date;
  }>;
  currentVersion: number;
}> {
  const [changes, currentVersion] = await Promise.all([
    prisma.changeLog.findMany({
      where: { syncVersion: { gt: sinceVersion } },
      orderBy: { syncVersion: 'asc' },
    }),
    getCurrentSyncVersion(),
  ]);

  return {
    changes: changes.map((c) => ({
      ...c,
      changeData: JSON.parse(c.changeData),
    })),
    currentVersion,
  };
}

/**
 * Update client's last sync version
 */
export async function updateClientSyncVersion(
  clientId: string,
  syncVersion: number
): Promise<void> {
  await prisma.syncLog.upsert({
    where: { clientId },
    update: { lastSyncVersion: syncVersion, lastSyncTime: new Date() },
    create: { clientId, lastSyncVersion: syncVersion },
  });
}

/**
 * Get full data dump for initial sync
 */
export async function getFullDataDump() {
  const [
    categories,
    stacks,
    ctbs,
    items,
    shipments,
    historyEntries,
    currentVersion,
  ] = await Promise.all([
    prisma.category.findMany({ where: { deletedAt: null } }),
    prisma.stack.findMany({ where: { deletedAt: null } }),
    prisma.cTB.findMany({ where: { deletedAt: null } }),
    prisma.inventoryItem.findMany({ where: { deletedAt: null } }),
    prisma.shipment.findMany({ where: { deletedAt: null } }),
    prisma.itemHistoryEntry.findMany(),
    getCurrentSyncVersion(),
  ]);

  return {
    categories,
    stacks,
    ctbs,
    items,
    shipments,
    historyEntries,
    currentVersion,
  };
}
