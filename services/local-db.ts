import * as SQLite from 'expo-sqlite';
import type {
  CTB,
  CTBSize,
  InventoryItem,
  ItemCategory,
  ItemHistoryEntry,
  ItemStatus,
  Location,
  Shipment,
  StackConfiguration,
  StackId,
} from '../types/dslm';

const DB_NAME = 'dslm.db';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await initializeDatabase(db);
  }
  return db;
}

async function initializeDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      prefix TEXT NOT NULL,
      icon TEXT,
      isSystem INTEGER DEFAULT 0,
      isImportant INTEGER DEFAULT 0,
      syncVersion INTEGER DEFAULT 0,
      deletedAt TEXT,
      pendingSync INTEGER DEFAULT 0,
      localOperation TEXT
    );

    CREATE TABLE IF NOT EXISTS stacks (
      id TEXT PRIMARY KEY,
      stackId TEXT UNIQUE NOT NULL,
      positions INTEGER DEFAULT 16,
      maxLayers INTEGER DEFAULT 4,
      allowedCTBSizes TEXT,
      isFlexibleShape INTEGER DEFAULT 0,
      totalVolume REAL DEFAULT 12.0,
      currentUtilization REAL DEFAULT 0,
      syncVersion INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ctbs (
      id TEXT PRIMARY KEY,
      ctbId TEXT UNIQUE NOT NULL,
      rfidTagType TEXT DEFAULT 'RFID',
      rfidTagId TEXT,
      rfidBatteryLife INTEGER DEFAULT 365,
      size REAL NOT NULL,
      stackId TEXT NOT NULL,
      position INTEGER NOT NULL,
      layer INTEGER DEFAULT 1,
      locationPath TEXT,
      parentCTBId TEXT,
      mass REAL,
      volume REAL,
      packedVolume REAL,
      unpackedVolume REAL,
      nestingDepth INTEGER DEFAULT 0,
      isWaste INTEGER DEFAULT 0,
      wasteVolumeMultiplier REAL,
      loadedDate TEXT,
      lastAccessedDate TEXT,
      lastAccessedBy TEXT,
      notes TEXT,
      shipmentId TEXT,
      syncVersion INTEGER DEFAULT 0,
      deletedAt TEXT,
      pendingSync INTEGER DEFAULT 0,
      localOperation TEXT
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      itemId TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      categoryName TEXT NOT NULL,
      status TEXT DEFAULT 'incoming',
      rfidTagType TEXT,
      rfidTagId TEXT,
      barcode TEXT,
      ctbId TEXT NOT NULL,
      stackId TEXT NOT NULL,
      position INTEGER,
      layer INTEGER DEFAULT 1,
      locationPath TEXT,
      mass REAL,
      volume REAL,
      quantity INTEGER DEFAULT 1,
      foodData TEXT,
      loadedDate TEXT,
      deliveredDate TEXT,
      consumedDate TEXT,
      expiryDate TEXT,
      manufacturer TEXT,
      partNumber TEXT,
      serialNumber TEXT,
      criticality TEXT DEFAULT 'medium',
      notes TEXT,
      syncVersion INTEGER DEFAULT 0,
      deletedAt TEXT,
      pendingSync INTEGER DEFAULT 0,
      localOperation TEXT
    );

    CREATE TABLE IF NOT EXISTS itemHistory (
      id TEXT PRIMARY KEY,
      itemId TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      action TEXT NOT NULL,
      userId TEXT,
      fromStackId TEXT,
      fromPosition INTEGER,
      fromLayer INTEGER,
      fromPath TEXT,
      toStackId TEXT,
      toPosition INTEGER,
      toLayer INTEGER,
      toPath TEXT,
      notes TEXT,
      timeTaken INTEGER,
      syncVersion INTEGER DEFAULT 0,
      pendingSync INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS shipments (
      id TEXT PRIMARY KEY,
      manifestId TEXT UNIQUE NOT NULL,
      destination TEXT NOT NULL,
      priority TEXT DEFAULT 'Normal',
      notes TEXT,
      status TEXT DEFAULT 'draft',
      launchedAt TEXT,
      deliveredAt TEXT,
      receivedAt TEXT,
      syncVersion INTEGER DEFAULT 0,
      deletedAt TEXT,
      pendingSync INTEGER DEFAULT 0,
      localOperation TEXT
    );

    CREATE TABLE IF NOT EXISTS wasteItems (
      id TEXT PRIMARY KEY,
      itemId TEXT NOT NULL,
      ctbId TEXT NOT NULL,
      originalVolume REAL NOT NULL,
      wasteVolume REAL NOT NULL,
      disposalMethod TEXT DEFAULT 'return-earth',
      markedDate TEXT NOT NULL,
      disposedDate TEXT,
      syncVersion INTEGER DEFAULT 0,
      pendingSync INTEGER DEFAULT 0,
      localOperation TEXT
    );

    CREATE TABLE IF NOT EXISTS syncMetadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS pendingChanges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tableName TEXT NOT NULL,
      recordId TEXT NOT NULL,
      operation TEXT NOT NULL,
      data TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      currentLocation TEXT DEFAULT 'Earth',
      passwordHash TEXT NOT NULL,
      lastLoginAt TEXT,
      syncVersion INTEGER DEFAULT 0
    );

    INSERT OR IGNORE INTO syncMetadata (key, value) VALUES ('lastSyncVersion', '0');
    INSERT OR IGNORE INTO syncMetadata (key, value) VALUES ('lastSyncTime', NULL);
    INSERT OR IGNORE INTO syncMetadata (key, value) VALUES ('clientId', '${generateClientId()}');
  `);

  await seedDefaultData(database);
  await runMigrations(database);
}

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationName = 'add_ctb_volume_columns';
  const existingMigration = await database.getAllAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM migrations WHERE name = ?',
    [migrationName]
  );

  if (existingMigration[0]?.count === 0) {
    try {
      const tableInfo = await database.getAllAsync<{ name: string }>(
        "PRAGMA table_info(ctbs)"
      );
      const columnNames = tableInfo.map(col => col.name);

      if (!columnNames.includes('packedVolume')) {
        await database.runAsync('ALTER TABLE ctbs ADD COLUMN packedVolume REAL');
      }
      if (!columnNames.includes('unpackedVolume')) {
        await database.runAsync('ALTER TABLE ctbs ADD COLUMN unpackedVolume REAL');
      }
      if (!columnNames.includes('nestingDepth')) {
        await database.runAsync('ALTER TABLE ctbs ADD COLUMN nestingDepth INTEGER DEFAULT 0');
      }

      await database.runAsync(
        'INSERT INTO migrations (name) VALUES (?)',
        [migrationName]
      );
    } catch (error) {
      console.error('[LocalDB] Migration error:', error);
    }
  }

  const categoryMigrationName = 'add_category_isImportant';
  const existingCategoryMigration = await database.getAllAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM migrations WHERE name = ?',
    [categoryMigrationName]
  );

  if (existingCategoryMigration[0]?.count === 0) {
    try {
      const tableInfo = await database.getAllAsync<{ name: string }>(
        "PRAGMA table_info(categories)"
      );
      const columnNames = tableInfo.map(col => col.name);

      if (!columnNames.includes('isImportant')) {
        await database.runAsync('ALTER TABLE categories ADD COLUMN isImportant INTEGER DEFAULT 0');
      }

      await database.runAsync(
        'INSERT INTO migrations (name) VALUES (?)',
        [categoryMigrationName]
      );
    } catch (error) {
      console.error('[LocalDB] Migration error:', error);
    }
  }

  const shipmentMigrationName = 'add_shipment_extra_columns';
  const existingShipmentMigration = await database.getAllAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM migrations WHERE name = ?',
    [shipmentMigrationName]
  );

  if (existingShipmentMigration[0]?.count === 0) {
    const addColumnSafe = async (col: string, type: string) => {
      try {
        await database.runAsync(`ALTER TABLE shipments ADD COLUMN ${col} ${type}`);
      } catch {
        // Column already exists — safe to ignore
      }
    };

    await addColumnSafe('ctbIds', 'TEXT');
    await addColumnSafe('totalMass', 'REAL');
    await addColumnSafe('itemCount', 'INTEGER');

    await database.runAsync(
      'INSERT INTO migrations (name) VALUES (?)',
      [shipmentMigrationName]
    );
  }

  const outsideMigrationName = 'add_ctb_outside_columns';
  const existingOutsideMigration = await database.getAllAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM migrations WHERE name = ?',
    [outsideMigrationName]
  );

  if (existingOutsideMigration[0]?.count === 0) {
    const addColumnSafe = async (col: string, type: string) => {
      try {
        await database.runAsync(`ALTER TABLE ctbs ADD COLUMN ${col} ${type}`);
      } catch {
        // Column already exists — safe to ignore
      }
    };

    await addColumnSafe('isOutside', 'INTEGER DEFAULT 0');
    await addColumnSafe('previousLocation', 'TEXT');

    await database.runAsync(
      'INSERT INTO migrations (name) VALUES (?)',
      [outsideMigrationName]
    );
  }
}

function generateClientId(): string {
  return `device-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

async function seedDefaultData(database: SQLite.SQLiteDatabase): Promise<void> {
  const existingCategories = await database.getAllAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );

  if (existingCategories[0]?.count === 0) {
    const categories = [
      { name: 'food', label: 'Food', prefix: 'FOOD', isSystem: 1 },
      { name: 'water', label: 'Water', prefix: 'WATER', isSystem: 1 },
      { name: 'clothing', label: 'Clothing', prefix: 'CLOTH', isSystem: 1 },
      { name: 'hygiene', label: 'Hygiene', prefix: 'HYG', isSystem: 1 },
      { name: 'medical', label: 'Medical', prefix: 'MED', isSystem: 1 },
      { name: 'scientific-equipment', label: 'Scientific Equipment', prefix: 'SCI', isSystem: 1 },
      { name: 'spare-parts', label: 'Spare Parts', prefix: 'SPARE', isSystem: 1 },
      { name: 'lab-equipment', label: 'Lab Equipment', prefix: 'LAB', isSystem: 1 },
      { name: 'lunar-equipment', label: 'Lunar Equipment', prefix: 'LUNAR', isSystem: 1 },
      { name: 'waste', label: 'Waste', prefix: 'WASTE', isSystem: 1 },
      { name: 'misc', label: 'Miscellaneous', prefix: 'MISC', isSystem: 1 },
    ];

    for (const cat of categories) {
      await database.runAsync(
        'INSERT OR IGNORE INTO categories (id, name, label, prefix, isSystem) VALUES (?, ?, ?, ?, ?)',
        [`cat-${cat.name}`, cat.name, cat.label, cat.prefix, cat.isSystem]
      );
    }
  }

  const existingStacks = await database.getAllAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM stacks'
  );

  if (existingStacks[0]?.count === 0) {
    const stacks = [
      { stackId: 'S1', positions: 16, maxLayers: 4, allowedCTBSizes: JSON.stringify([0.5, 1.0, 2.0, 4.0, 6.0, 8.0, 10.0]), isFlexibleShape: 0, totalVolume: 12.0 },
      { stackId: 'S2', positions: 16, maxLayers: 4, allowedCTBSizes: JSON.stringify([0.5, 1.0, 2.0, 4.0, 6.0, 8.0, 10.0]), isFlexibleShape: 0, totalVolume: 12.0 },
      { stackId: 'S3', positions: 16, maxLayers: 4, allowedCTBSizes: JSON.stringify([0.5, 1.0, 2.0, 4.0, 6.0, 8.0, 10.0]), isFlexibleShape: 0, totalVolume: 12.0 },
      { stackId: 'C1', positions: 16, maxLayers: 4, allowedCTBSizes: JSON.stringify([0.5, 1.0, 2.0, 4.0]), isFlexibleShape: 1, totalVolume: 8.0 },
      { stackId: 'C2', positions: 16, maxLayers: 4, allowedCTBSizes: JSON.stringify([0.5, 1.0, 2.0, 4.0]), isFlexibleShape: 1, totalVolume: 8.0 },
      { stackId: 'INCOMING', positions: 100, maxLayers: 1, allowedCTBSizes: JSON.stringify([0.5, 1.0, 2.0, 4.0, 6.0, 8.0, 10.0]), isFlexibleShape: 1, totalVolume: 100.0 },
    ];

    for (const stack of stacks) {
      await database.runAsync(
        'INSERT OR IGNORE INTO stacks (id, stackId, positions, maxLayers, allowedCTBSizes, isFlexibleShape, totalVolume) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [`stack-${stack.stackId}`, stack.stackId, stack.positions, stack.maxLayers, stack.allowedCTBSizes, stack.isFlexibleShape, stack.totalVolume]
      );
    }
  }
}

