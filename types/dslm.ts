// DSLM Supply Chain Inventory System Types
// Based on NASA's Deep Space Logistics Module requirements

// CTB (Cargo Transfer Bag) size types
export type CTBSize = 0.5 | 1.0 | 2.0 | 4.0 | 6.0 | 8.0 | 10.0;

// Maximum nesting depth for CTBs (0 = root, max 3 levels deep)
export const MAX_NESTING_DEPTH = 3;

// Volume specifications for each CTB size (m³)
// Per NASA specs: packed = external storage volume, unpacked = internal capacity
export const CTB_VOLUME_SPECS: Record<CTBSize, { packed: number; unpacked: number }> = {
  0.5:  { packed: 0.014, unpacked: 0.012 },
  1.0:  { packed: 0.028, unpacked: 0.025 },
  2.0:  { packed: 0.057, unpacked: 0.051 },
  4.0:  { packed: 0.113, unpacked: 0.100 },
  6.0:  { packed: 0.170, unpacked: 0.150 },
  8.0:  { packed: 0.227, unpacked: 0.200 },
  10.0: { packed: 0.283, unpacked: 0.250 },
};

// Stack identifiers in DSLM module
export type StackId = "S1" | "S2" | "S3" | "C1" | "C2" | "INCOMING";

// Item categories based on DSLM requirements
export type ItemCategory =
  | "food"
  | "water"
  | "clothing"
  | "hygiene"
  | "medical"
  | "scientific-equipment"
  | "spare-parts"
  | "lab-equipment"
  | "lunar-equipment"
  | "waste"
  | "misc";

// Item status throughout supply chain
export type ItemStatus =
  | "incoming" // En route to Gateway
  | "stock" // In DSLM storage
  | "delivered" // Delivered to Gateway/astronauts
  | "in-use" // Currently being used
  | "consumed" // Fully consumed
  | "waste" // Marked for waste return
  | "relocated"; // Moved to different location

// Meal types for food tracking (256 total as per requirements)
export type MealType =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "special"
  | "emergency";

// Location within DSLM module
export interface Location {
  stack: StackId; // Which stack (S1, S2, S3, C1, C2)
  position: number; // Position in stack (1-16)
  layer: number; // Layer depth (1-4)
  path: string; // Full path: e.g., "S1-P5-L2"
}

// RFID/Barcode tracking tag
export interface TrackingTag {
  type: "RFID" | "barcode" | "QR" | "visual";
  id: string; // Unique tag identifier
  assignedDate: Date;
  lastScanned?: Date;
  batteryLife?: number; // For RFID tags (days)
}

// Nutritional information for food items
export interface NutritionalInfo {
  calories: number;
  protein: number; // grams
  carbs: number; // grams
  fat: number; // grams
  fiber: number; // grams
  sodium: number; // mg
  sugar: number; // grams
}

// Food-specific data
export interface FoodData {
  mealType: MealType;
  mealNumber?: number; // Meal sequence number (1-256)
  expiryDate: Date;
  nutritionalInfo: NutritionalInfo;
  preparationInstructions?: string;
  allergens?: string[];
  temperature: "frozen" | "refrigerated" | "ambient";
}

// Cargo Transfer Bag (CTB) definition
export interface CTB {
  id: string;
  rfidTag: TrackingTag;
  size: CTBSize;
  location: Location;
  parentCTB?: string; // ID of parent CTB if nested
  childCTBs: string[]; // IDs of nested CTBs
  items: string[]; // IDs of items contained
  mass: number; // kg
  volume: number; // m³
  packedVolume: number; // External volume CTB occupies (m³)
  unpackedVolume: number; // Internal storage capacity (m³)
  nestingDepth: number; // 0 = root, max 3 levels
  isWaste: boolean; // Is this CTB marked as waste?
  isOutside?: boolean; // true when CTB is taken out of stack
  previousLocation?: Location; // saved location for restoring
  wasteVolumeMultiplier?: number; // 1.3-1.5x for used packaging
  loadedDate: Date;
  lastAccessedDate?: Date;
  lastAccessedBy?: string; // Astronaut ID
  notes?: string;
}

