// DSLM Supply Chain Inventory System Types
// Based on NASA's Deep Space Logistics Module requirements

// CTB (Cargo Transfer Bag) size types
export type CTBSize = 0.5 | 1.0 | 2.0 | 4.0 | 6.0 | 8.0 | 10.0;

// Stack identifiers in DSLM module
export type StackId = 'S1' | 'S2' | 'S3' | 'C1' | 'C2';

// Item categories based on DSLM requirements
export type ItemCategory =
  | 'food'
  | 'water'
  | 'clothing'
  | 'hygiene'
  | 'medical'
  | 'scientific-equipment'
  | 'spare-parts'
  | 'lab-equipment'
  | 'lunar-equipment'
  | 'waste'
  | 'misc';

// Item status throughout supply chain
export type ItemStatus =
  | 'incoming' // En route to Gateway
  | 'stock' // In DSLM storage
  | 'delivered' // Delivered to Gateway/astronauts
  | 'in-use' // Currently being used
  | 'consumed' // Fully consumed
  | 'waste' // Marked for waste return
  | 'relocated'; // Moved to different location

// Meal types for food tracking (256 total as per requirements)
export type MealType =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'snack'
  | 'special'
  | 'emergency';

// Location within DSLM module
export interface Location {
  stack: StackId; // Which stack (S1, S2, S3, C1, C2)
  position: number; // Position in stack (1-16)
  layer: number; // Layer depth (1-4)
  path: string; // Full path: e.g., "S1-P5-L2"
}

// RFID/Barcode tracking tag
export interface TrackingTag {
  type: 'RFID' | 'barcode' | 'QR' | 'visual';
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
  temperature: 'frozen' | 'refrigerated' | 'ambient';
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
  isWaste: boolean; // Is this CTB marked as waste?
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
  criticality: 'critical' | 'high' | 'medium' | 'low';

  // History
  history: ItemHistoryEntry[];
}

// History entry for item tracking
export interface ItemHistoryEntry {
  timestamp: Date;
  action:
    | 'loaded'
    | 'delivered'
    | 'moved'
    | 'consumed'
    | 'inspected'
    | 'relocated'
    | 'marked-waste';
  userId?: string; // Astronaut or technician ID
  fromLocation?: Location;
  toLocation?: Location;
  notes?: string;
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
  name: string;
  role: 'astronaut' | 'mission-specialist' | 'ground-crew' | 'loader';
  currentLocation: 'Gateway' | 'Earth' | 'Lunar-Surface' | 'DSLM';
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
  status: 'planning' | 'loading' | 'launched' | 'docked' | 'active' | 'completed';
}

// Database sync status (Gateway <-> Earth)
export interface SyncStatus {
  lastSyncTime: Date;
  nextSyncTime: Date;
  syncInterval: number; // seconds
  latency: number; // seconds (1.5s typical for Moon)
  pendingChanges: number;
  status: 'synced' | 'syncing' | 'pending' | 'error';
  conflicts: number;
}

// Search/Filter criteria for inventory
export interface SearchCriteria {
  query?: string;
  category?: ItemCategory;
  status?: ItemStatus;
  stack?: StackId;
  expiryBefore?: Date;
  criticality?: InventoryItem['criticality'];
  mealType?: MealType;
}

// Waste management tracking
export interface WasteItem {
  itemId: string;
  ctbId: string;
  originalVolume: number;
  wasteVolume: number; // 1.3-1.5x original
  disposalMethod: 'return-earth' | 'deep-space' | 'recycle';
  markedDate: Date;
  disposedDate?: Date;
}