export interface CategoryRecord {
  id: string;
  name: string;
  label: string;
  prefix: string;
  icon: string | null;
  isSystem: boolean;
  isImportant: boolean;
}

export async function getAllCategories(): Promise<CategoryRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM categories WHERE deletedAt IS NULL ORDER BY isSystem DESC, label ASC'
  );
  return rows.map((row) => ({
    ...row,
    isSystem: row.isSystem === 1,
    isImportant: row.isImportant === 1,
  }));
}

export async function createCategory(category: Omit<CategoryRecord, 'isSystem' | 'isImportant'> & { isSystem?: boolean; isImportant?: boolean }): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR IGNORE INTO categories (id, name, label, prefix, icon, isSystem, isImportant, pendingSync, localOperation) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)',
    [category.id, category.name, category.label, category.prefix, category.icon, category.isSystem ? 1 : 0, category.isImportant ? 1 : 0, 'create']
  );
  await queueChange('Category', category.id, 'create', category);
}

export async function getAllCTBs(): Promise<CTB[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM ctbs WHERE deletedAt IS NULL ORDER BY stackId ASC, position ASC, layer ASC'
  );
  return rows.map(rowToCTB);
}

export async function getCTBById(ctbId: string): Promise<CTB | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM ctbs WHERE (id = ? OR ctbId = ?) AND deletedAt IS NULL',
    [ctbId, ctbId]
  );
  return rows[0] ? rowToCTB(rows[0]) : null;
}

