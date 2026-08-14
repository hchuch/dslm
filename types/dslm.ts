export type CTBSize = 0.5 | 1.0 | 2.0 | 4.0 | 6.0 | 8.0 | 10.0;

export const MAX_NESTING_DEPTH = 3;

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

export type StackId = "S1" | "S2" | "S3" | "C1" | "C2" | "INCOMING";

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

export type ItemStatus =
  | "incoming"    // En route to Gateway
  | "stock"       // In DSLM storage
  | "delivered"   // Delivered to Gateway/astronauts
  | "in-use"      // Currently being used
  | "consumed"    // Fully consumed
  | "waste"       // Marked for waste return
  | "relocated";  // Moved to different location

export type MealType =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "special"
  | "emergency";

export interface Location {
  stack: StackId;
  position: number;   // 1-16
  layer: number;       // 1-4
  path: string;        // e.g., "S1-P5-L2"
}

export interface TrackingTag {
  type: "RFID" | "barcode" | "QR" | "visual";
  id: string;
  assignedDate: Date;
  lastScanned?: Date;
  batteryLife?: number; // days, for RFID tags
}

export interface NutritionalInfo {
  calories: number;
  protein: number;  // grams
  carbs: number;    // grams
  fat: number;      // grams
  fiber: number;    // grams
  sodium: number;   // mg
  sugar: number;    // grams
}

export interface FoodData {
  mealType: MealType;
  mealNumber?: number; // 1-256
  expiryDate: Date;
  nutritionalInfo: NutritionalInfo;
  preparationInstructions?: string;
  allergens?: string[];
  temperature: "frozen" | "refrigerated" | "ambient";
}

export interface CTB {
  id: string;
  rfidTag: TrackingTag;
  size: CTBSize;
  location: Location;
  parentCTB?: string;
  childCTBs: string[];
  items: string[];
  mass: number;            // kg
  volume: number;          // m³
  packedVolume: number;    // m³, external volume CTB occupies
  unpackedVolume: number;  // m³, internal storage capacity
  nestingDepth: number;    // 0 = root, max 3 levels
  isWaste: boolean;
  isOutside?: boolean;
  previousLocation?: Location;
  wasteVolumeMultiplier?: number; // 1.3-1.5x for used packaging
  loadedDate: Date;
  lastAccessedDate?: Date;
  lastAccessedBy?: string;
  notes?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  status: ItemStatus;
  rfidTag?: TrackingTag;
  barcode?: string;

  ctbId: string;
  location: Location;

  mass: number;     // kg
  volume: number;   // m³
  quantity: number;

  foodData?: FoodData;

  loadedDate: Date;
  deliveredDate?: Date;
  consumedDate?: Date;
  expiryDate?: Date;

  manufacturer?: string;
  partNumber?: string;
  serialNumber?: string;
  criticality: "critical" | "high" | "medium" | "low";
  notes?: string;

  history: ItemHistoryEntry[];

  subItems?: InventoryItem[];
}

export type DiscrepancyType = "wrong-quantity" | "missing" | "damaged" | "wrong-item";

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
    | "nfc-assigned"
    | "edited"
    | "discrepancy";
  userId?: string;
  fromLocation?: Location;
  toLocation?: Location;
  notes?: string;
  timeTaken?: number; // seconds
}

export interface NestingRule {
  parentSize: CTBSize;
  allowedChildSizes: CTBSize[];
  maxChildren: number;
}

export interface StackConfiguration {
  stackId: StackId;
  positions: number;
  maxLayers: number;
  allowedCTBSizes: CTBSize[];
  isFlexibleShape: boolean; // true for C1/C2 (soft/irregular shapes)
  totalVolume: number;      // m³
  currentUtilization: number; // percentage
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: "admin" | "astronaut" | "mission-specialist" | "ground-crew" | "loader";
  currentLocation: string;
}

export interface Mission {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  duration: number; // days (30-45 typical)
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

export interface SyncStatus {
  lastSyncTime: Date;
  nextSyncTime: Date;
  syncInterval: number;   // seconds
  latency: number;         // seconds (1.5s typical for Moon)
  pendingChanges: number;
  status: "synced" | "syncing" | "pending" | "error";
  conflicts: number;
}

export interface SearchCriteria {
  query?: string;
  category?: ItemCategory;
  status?: ItemStatus;
  stack?: StackId;
  expiryBefore?: Date;
  criticality?: InventoryItem["criticality"];
  mealType?: MealType;
}

export interface WasteItem {
  itemId: string;
  ctbId: string;
  originalVolume: number;
  wasteVolume: number; // 1.3-1.5x original
  disposalMethod: "return-earth" | "deep-space" | "recycle";
  markedDate: Date;
  disposedDate?: Date;
}

export interface Category {
  id: string;
  name: string;
  label: string;
  prefix: string;
  icon?: string;
  isSystem: boolean;
  isImportant: boolean;
}

export interface Shipment {
  id: string;
  manifestId: string; // e.g., "MNF-2025-001"
  destination: string;
  priority: "Low" | "Normal" | "High";
  notes?: string;
  status: "draft" | "manifested" | "launched" | "in-transit" | "delivered" | "received";
  ctbIds: string[];
  totalMass: number;  // kg
  itemCount: number;
  createdAt: Date;
  launchedAt?: Date;
  deliveredAt?: Date;
  receivedAt?: Date;
}

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