// Individual inventory item
export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  status: ItemStatus;
  rfidTag?: TrackingTag;
  barcode?: string;

  // Location & containment
  ctbId: string; // CTB containing this item
  location: Location;

  // Physical properties
  mass: number; // kg
  volume: number; // m³
  quantity: number;

  // Food-specific (if category is 'food')
  foodData?: FoodData;

  // Tracking
  loadedDate: Date;
  deliveredDate?: Date;
  consumedDate?: Date;
  expiryDate?: Date;

  // Metadata
  manufacturer?: string;
  partNumber?: string;
  serialNumber?: string;
  criticality: "critical" | "high" | "medium" | "low";
  notes?: string; // User-added notes

  // History
  history: ItemHistoryEntry[];

  // Nesting
  subItems?: InventoryItem[];
}

// History entry for item tracking
export interface ItemHistoryEntry {
  timestamp: Date;
  action:
    | "loaded"
    | "delivered"
    | "moved"
    | "consumed"
    | "inspected"
    | "relocated"
    | "marked-waste"
    | "nfc-assigned";
  userId?: string; // Astronaut or technician ID
  fromLocation?: Location;
  toLocation?: Location;
  notes?: string;
  timeTaken?: number; // seconds
}

// Nesting rules for CTBs (Russian nesting dolls)
export interface NestingRule {
  parentSize: CTBSize;
  allowedChildSizes: CTBSize[];
  maxChildren: number;
}

// DSLM module stack configuration
export interface StackConfiguration {
  stackId: StackId;
  positions: number; // 16 positions per stack
  maxLayers: number; // Up to 4 layers
  allowedCTBSizes: CTBSize[];
  isFlexibleShape: boolean; // True for C1/C2 (soft/irregular shapes)
  totalVolume: number; // m³
  currentUtilization: number; // percentage
}

// Astronaut/User for tracking actions
export interface User {
  id: string;
  username: string;
  name: string;
  role: "admin" | "astronaut" | "mission-specialist" | "ground-crew" | "loader";
  currentLocation: string;
}

// Mission tracking
export interface Mission {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  duration: number; // days (30-45 days typical)
  crew: User[];
  dslmLaunchDate?: Date;
  dslmDockDate?: Date;
  dslmUndockDate?: Date;
  status:
    | "planning"
    | "loading"
    | "launched"
    | "docked"
    | "active"
    | "completed";
}

// Database sync status (Gateway <-> Earth)
export interface SyncStatus {
  lastSyncTime: Date;
  nextSyncTime: Date;
  syncInterval: number; // seconds
  latency: number; // seconds (1.5s typical for Moon)
  pendingChanges: number;
  status: "synced" | "syncing" | "pending" | "error";
  conflicts: number;
}

// Search/Filter criteria for inventory
export interface SearchCriteria {
  query?: string;
  category?: ItemCategory;
  status?: ItemStatus;
  stack?: StackId;
  expiryBefore?: Date;
  criticality?: InventoryItem["criticality"];
  mealType?: MealType;
}

// Waste management tracking
export interface WasteItem {
  itemId: string;
  ctbId: string;
  originalVolume: number;
  wasteVolume: number; // 1.3-1.5x original
  disposalMethod: "return-earth" | "deep-space" | "recycle";
  markedDate: Date;
  disposedDate?: Date;
}

// Category definition (system + custom categories)
export interface Category {
  id: string;
  name: string; // e.g., "custom-tools" (unique identifier)
  label: string; // e.g., "Custom Tools" (display name)
  prefix: string; // e.g., "CTOOLS" for ID generation
  icon?: string; // Optional icon identifier
  isSystem: boolean; // true for built-in, false for custom
  isImportant: boolean; // Items in this category are flagged as important
}

// Shipment manifest
export interface Shipment {
  id: string;
  manifestId: string; // e.g., "MNF-2025-001"
  destination: string;
  priority: "Low" | "Normal" | "High";
  notes?: string;
  status: "draft" | "manifested" | "launched" | "in-transit" | "delivered" | "received";
  ctbIds: string[]; // CTBs in this shipment
  totalMass: number; // Total mass in kg
  itemCount: number; // Total number of items
  createdAt: Date;
  launchedAt?: Date;
  deliveredAt?: Date;
  receivedAt?: Date;
}

// Sync-related types
export interface PendingChange {
  id: number;
  tableName: string;
  recordId: string;
  operation: "create" | "update" | "delete";
  data: Record<string, unknown>;
  createdAt: string;
}

export interface SyncResult {
  success: boolean;
  syncedChanges: number;
  pulledChanges: number;
  currentVersion: number;
  errors: string[];
}