export async function createCTB(ctb: CTB): Promise<void> {
  const db = await getDatabase();
  const id = ctb.id || `local-ctb-${Date.now()}`;
  const packedVolume = ctb.packedVolume ?? getPackedVolumeForSize(ctb.size);
  const unpackedVolume = ctb.unpackedVolume ?? getUnpackedVolumeForSize(ctb.size);
  const nestingDepth = ctb.nestingDepth ?? 0;

  await db.runAsync(
    `INSERT INTO ctbs (id, ctbId, rfidTagType, rfidTagId, rfidBatteryLife, size, stackId, position, layer, locationPath, parentCTBId, mass, volume, packedVolume, unpackedVolume, nestingDepth, isWaste, loadedDate, notes, shipmentId, pendingSync, localOperation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      id,
      ctb.id,
      ctb.rfidTag.type,
      ctb.rfidTag.id,
      ctb.rfidTag.batteryLife ?? 365,
      ctb.size,
      ctb.location.stack,
      ctb.location.position,
      ctb.location.layer,
      ctb.location.path,
      ctb.parentCTB ?? null,
      ctb.mass,
      ctb.volume,
      packedVolume,
      unpackedVolume,
      nestingDepth,
      ctb.isWaste ? 1 : 0,
      ctb.loadedDate.toISOString(),
      ctb.notes ?? null,
      null,
      'create',
    ]
  );
  await queueChange('CTB', id, 'create', ctbToData(ctb));
}

export async function updateCTB(ctbId: string, updates: Partial<CTB>): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = [];
  const values: any[] = [];

  if (updates.location) {
    sets.push('stackId = ?', 'position = ?', 'layer = ?', 'locationPath = ?');
    values.push(updates.location.stack, updates.location.position, updates.location.layer, updates.location.path);
  }
  if (updates.mass !== undefined) {
    sets.push('mass = ?');
    values.push(updates.mass);
  }
  if (updates.isWaste !== undefined) {
    sets.push('isWaste = ?');
    values.push(updates.isWaste ? 1 : 0);
  }
  if (updates.notes !== undefined) {
    sets.push('notes = ?');
    values.push(updates.notes);
  }
  if (updates.rfidTag !== undefined) {
    sets.push('rfidTagType = ?', 'rfidTagId = ?');
    values.push(updates.rfidTag.type, updates.rfidTag.id);
  }
  if (updates.isOutside !== undefined) {
    sets.push('isOutside = ?');
    values.push(updates.isOutside ? 1 : 0);
  }
  if (updates.previousLocation !== undefined) {
    sets.push('previousLocation = ?');
    values.push(updates.previousLocation ? JSON.stringify(updates.previousLocation) : null);
  }
  if (updates.lastAccessedDate) {
    sets.push('lastAccessedDate = ?');
    values.push(updates.lastAccessedDate.toISOString());
  }
  if (updates.lastAccessedBy) {
    sets.push('lastAccessedBy = ?');
    values.push(updates.lastAccessedBy);
  }

  sets.push('pendingSync = 1', 'localOperation = ?');
  values.push('update');
  values.push(ctbId, ctbId);

  await db.runAsync(
    `UPDATE ctbs SET ${sets.join(', ')} WHERE (id = ? OR ctbId = ?)`,
    values
  );
  await queueChange('CTB', ctbId, 'update', updates);
}

export async function deleteCTB(ctbId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE ctbs SET deletedAt = ?, pendingSync = 1, localOperation = ? WHERE (id = ? OR ctbId = ?)',
    [new Date().toISOString(), 'delete', ctbId, ctbId]
  );
  await queueChange('CTB', ctbId, 'delete', { ctbId });
}

const CTB_VOLUME_SPECS: Record<CTBSize, { packed: number; unpacked: number }> = {
  0.5:  { packed: 0.014, unpacked: 0.012 },
  1.0:  { packed: 0.028, unpacked: 0.025 },
  2.0:  { packed: 0.057, unpacked: 0.051 },
  4.0:  { packed: 0.113, unpacked: 0.100 },
  6.0:  { packed: 0.170, unpacked: 0.150 },
  8.0:  { packed: 0.227, unpacked: 0.200 },
  10.0: { packed: 0.283, unpacked: 0.250 },
};

function getPackedVolumeForSize(size: CTBSize): number {
  return CTB_VOLUME_SPECS[size]?.packed ?? size * 0.028;
}

function getUnpackedVolumeForSize(size: CTBSize): number {
  return CTB_VOLUME_SPECS[size]?.unpacked ?? size * 0.025;
}

function rowToCTB(row: any): CTB {
  const size = row.size as CTBSize;
  return {
    id: row.ctbId,
    rfidTag: {
      type: row.rfidTagType || 'RFID',
      id: row.rfidTagId,
      assignedDate: new Date(),
      batteryLife: row.rfidBatteryLife,
    },
    size,
    location: {
      stack: row.stackId as StackId,
      position: row.position,
      layer: row.layer,
      path: row.locationPath,
    },
    parentCTB: row.parentCTBId,
    childCTBs: [],
    items: [],
    mass: row.mass,
    volume: row.volume,
    packedVolume: row.packedVolume ?? getPackedVolumeForSize(size),
    unpackedVolume: row.unpackedVolume ?? getUnpackedVolumeForSize(size),
    nestingDepth: row.nestingDepth ?? 0,
    isWaste: row.isWaste === 1,
    isOutside: row.isOutside === 1,
    previousLocation: row.previousLocation ? JSON.parse(row.previousLocation) : undefined,
    wasteVolumeMultiplier: row.wasteVolumeMultiplier,
    loadedDate: new Date(row.loadedDate),
    lastAccessedDate: row.lastAccessedDate ? new Date(row.lastAccessedDate) : undefined,
    lastAccessedBy: row.lastAccessedBy,
    notes: row.notes,
  };
}

function ctbToData(ctb: CTB): Record<string, any> {
  return {
    ctbId: ctb.id,
    rfidTagId: ctb.rfidTag.id,
    rfidTagType: ctb.rfidTag.type,
    rfidBatteryLife: ctb.rfidTag.batteryLife,
    size: ctb.size,
    stackId: ctb.location.stack,
    position: ctb.location.position,
    layer: ctb.location.layer,
    locationPath: ctb.location.path,
    mass: ctb.mass,
    volume: ctb.volume,
    packedVolume: ctb.packedVolume,
    unpackedVolume: ctb.unpackedVolume,
    nestingDepth: ctb.nestingDepth,
    isWaste: ctb.isWaste,
  };
}

export async function getAllItems(): Promise<InventoryItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM items WHERE deletedAt IS NULL ORDER BY loadedDate DESC'
  );

  const items = await Promise.all(rows.map(async (row) => {
    const historyRows = await db.getAllAsync<any>(
      'SELECT * FROM itemHistory WHERE itemId = ? ORDER BY timestamp DESC',
      [row.itemId]
    );
    return rowToItem(row, historyRows);
  }));

  return items;
}

export async function getItemById(itemId: string): Promise<InventoryItem | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM items WHERE (id = ? OR itemId = ?) AND deletedAt IS NULL',
    [itemId, itemId]
  );
  if (!rows[0]) return null;

  const historyRows = await db.getAllAsync<any>(
    'SELECT * FROM itemHistory WHERE itemId = ? ORDER BY timestamp DESC',
    [rows[0].itemId]
  );
  return rowToItem(rows[0], historyRows);
}

export async function getItemsByCTB(ctbId: string): Promise<InventoryItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM items WHERE ctbId = ? AND deletedAt IS NULL',
    [ctbId]
  );
  return Promise.all(rows.map(async (row) => {
    const historyRows = await db.getAllAsync<any>(
      'SELECT * FROM itemHistory WHERE itemId = ? ORDER BY timestamp DESC',
      [row.itemId]
    );
    return rowToItem(row, historyRows);
  }));
}

export async function createItem(item: InventoryItem): Promise<void> {
  const db = await getDatabase();
  const id = `local-item-${Date.now()}`;
  await db.runAsync(
    `INSERT INTO items (id, itemId, name, description, categoryName, status, ctbId, stackId, position, layer, locationPath, mass, volume, quantity, criticality, notes, loadedDate, foodData, pendingSync, localOperation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      id,
      item.id,
      item.name,
      item.description,
      item.category,
      item.status,
      item.ctbId,
      item.location.stack,
      item.location.position,
      item.location.layer,
      item.location.path,
      item.mass,
      item.volume,
      item.quantity,
      item.criticality,
      item.notes ?? null,
      item.loadedDate.toISOString(),
      item.foodData ? JSON.stringify(item.foodData) : null,
      'create',
    ]
  );

  if (item.history.length > 0) {
    for (const entry of item.history) {
      await createHistoryEntry(item.id, entry);
    }
  }

  await queueChange('InventoryItem', id, 'create', itemToData(item));
}

export async function updateItem(itemId: string, updates: Partial<InventoryItem>): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    sets.push('name = ?');
    values.push(updates.name);
  }
  if (updates.status !== undefined) {
    sets.push('status = ?');
    values.push(updates.status);
  }
  if (updates.location) {
    sets.push('stackId = ?', 'position = ?', 'layer = ?', 'locationPath = ?');
    values.push(updates.location.stack, updates.location.position, updates.location.layer, updates.location.path);
  }
  if (updates.ctbId !== undefined) {
    sets.push('ctbId = ?');
    values.push(updates.ctbId);
  }
  if (updates.quantity !== undefined) {
    sets.push('quantity = ?');
    values.push(updates.quantity);
  }
  if (updates.notes !== undefined) {
    sets.push('notes = ?');
    values.push(updates.notes);
  }
  if (updates.deliveredDate) {
    sets.push('deliveredDate = ?');
    values.push(updates.deliveredDate.toISOString());
  }
  if (updates.consumedDate) {
    sets.push('consumedDate = ?');
    values.push(updates.consumedDate.toISOString());
  }
  if (updates.mass !== undefined) {
    sets.push('mass = ?');
    values.push(updates.mass);
  }
  if (updates.volume !== undefined) {
    sets.push('volume = ?');
    values.push(updates.volume);
  }
  if (updates.criticality !== undefined) {
    sets.push('criticality = ?');
    values.push(updates.criticality);
  }
  if (updates.expiryDate !== undefined) {
    sets.push('expiryDate = ?');
    values.push(updates.expiryDate ? updates.expiryDate.toISOString() : null);
  }
  if (updates.description !== undefined) {
    sets.push('description = ?');
    values.push(updates.description);
  }
  if (updates.category !== undefined) {
    sets.push('category = ?');
    values.push(updates.category);
  }

  sets.push('pendingSync = 1', 'localOperation = ?');
  values.push('update');
  values.push(itemId, itemId);

  await db.runAsync(
    `UPDATE items SET ${sets.join(', ')} WHERE (id = ? OR itemId = ?)`,
    values
  );
  await queueChange('InventoryItem', itemId, 'update', updates);
}

export async function deleteItem(itemId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE items SET deletedAt = ?, pendingSync = 1, localOperation = ? WHERE (id = ? OR itemId = ?)',
    [new Date().toISOString(), 'delete', itemId, itemId]
  );
  await queueChange('InventoryItem', itemId, 'delete', { itemId });
}

export async function createHistoryEntry(itemId: string, entry: ItemHistoryEntry): Promise<void> {
  const db = await getDatabase();
  const id = `hist-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  await db.runAsync(
    `INSERT INTO itemHistory (id, itemId, timestamp, action, userId, fromStackId, fromPosition, fromLayer, fromPath, toStackId, toPosition, toLayer, toPath, notes, timeTaken, pendingSync)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      id,
      itemId,
      entry.timestamp.toISOString(),
      entry.action,
      entry.userId ?? null,
      entry.fromLocation?.stack ?? null,
      entry.fromLocation?.position ?? null,
      entry.fromLocation?.layer ?? null,
      entry.fromLocation?.path ?? null,
      entry.toLocation?.stack ?? null,
      entry.toLocation?.position ?? null,
      entry.toLocation?.layer ?? null,
      entry.toLocation?.path ?? null,
      entry.notes ?? null,
      entry.timeTaken ?? null,
    ]
  );
  await queueChange('ItemHistoryEntry', id, 'create', { itemId, ...entry });
}

function rowToItem(row: any, historyRows: any[]): InventoryItem {
  return {
    id: row.itemId,
    name: row.name,
    description: row.description || '',
    category: row.categoryName as ItemCategory,
    status: row.status as ItemStatus,
    rfidTag: row.rfidTagId ? {
      type: row.rfidTagType || 'barcode',
      id: row.rfidTagId,
      assignedDate: new Date(),
    } : undefined,
    barcode: row.barcode,
    ctbId: row.ctbId,
    location: {
      stack: row.stackId as StackId,
      position: row.position,
      layer: row.layer,
      path: row.locationPath,
    },
    mass: row.mass,
    volume: row.volume,
    quantity: row.quantity,
    foodData: row.foodData ? JSON.parse(row.foodData) : undefined,
    loadedDate: new Date(row.loadedDate),
    deliveredDate: row.deliveredDate ? new Date(row.deliveredDate) : undefined,
    consumedDate: row.consumedDate ? new Date(row.consumedDate) : undefined,
    expiryDate: row.expiryDate ? new Date(row.expiryDate) : undefined,
    manufacturer: row.manufacturer,
    partNumber: row.partNumber,
    serialNumber: row.serialNumber,
    criticality: row.criticality as 'critical' | 'high' | 'medium' | 'low',
    notes: row.notes,
    history: deduplicateHistory(historyRows.map(rowToHistoryEntry)),
  };
}

function deduplicateHistory(entries: ItemHistoryEntry[]): ItemHistoryEntry[] {
  const seen = new Set<string>();
  return entries.filter(entry => {
    const timeKey = Math.round(entry.timestamp.getTime() / 2000);
    const key = `${entry.action}-${timeKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rowToHistoryEntry(row: any): ItemHistoryEntry {
  return {
    timestamp: new Date(row.timestamp),
    action: row.action,
    userId: row.userId,
    fromLocation: row.fromStackId ? {
      stack: row.fromStackId,
      position: row.fromPosition,
      layer: row.fromLayer,
      path: row.fromPath,
    } : undefined,
    toLocation: row.toStackId ? {
      stack: row.toStackId,
      position: row.toPosition,
      layer: row.toLayer,
      path: row.toPath,
    } : undefined,
    notes: row.notes,
    timeTaken: row.timeTaken,
  };
}

function itemToData(item: InventoryItem): Record<string, any> {
  return {
    itemId: item.id,
    name: item.name,
    description: item.description,
    categoryName: item.category,
    status: item.status,
    ctbId: item.ctbId,
    stackId: item.location.stack,
    position: item.location.position,
    layer: item.location.layer,
    locationPath: item.location.path,
    mass: item.mass,
    volume: item.volume,
    quantity: item.quantity,
    criticality: item.criticality,
  };
}

export interface WasteItemRecord {
  itemId: string;
  ctbId: string;
  originalVolume: number;
  wasteVolume: number;
  disposalMethod: 'return-earth' | 'deep-space' | 'recycle';
  markedDate: Date;
  disposedDate?: Date;
}

export async function getAllWasteItems(): Promise<WasteItemRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM wasteItems ORDER BY markedDate DESC'
  );
  return rows.map((row: any) => ({
    itemId: row.itemId,
    ctbId: row.ctbId,
    originalVolume: row.originalVolume,
    wasteVolume: row.wasteVolume,
    disposalMethod: row.disposalMethod,
    markedDate: new Date(row.markedDate),
    disposedDate: row.disposedDate ? new Date(row.disposedDate) : undefined,
  }));
}

export async function createWasteItem(wasteItem: WasteItemRecord): Promise<void> {
  const db = await getDatabase();
  const id = `waste-${wasteItem.itemId}-${Date.now()}`;
  await db.runAsync(
    `INSERT INTO wasteItems (id, itemId, ctbId, originalVolume, wasteVolume, disposalMethod, markedDate, pendingSync, localOperation)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      id,
      wasteItem.itemId,
      wasteItem.ctbId,
      wasteItem.originalVolume,
      wasteItem.wasteVolume,
      wasteItem.disposalMethod,
      wasteItem.markedDate.toISOString(),
      'create',
    ]
  );
  await queueChange('WasteItem', id, 'create', { ...wasteItem, markedDate: wasteItem.markedDate.toISOString() });
}

export async function updateWasteItemDisposalMethod(
  itemId: string,
  method: 'return-earth' | 'deep-space' | 'recycle'
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE wasteItems SET disposalMethod = ?, pendingSync = 1, localOperation = ? WHERE itemId = ?',
    [method, 'update', itemId]
  );
  await queueChange('WasteItem', itemId, 'update', { disposalMethod: method });
}

export async function deleteWasteItem(itemId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM wasteItems WHERE itemId = ?', [itemId]);
  await queueChange('WasteItem', itemId, 'delete', { itemId });
}

export async function createShipment(shipment: Shipment): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO shipments (id, manifestId, destination, priority, notes, status, launchedAt, ctbIds, totalMass, itemCount, pendingSync, localOperation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      shipment.id,
      shipment.manifestId,
      shipment.destination,
      shipment.priority,
      shipment.notes ?? null,
      shipment.status,
      shipment.launchedAt ? shipment.launchedAt.toISOString() : null,
      JSON.stringify(shipment.ctbIds),
      shipment.totalMass,
      shipment.itemCount,
      'create',
    ]
  );
  await queueChange('Shipment', shipment.id, 'create', {
    ...shipment,
    launchedAt: shipment.launchedAt?.toISOString(),
    createdAt: shipment.createdAt.toISOString(),
  });
}

export async function getAllShipments(): Promise<Shipment[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM shipments WHERE deletedAt IS NULL ORDER BY launchedAt DESC'
  );
  return rows.map((row: any) => ({
    id: row.id,
    manifestId: row.manifestId,
    destination: row.destination,
    priority: row.priority,
    notes: row.notes,
    status: row.status,
    ctbIds: row.ctbIds ? JSON.parse(row.ctbIds) : [],
    totalMass: row.totalMass ?? 0,
    itemCount: row.itemCount ?? 0,
    createdAt: new Date(row.launchedAt || Date.now()),
    launchedAt: row.launchedAt ? new Date(row.launchedAt) : undefined,
    deliveredAt: row.deliveredAt ? new Date(row.deliveredAt) : undefined,
    receivedAt: row.receivedAt ? new Date(row.receivedAt) : undefined,
  }));
}

export async function getAllStacks(): Promise<StackConfiguration[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>('SELECT * FROM stacks ORDER BY stackId ASC');
  return rows.map((row) => ({
    stackId: row.stackId as StackId,
    positions: row.positions,
    maxLayers: row.maxLayers,
    allowedCTBSizes: JSON.parse(row.allowedCTBSizes) as CTBSize[],
    isFlexibleShape: row.isFlexibleShape === 1,
    totalVolume: row.totalVolume,
    currentUtilization: row.currentUtilization,
  }));
}

export async function getLastSyncVersion(): Promise<number> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ value: string }>(
    'SELECT value FROM syncMetadata WHERE key = ?',
    ['lastSyncVersion']
  );
  return parseInt(rows[0]?.value || '0', 10);
}

export async function setLastSyncVersion(version: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE syncMetadata SET value = ? WHERE key = ?',
    [String(version), 'lastSyncVersion']
  );
}

export async function getLastSyncTime(): Promise<Date | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ value: string | null }>(
    'SELECT value FROM syncMetadata WHERE key = ?',
    ['lastSyncTime']
  );
  return rows[0]?.value ? new Date(rows[0].value) : null;
}

export async function setLastSyncTime(time: Date): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE syncMetadata SET value = ? WHERE key = ?',
    [time.toISOString(), 'lastSyncTime']
  );
}

export async function getClientId(): Promise<string> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ value: string }>(
    'SELECT value FROM syncMetadata WHERE key = ?',
    ['clientId']
  );
  return rows[0]?.value || generateClientId();
}

export interface PendingChange {
  id: number;
  tableName: string;
  recordId: string;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, any>;
  createdAt: string;
}

export async function queueChange(
  tableName: string,
  recordId: string,
  operation: 'create' | 'update' | 'delete',
  data: Record<string, any>
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO pendingChanges (tableName, recordId, operation, data) VALUES (?, ?, ?, ?)',
    [tableName, recordId, operation, JSON.stringify(data)]
  );
}

export async function getPendingChanges(): Promise<PendingChange[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM pendingChanges ORDER BY id ASC'
  );
  return rows.map((row) => ({
    ...row,
    data: JSON.parse(row.data),
  }));
}

export async function getPendingChangesCount(): Promise<number> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM pendingChanges'
  );
  return rows[0]?.count || 0;
}

export async function clearPendingChanges(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  await db.runAsync(
    `DELETE FROM pendingChanges WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
}

export async function clearAllPendingChanges(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM pendingChanges');
}

export async function bulkImportData(data: {
  categories?: any[];
  stacks?: any[];
  ctbs?: any[];
  items?: any[];
  historyEntries?: any[];
  shipments?: any[];
}): Promise<void> {
  const db = await getDatabase();

  if (data.categories) {
    for (const cat of data.categories) {
      await db.runAsync(
        `INSERT OR REPLACE INTO categories (id, name, label, prefix, icon, isSystem, syncVersion, deletedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [cat.id, cat.name, cat.label, cat.prefix, cat.icon, cat.isSystem ? 1 : 0, cat.syncVersion, cat.deletedAt]
      );
    }
  }

  if (data.stacks) {
    for (const stack of data.stacks) {
      await db.runAsync(
        `INSERT OR REPLACE INTO stacks (id, stackId, positions, maxLayers, allowedCTBSizes, isFlexibleShape, totalVolume, syncVersion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [stack.id, stack.stackId, stack.positions, stack.maxLayers, stack.allowedCTBSizes, stack.isFlexibleShape ? 1 : 0, stack.totalVolume, stack.syncVersion]
      );
    }
  }

  if (data.ctbs) {
    for (const ctb of data.ctbs) {
      await db.runAsync(
        `INSERT OR REPLACE INTO ctbs (id, ctbId, rfidTagType, rfidTagId, rfidBatteryLife, size, stackId, position, layer, locationPath, parentCTBId, mass, volume, packedVolume, unpackedVolume, nestingDepth, isWaste, loadedDate, lastAccessedDate, lastAccessedBy, notes, shipmentId, syncVersion, deletedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ctb.id, ctb.ctbId, ctb.rfidTagType, ctb.rfidTagId, ctb.rfidBatteryLife, ctb.size, ctb.stackId, ctb.position, ctb.layer, ctb.locationPath, ctb.parentCTBId, ctb.mass, ctb.volume, ctb.packedVolume, ctb.unpackedVolume, ctb.nestingDepth ?? 0, ctb.isWaste ? 1 : 0, ctb.loadedDate, ctb.lastAccessedDate, ctb.lastAccessedBy, ctb.notes, ctb.shipmentId, ctb.syncVersion, ctb.deletedAt]
      );
    }
  }

  if (data.items) {
    for (const item of data.items) {
      await db.runAsync(
        `INSERT OR REPLACE INTO items (id, itemId, name, description, categoryName, status, ctbId, stackId, position, layer, locationPath, mass, volume, quantity, criticality, notes, loadedDate, deliveredDate, consumedDate, expiryDate, foodData, syncVersion, deletedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [item.id, item.itemId, item.name, item.description, item.categoryName, item.status, item.ctbId, item.stackId, item.position, item.layer, item.locationPath, item.mass, item.volume, item.quantity, item.criticality, item.notes, item.loadedDate, item.deliveredDate, item.consumedDate, item.expiryDate, item.foodData, item.syncVersion, item.deletedAt]
      );
    }
  }

  if (data.historyEntries) {
    for (const entry of data.historyEntries) {
      await db.runAsync(
        `INSERT OR REPLACE INTO itemHistory (id, itemId, timestamp, action, userId, fromStackId, fromPosition, fromLayer, fromPath, toStackId, toPosition, toLayer, toPath, notes, timeTaken, syncVersion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [entry.id, entry.itemId, entry.timestamp, entry.action, entry.userId, entry.fromStackId, entry.fromPosition, entry.fromLayer, entry.fromPath, entry.toStackId, entry.toPosition, entry.toLayer, entry.toPath, entry.notes, entry.timeTaken, entry.syncVersion]
      );
    }
  }

  if (data.shipments) {
    for (const s of data.shipments) {
      await db.runAsync(
        `INSERT OR REPLACE INTO shipments (id, manifestId, destination, priority, notes, status, launchedAt, deliveredAt, receivedAt, syncVersion, deletedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.id, s.manifestId, s.destination, s.priority, s.notes, s.status, s.launchedAt, s.deliveredAt, s.receivedAt, s.syncVersion, s.deletedAt]
      );
    }
  }
}

export interface CachedUser {
  id: string;
  username: string;
  name: string;
  role: string;
  currentLocation: string;
  passwordHash: string;
  lastLoginAt?: string;
}

export async function getCachedUser(username: string): Promise<CachedUser | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<CachedUser>(
    'SELECT * FROM users WHERE username = ?',
    [username.toLowerCase()]
  );
  return rows[0] || null;
}

export async function getAllCachedUsers(): Promise<CachedUser[]> {
  const db = await getDatabase();
  return db.getAllAsync<CachedUser>('SELECT * FROM users ORDER BY username ASC');
}

export async function saveCachedUser(user: Omit<CachedUser, 'lastLoginAt'>, passwordHash: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO users (id, username, name, role, currentLocation, passwordHash, lastLoginAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [user.id, user.username.toLowerCase(), user.name, user.role, user.currentLocation, passwordHash, new Date().toISOString()]
  );
}

export async function updateUserLastLogin(username: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE users SET lastLoginAt = ? WHERE username = ?',
    [new Date().toISOString(), username.toLowerCase()]
  );
}

export async function deleteCachedUser(username: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM users WHERE username = ?', [username.toLowerCase()]);
}

export async function clearAllCachedUsers(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM users');
}

export function hashPassword(password: string): string {
  let hash = 0;
  const str = password + 'dslm-offline-salt';
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const base = Math.abs(hash).toString(36);
  let hash2 = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(str.length - 1 - i);
    hash2 = ((hash2 << 7) - hash2) + char;
    hash2 = hash2 & hash2;
  }
  return base + Math.abs(hash2).toString(36);
}

export function verifyPassword(password: string, storedHash: string): boolean {
  return hashPassword(password) === storedHash;
}

export async function resetDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM pendingChanges;
    DELETE FROM itemHistory;
    DELETE FROM items;
    DELETE FROM ctbs;
    DELETE FROM shipments;
    UPDATE syncMetadata SET value = '0' WHERE key = 'lastSyncVersion';
    UPDATE syncMetadata SET value = NULL WHERE key = 'lastSyncTime';
  `);
}

export async function factoryReset(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM pendingChanges;
    DELETE FROM itemHistory;
    DELETE FROM items;
    DELETE FROM ctbs;
    DELETE FROM shipments;
    DELETE FROM users;
    DELETE FROM categories WHERE isSystem = 0;
    UPDATE syncMetadata SET value = '0' WHERE key = 'lastSyncVersion';
    UPDATE syncMetadata SET value = NULL WHERE key = 'lastSyncTime';
  `);
}
