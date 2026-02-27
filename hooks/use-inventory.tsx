import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  CTB,
  CTBSize,
  InventoryItem,
  ItemCategory,
  ItemHistoryEntry,
  ItemStatus,
  Location,
  NestingRule,
  SearchCriteria,
  Shipment,
  StackConfiguration,
  StackId,
  TrackingTag,
  WasteItem,
  Category,
} from "../types/dslm";
import { MAX_NESTING_DEPTH, CTB_VOLUME_SPECS } from "../types/dslm";
import * as localDb from "../services/local-db";
import { pushIfOnline, addDataChangeListener } from "../services/sync-service";

// Legacy type for backward compatibility
export type Item = {
  id: string;
  name: string;
  qty: number;
  category: string;
  status: "incoming" | "stock";
};

type InventoryContextValue = {
  // Legacy API
  items: Item[];
  markDelivered: (id: string) => void;
  reload: () => Promise<void>;

  // Loading state
  isLoading: boolean;

  // New DSLM API
  inventoryItems: InventoryItem[];
  ctbs: CTB[];
  stacks: StackConfiguration[];
  wasteItems: WasteItem[];
  categories: Category[];
  shipments: Shipment[];

  // Search & filter
  searchItems: (criteria: SearchCriteria) => InventoryItem[];
  findItemById: (id: string) => InventoryItem | undefined;
  findCTBById: (id: string) => CTB | undefined;
  getItemsByLocation: (location: Partial<Location>) => InventoryItem[];
  getItemsByCategory: (category: ItemCategory) => InventoryItem[];
  getItemsByStatus: (status: ItemStatus) => InventoryItem[];

  // Actions
  addItem: (item: InventoryItem) => Promise<void>;
  addCTB: (ctb: CTB) => Promise<void>;
  addShipment: (ctbs: CTB[], items: InventoryItem[], metadata?: { destination?: string; priority?: string; notes?: string; manifestId?: string }) => Promise<void>;
  deliverItem: (itemId: string, userId?: string, timeTaken?: number) => Promise<void>;
  moveItem: (
    itemId: string,
    newLocation: Location,
    newCtbId?: string,
    userId?: string,
    timeTaken?: number,
  ) => Promise<void>;
  consumeItem: (itemId: string, userId?: string, timeTaken?: number) => Promise<void>;
  markAsWaste: (itemId: string, userId?: string, timeTaken?: number) => Promise<void>;
  relocateCTB: (
    ctbId: string,
    newLocation: Location,
    userId?: string,
    timeTaken?: number,
  ) => Promise<void>;
  updateItemNotes: (itemId: string, notes: string) => Promise<void>;
  updateCTBTag: (ctbId: string, rfidTag: TrackingTag) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  deleteCTB: (ctbId: string) => Promise<void>;

  // Category operations
  addCategory: (category: Omit<Category, 'id' | 'isSystem'>) => Promise<void>;

  // CTB operations
  getChildCTBs: (parentCTBId: string) => CTB[];
  getItemsInCTB: (ctbId: string) => InventoryItem[];
  getNestingPath: (ctbId: string) => string[];
  getIncomingCTBs: () => CTB[];
  receiveCTB: (ctbId: string, userId?: string) => Promise<void>;
  takeOutCTB: (ctbId: string, userId?: string) => Promise<void>;
  returnCTB: (ctbId: string, userId?: string) => Promise<void>;
  outsideCTBs: CTB[];

  // Analytics
  getStackUtilization: (stackId: StackId) => number;
  getExpiringItems: (daysAhead: number) => InventoryItem[];
  getImportantItems: () => InventoryItem[];
  getWasteVolume: () => number;
  updateWasteDisposalMethod: (itemId: string, method: "return-earth" | "deep-space" | "recycle") => void;
  reorganizeStack: (stackId: StackId, mode: "manual" | "auto") => void;
  updateStackLayout: (stackId: StackId, newCtbOrder: CTB[]) => void;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

// Nesting rules for CTBs (per requirements)
// Exported for use in other components
export const NESTING_RULES: NestingRule[] = [
  { parentSize: 0.5, allowedChildSizes: [], maxChildren: 0 },
  { parentSize: 1.0, allowedChildSizes: [0.5], maxChildren: 2 },
  { parentSize: 2.0, allowedChildSizes: [1.0, 0.5], maxChildren: 2 },
  { parentSize: 4.0, allowedChildSizes: [2.0, 1.0, 0.5], maxChildren: 2 },
  { parentSize: 6.0, allowedChildSizes: [4.0, 2.0, 1.0, 0.5], maxChildren: 2 },
  {
    parentSize: 8.0,
    allowedChildSizes: [6.0, 4.0, 2.0, 1.0, 0.5],
    maxChildren: 2,
  },
  {
    parentSize: 10.0,
    allowedChildSizes: [8.0, 6.0, 4.0, 2.0, 1.0, 0.5],
    maxChildren: 3,
  },
];

// Re-export MAX_NESTING_DEPTH for convenience
export { MAX_NESTING_DEPTH };

/**
 * Check if a child CTB can be nested inside a parent CTB
 * Returns { canNest: boolean, reason?: string }
 */
export function canNestCTB(
  childSize: CTBSize,
  parentCTB: CTB,
  existingChildCTBs: CTB[]
): { canNest: boolean; reason?: string } {
  // Find nesting rule for parent size
  const rule = NESTING_RULES.find(r => r.parentSize === parentCTB.size);
  if (!rule) {
    return { canNest: false, reason: `No nesting rules for size ${parentCTB.size}` };
  }

  // Check if child size is allowed
  if (!rule.allowedChildSizes.includes(childSize)) {
    return {
      canNest: false,
      reason: `Size ${childSize} cannot nest in ${parentCTB.size}. Allowed: ${rule.allowedChildSizes.join(', ') || 'none'}`,
    };
  }

  // Check max children limit
  const currentChildCount = existingChildCTBs.length;
  if (currentChildCount >= rule.maxChildren) {
    return {
      canNest: false,
      reason: `Parent already has ${currentChildCount} nested CTBs (max: ${rule.maxChildren})`,
    };
  }

  // Check nesting depth
  const childDepth = (parentCTB.nestingDepth ?? 0) + 1;
  if (childDepth > MAX_NESTING_DEPTH) {
    return {
      canNest: false,
      reason: `Nesting depth ${childDepth} exceeds maximum of ${MAX_NESTING_DEPTH}`,
    };
  }

  // Check volume constraints
  const parentUnpackedVolume = parentCTB.unpackedVolume ?? CTB_VOLUME_SPECS[parentCTB.size]?.unpacked ?? 0;
  const childPackedVolume = CTB_VOLUME_SPECS[childSize]?.packed ?? 0;

  // Calculate used volume
  let usedVolume = 0;
  for (const child of existingChildCTBs) {
    usedVolume += child.packedVolume ?? CTB_VOLUME_SPECS[child.size]?.packed ?? 0;
  }

  const availableVolume = parentUnpackedVolume - usedVolume;
  if (childPackedVolume > availableVolume) {
    return {
      canNest: false,
      reason: `Insufficient space: needs ${(childPackedVolume * 1000).toFixed(1)}L, only ${(availableVolume * 1000).toFixed(1)}L available`,
    };
  }

  return { canNest: true };
}

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [ctbs, setCTBs] = useState<CTB[]>([]);
  const [stacks, setStacks] = useState<StackConfiguration[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [wasteItems, setWasteItems] = useState<WasteItem[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from local database on mount
  useEffect(() => {
    loadFromDatabase();
  }, []);

  // Reload data when sync pulls new changes from server
  useEffect(() => {
    const unsubscribe = addDataChangeListener(() => {
      console.log('[Inventory] Sync data changed, reloading from database...');
      loadFromDatabase();
    });
    return unsubscribe;
  }, []);

  const loadFromDatabase = async () => {
    setIsLoading(true);
    try {
      const [dbItems, dbCTBs, dbStacks, dbCategories, dbWasteItems, dbShipments] = await Promise.all([
        localDb.getAllItems(),
        localDb.getAllCTBs(),
        localDb.getAllStacks(),
        localDb.getAllCategories(),
        localDb.getAllWasteItems(),
        localDb.getAllShipments(),
      ]);

      setInventoryItems(dbItems);
      setCTBs(dbCTBs);
      setStacks(dbStacks);
      setWasteItems(dbWasteItems);
      setShipments(dbShipments);
      setCategories(dbCategories.map(cat => ({
        ...cat,
        icon: cat.icon ?? undefined,
        isSystem: cat.isSystem,
        isImportant: cat.isImportant ?? false,
      })));

      // Populate CTB items arrays
      const ctbsWithItems = dbCTBs.map(ctb => ({
        ...ctb,
        items: dbItems.filter(item => item.ctbId === ctb.id).map(item => item.id),
      }));
      setCTBs(ctbsWithItems);
    } catch (error) {
      console.error('Failed to load from database:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Legacy items for backward compatibility
  const legacyItems = useMemo((): Item[] => {
    return inventoryItems.map((item) => ({
      id: item.id,
      name: item.name,
      qty: item.quantity,
      category: item.category,
      status: item.status === "incoming" ? "incoming" : "stock",
    }));
  }, [inventoryItems]);

  // Search & filter functions
  const searchItems = useCallback(
    (criteria: SearchCriteria): InventoryItem[] => {
      return inventoryItems.filter((item) => {
        if (
          criteria.query &&
          !item.name.toLowerCase().includes(criteria.query.toLowerCase())
        ) {
          return false;
        }
        if (criteria.category && item.category !== criteria.category)
          return false;
        if (criteria.status && item.status !== criteria.status) return false;
        if (criteria.stack && item.location.stack !== criteria.stack)
          return false;
        if (criteria.criticality && item.criticality !== criteria.criticality)
          return false;
        if (criteria.mealType && item.foodData?.mealType !== criteria.mealType)
          return false;
        if (
          criteria.expiryBefore &&
          item.expiryDate &&
          item.expiryDate > criteria.expiryBefore
        ) {
          return false;
        }
        return true;
      });
    },
    [inventoryItems],
  );

  const findItemById = useCallback(
    (id: string) => inventoryItems.find((item) => item.id === id),
    [inventoryItems],
  );

  const findCTBById = useCallback(
    (id: string) => ctbs.find((ctb) => ctb.id === id),
    [ctbs],
  );

  const getItemsByLocation = useCallback(
    (location: Partial<Location>) => {
      return inventoryItems.filter((item) => {
        if (location.stack && item.location.stack !== location.stack)
          return false;
        if (location.position && item.location.position !== location.position)
          return false;
        if (location.layer && item.location.layer !== location.layer)
          return false;
        return true;
      });
    },
    [inventoryItems],
  );

  const getItemsByCategory = useCallback(
    (category: ItemCategory) =>
      inventoryItems.filter((item) => item.category === category),
    [inventoryItems],
  );

  const getItemsByStatus = useCallback(
    (status: ItemStatus) =>
      inventoryItems.filter((item) => item.status === status),
    [inventoryItems],
  );

  // Actions
  const addItem = useCallback(async (item: InventoryItem) => {
    console.log(
      `[Inventory] Adding item: ${item.name} (${item.id}) to ${item.ctbId}`,
    );

    // Ensure item has at least a "loaded" history entry
    const hasLoadedEntry = item.history.some(h => h.action === 'loaded');
    const history = hasLoadedEntry ? item.history : [
      ...item.history,
      {
        timestamp: new Date(),
        action: 'loaded' as const,
        notes: `Item added to inventory`,
      },
    ];
    const itemWithHistory = { ...item, history };

    // Add to local database
    await localDb.createItem(itemWithHistory);

    // Update local state
    setInventoryItems((prev) => [itemWithHistory, ...prev]);

    // Trigger sync
    await pushIfOnline();
  }, []);

  const addCTB = useCallback(async (ctb: CTB) => {
    console.log(`[Inventory] Adding CTB: ${ctb.id} (Size: ${ctb.size})`);

    // Add to local database
    await localDb.createCTB(ctb);

    // Update local state
    setCTBs((prev) => [ctb, ...prev]);

    // Trigger sync
    await pushIfOnline();
  }, []);

  const addShipment = useCallback(
    async (newCtbs: CTB[], newItems: InventoryItem[], metadata?: { destination?: string; priority?: string; notes?: string; manifestId?: string }) => {
      console.log(
        `[Inventory] Adding Shipment: ${newCtbs.length} CTBs, ${newItems.length} Items`,
        metadata
      );

      // All items in a shipment start with INCOMING location until received
      const incomingLocation: Location = {
        stack: 'INCOMING',
        position: 0,
        layer: 1,
        path: 'INCOMING',
      };

      // Ensure all CTBs and items have INCOMING location
      const ctbsWithIncoming = newCtbs.map(ctb => ({
        ...ctb,
        location: incomingLocation,
      }));

      const itemsWithIncoming = newItems.map(item => {
        const hasLoadedEntry = item.history?.some(h => h.action === 'loaded');
        const loadedEntry = {
          timestamp: new Date(),
          action: 'loaded' as const,
          notes: `Loaded in shipment${metadata?.manifestId ? ` ${metadata.manifestId}` : ''}`,
        };
        return {
          ...item,
          location: incomingLocation,
          status: 'incoming' as ItemStatus,
          history: hasLoadedEntry ? item.history : [...(item.history || []), loadedEntry],
        };
      });

      // Add CTBs to local database
      for (const ctb of ctbsWithIncoming) {
        await localDb.createCTB(ctb);
      }

      // Add items to local database
      for (const item of itemsWithIncoming) {
        await localDb.createItem(item);
      }

      // Create shipment record if metadata provided
      if (metadata?.manifestId || metadata?.destination) {
        const shipmentRecord: Shipment = {
          id: `shipment-${Date.now()}`,
          manifestId: metadata.manifestId || `MNF-${Date.now()}`,
          destination: metadata.destination || 'Unknown',
          priority: (metadata.priority as Shipment['priority']) || 'Normal',
          notes: metadata.notes,
          status: 'launched',
          ctbIds: newCtbs.map(c => c.id),
          totalMass: newCtbs.reduce((sum, c) => sum + c.mass, 0),
          itemCount: newItems.length,
          createdAt: new Date(),
          launchedAt: new Date(),
        };

        await localDb.createShipment(shipmentRecord);
        setShipments((prev) => [shipmentRecord, ...prev]);
      }

      // Update local state
      setCTBs((prev) => [...ctbsWithIncoming, ...prev]);
      setInventoryItems((prev) => [...itemsWithIncoming, ...prev]);

      // Trigger sync
      await pushIfOnline();
    },
    [],
  );

  const deliverItem = useCallback(
    async (itemId: string, userId?: string, timeTaken?: number) => {
      console.log(`[Inventory] Delivering item: ${itemId}`);

      const historyEntry: ItemHistoryEntry = {
        timestamp: new Date(),
        action: "delivered",
        userId,
        notes: "Item delivered to Gateway and moved to stock",
        timeTaken,
      };

      // Update in local database
      await localDb.updateItem(itemId, {
        status: 'delivered',
        deliveredDate: new Date(),
      });
      await localDb.createHistoryEntry(itemId, historyEntry);

      // Update local state
      setInventoryItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                status: "delivered",
                deliveredDate: new Date(),
                history: [...item.history, historyEntry],
              }
            : item,
        ),
      );

      await pushIfOnline();
    },
    [],
  );

  const moveItem = useCallback(
    async (
      itemId: string,
      newLocation: Location,
      newCtbId?: string,
      userId?: string,
      timeTaken?: number,
    ) => {
      const item = inventoryItems.find(i => i.id === itemId);
      if (!item) return;

      console.log(
        `[Inventory] Moving item: ${itemId} to ${newLocation.path}${newCtbId ? ` (CTB: ${newCtbId})` : ""}`,
      );

      const historyEntry: ItemHistoryEntry = {
        timestamp: new Date(),
        action: "moved",
        userId,
        fromLocation: item.location,
        toLocation: newLocation,
        notes: newCtbId
          ? `Relocated from ${item.ctbId} to ${newCtbId} (${item.location.path} → ${newLocation.path})`
          : `Moved from ${item.location.path} to ${newLocation.path}`,
        timeTaken,
      };

      // Update in local database
      await localDb.updateItem(itemId, {
        location: newLocation,
        ctbId: newCtbId ?? item.ctbId,
      });
      await localDb.createHistoryEntry(itemId, historyEntry);

      // Update local state
      setInventoryItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                location: newLocation,
                ctbId: newCtbId ?? i.ctbId,
                history: [...i.history, historyEntry],
              }
            : i,
        ),
      );

      await pushIfOnline();
    },
    [inventoryItems],
  );

  const consumeItem = useCallback(
    async (itemId: string, userId?: string, timeTaken?: number) => {
      console.log(`[Inventory] Consuming item: ${itemId}`);

      const historyEntry: ItemHistoryEntry = {
        timestamp: new Date(),
        action: "consumed",
        userId,
        notes: "Item consumed",
        timeTaken,
      };

      await localDb.updateItem(itemId, {
        status: 'consumed',
        consumedDate: new Date(),
      });
      await localDb.createHistoryEntry(itemId, historyEntry);

      setInventoryItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                status: "consumed",
                consumedDate: new Date(),
                history: [...item.history, historyEntry],
              }
            : item,
        ),
      );

      await pushIfOnline();
    },
    [],
  );

  const markAsWaste = useCallback(
    async (itemId: string, userId?: string, timeTaken?: number) => {
      console.log(`[Inventory] Marking item as waste: ${itemId}`);
      const item = inventoryItems.find((i) => i.id === itemId);
      if (!item) return;

      const wasteItem: WasteItem = {
        itemId,
        ctbId: item.ctbId,
        originalVolume: item.volume,
        wasteVolume: item.volume * 1.4,
        disposalMethod: "return-earth",
        markedDate: new Date(),
      };

      // Persist waste item to database
      await localDb.createWasteItem(wasteItem);
      setWasteItems((prev) => [...prev, wasteItem]);

      const historyEntry: ItemHistoryEntry = {
        timestamp: new Date(),
        action: "marked-waste",
        userId,
        notes: `Marked for waste disposal (${(wasteItem.wasteVolume * 1000).toFixed(1)}L)`,
        timeTaken,
      };

      await localDb.updateItem(itemId, { status: 'waste' });
      await localDb.createHistoryEntry(itemId, historyEntry);

      setInventoryItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                status: "waste",
                history: [...i.history, historyEntry],
              }
            : i,
        ),
      );

      await pushIfOnline();
    },
    [inventoryItems],
  );

  const updateItemNotes = useCallback(async (itemId: string, notes: string) => {
    console.log(`[Inventory] Updating notes for item: ${itemId}`);

    await localDb.updateItem(itemId, { notes });

    setInventoryItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, notes } : item,
      ),
    );

    await pushIfOnline();
  }, []);

  const updateCTBTag = useCallback(async (ctbId: string, rfidTag: TrackingTag) => {
    console.log(`[Inventory] Updating NFC tag for CTB: ${ctbId}`);

    await localDb.updateCTB(ctbId, { rfidTag });

    setCTBs((prev) =>
      prev.map((ctb) =>
        ctb.id === ctbId ? { ...ctb, rfidTag } : ctb,
      ),
    );

    await pushIfOnline();
  }, []);

  const deleteItem = useCallback(async (itemId: string) => {
    console.log(`[Inventory] Deleting item: ${itemId}`);

    await localDb.deleteItem(itemId);

    setInventoryItems((prev) => prev.filter((item) => item.id !== itemId));
    setCTBs((prev) =>
      prev.map((ctb) =>
        ctb.items.includes(itemId)
          ? { ...ctb, items: ctb.items.filter((id) => id !== itemId) }
          : ctb,
      ),
    );

    await pushIfOnline();
  }, []);

  const deleteCTB = useCallback(
    async (ctbId: string) => {
      console.log(`[Inventory] Deleting CTB: ${ctbId}`);
      const itemsToDelete = inventoryItems
        .filter((item) => item.ctbId === ctbId)
        .map((item) => item.id);

      await localDb.deleteCTB(ctbId);
      for (const itemId of itemsToDelete) {
        await localDb.deleteItem(itemId);
      }

      setInventoryItems((prev) => prev.filter((item) => !itemsToDelete.includes(item.id)));
      setCTBs((prev) => prev.filter((ctb) => ctb.id !== ctbId));

      await pushIfOnline();
    },
    [inventoryItems],
  );

  const relocateCTB = useCallback(
    async (
      ctbId: string,
      newLocation: Location,
      userId?: string,
      timeTaken?: number,
    ) => {
      console.log(
        `[Inventory] Relocating CTB: ${ctbId} to ${newLocation.path}`,
      );

      await localDb.updateCTB(ctbId, {
        location: newLocation,
        lastAccessedDate: new Date(),
        lastAccessedBy: userId,
      });

      setCTBs((prev) =>
        prev.map((ctb) =>
          ctb.id === ctbId
            ? {
                ...ctb,
                location: newLocation,
                lastAccessedDate: new Date(),
                lastAccessedBy: userId,
              }
            : ctb,
        ),
      );

      // Update items in the CTB
      const itemsInCtb = inventoryItems.filter(item => item.ctbId === ctbId);
      for (const item of itemsInCtb) {
        const historyEntry: ItemHistoryEntry = {
          timestamp: new Date(),
          action: "relocated",
          userId,
          fromLocation: item.location,
          toLocation: newLocation,
          notes: `CTB ${ctbId} relocated`,
          timeTaken,
        };
        await localDb.updateItem(item.id, { location: newLocation });
        await localDb.createHistoryEntry(item.id, historyEntry);
      }

      setInventoryItems((prev) =>
        prev.map((item) =>
          item.ctbId === ctbId
            ? {
                ...item,
                location: newLocation,
                history: [
                  ...item.history,
                  {
                    timestamp: new Date(),
                    action: "relocated",
                    userId,
                    fromLocation: item.location,
                    toLocation: newLocation,
                    notes: `CTB ${ctbId} relocated`,
                    timeTaken,
                  },
                ],
              }
            : item,
        ),
      );

      await pushIfOnline();
    },
    [inventoryItems],
  );

  // Category operations
  const addCategory = useCallback(async (category: Omit<Category, 'id' | 'isSystem'>) => {
    const newCategory: Category = {
      id: `cat-${category.name}-${Date.now()}`,
      ...category,
      isSystem: false,
      isImportant: category.isImportant ?? false,
    };

    await localDb.createCategory({
      id: newCategory.id,
      name: newCategory.name,
      label: newCategory.label,
      prefix: newCategory.prefix,
      icon: newCategory.icon ?? null,
      isSystem: false,
      isImportant: newCategory.isImportant,
    });

    setCategories((prev) => [...prev, newCategory]);

    await pushIfOnline();
  }, []);

  // CTB operations
  const getChildCTBs = useCallback(
    (parentCTBId: string): CTB[] => {
      const parentCTB = ctbs.find((ctb) => ctb.id === parentCTBId);
      if (!parentCTB) return [];
      return ctbs.filter((ctb) => parentCTB.childCTBs.includes(ctb.id));
    },
    [ctbs],
  );

  const getItemsInCTB = useCallback(
    (ctbId: string): InventoryItem[] => {
      return inventoryItems.filter((item) => item.ctbId === ctbId);
    },
    [inventoryItems],
  );

  const getNestingPath = useCallback(
    (ctbId: string): string[] => {
      const path: string[] = [ctbId];
      let currentCTB = ctbs.find((ctb) => ctb.id === ctbId);

      while (currentCTB?.parentCTB) {
        path.unshift(currentCTB.parentCTB);
        currentCTB = ctbs.find((ctb) => ctb.id === currentCTB!.parentCTB);
      }

      return path;
    },
    [ctbs],
  );

  const getIncomingCTBs = useCallback((): CTB[] => {
    const incomingItemCTBIds = new Set(
      inventoryItems
        .filter((item) => item.status === "incoming")
        .map((item) => item.ctbId),
    );

    return ctbs.filter((ctb) => incomingItemCTBIds.has(ctb.id) || ctb.location.stack === 'INCOMING');
  }, [inventoryItems, ctbs]);

  const receiveCTB = useCallback(
    async (ctbId: string, userId?: string) => {
      console.log(`[Inventory] Receiving CTB: ${ctbId}`);

      // Find a free position in a stack for the CTB
      const findFreePosition = (): Location => {
        for (const stackId of ["S1", "S2", "S3"] as StackId[]) {
          const ctbsInStack = ctbs.filter((c) => c.location.stack === stackId);
          const occupiedPositions = new Set(ctbsInStack.map((c) => c.location.position));

          for (let pos = 1; pos <= 16; pos++) {
            if (!occupiedPositions.has(pos)) {
              return {
                stack: stackId,
                position: pos,
                layer: 1,
                path: `${stackId}-P${pos}-L1`,
              };
            }
          }
        }
        return { stack: "S1", position: 1, layer: 1, path: "S1-P1-L1" };
      };

      const newLocation = findFreePosition();

      // Find all items in this CTB
      const findAllItemsInCTB = (currentCtbId: string): string[] => {
        const directItems = inventoryItems
          .filter((item) => item.ctbId === currentCtbId)
          .map((item) => item.id);

        const currentCtb = ctbs.find((c) => c.id === currentCtbId);
        const childCtbIds = currentCtb?.childCTBs || [];

        const childItems = childCtbIds.flatMap(findAllItemsInCTB);
        return [...directItems, ...childItems];
      };

      const allItemIds = findAllItemsInCTB(ctbId);
      console.log(
        `[Inventory] Found ${allItemIds.length} items in CTB ${ctbId} to receive, assigning to ${newLocation.path}`,
      );

      // Update CTB
      await localDb.updateCTB(ctbId, {
        location: newLocation,
        lastAccessedDate: new Date(),
        lastAccessedBy: userId,
      });

      // Update items
      for (const itemId of allItemIds) {
        const historyEntry: ItemHistoryEntry = {
          timestamp: new Date(),
          action: "delivered",
          userId,
          toLocation: newLocation,
          notes: `CTB ${ctbId} received at Gateway, stored at ${newLocation.path}`,
        };
        await localDb.updateItem(itemId, {
          status: 'stock',
          location: newLocation,
          deliveredDate: new Date(),
        });
        await localDb.createHistoryEntry(itemId, historyEntry);
      }

      // Update local state
      setCTBs((prev) =>
        prev.map((ctb) =>
          ctb.id === ctbId
            ? {
                ...ctb,
                location: newLocation,
                lastAccessedDate: new Date(),
                lastAccessedBy: userId,
              }
            : ctb,
        ),
      );

      setInventoryItems((prev) =>
        prev.map((item) =>
          allItemIds.includes(item.id) && item.status === "incoming"
            ? {
                ...item,
                status: "stock",
                location: newLocation,
                deliveredDate: new Date(),
                history: [
                  ...item.history,
                  {
                    timestamp: new Date(),
                    action: "delivered",
                    userId,
                    toLocation: newLocation,
                    notes: `CTB ${ctbId} received at Gateway, stored at ${newLocation.path}`,
                  },
                ],
              }
            : item,
        ),
      );

      await pushIfOnline();
    },
    [inventoryItems, ctbs],
  );

  const takeOutCTB = useCallback(
    async (ctbId: string, userId?: string) => {
      const ctb = ctbs.find((c) => c.id === ctbId);
      if (!ctb) return;
      console.log(`[Inventory] Taking out CTB: ${ctbId}`);

      await localDb.updateCTB(ctbId, {
        isOutside: true,
        previousLocation: ctb.location,
        lastAccessedDate: new Date(),
        lastAccessedBy: userId,
      });

      setCTBs((prev) =>
        prev.map((c) =>
          c.id === ctbId
            ? { ...c, isOutside: true, previousLocation: c.location, lastAccessedDate: new Date(), lastAccessedBy: userId }
            : c,
        ),
      );

      await pushIfOnline();
    },
    [ctbs],
  );

  const returnCTB = useCallback(
    async (ctbId: string, userId?: string) => {
      const ctb = ctbs.find((c) => c.id === ctbId);
      if (!ctb || !ctb.previousLocation) return;
      console.log(`[Inventory] Returning CTB: ${ctbId} to ${ctb.previousLocation.path}`);

      const dest = ctb.previousLocation;

      await localDb.updateCTB(ctbId, {
        isOutside: false,
        previousLocation: undefined,
        location: dest,
        lastAccessedDate: new Date(),
        lastAccessedBy: userId,
      });

      setCTBs((prev) =>
        prev.map((c) =>
          c.id === ctbId
            ? { ...c, isOutside: false, previousLocation: undefined, location: dest, lastAccessedDate: new Date(), lastAccessedBy: userId }
            : c,
        ),
      );

      // Update items in CTB back to previous location
      const itemsInCtb = inventoryItems.filter((item) => item.ctbId === ctbId);
      for (const item of itemsInCtb) {
        await localDb.updateItem(item.id, { location: dest });
      }

      setInventoryItems((prev) =>
        prev.map((item) =>
          item.ctbId === ctbId ? { ...item, location: dest } : item,
        ),
      );

      await pushIfOnline();
    },
    [ctbs, inventoryItems],
  );

  const outsideCTBs = useMemo(() => ctbs.filter((c) => c.isOutside), [ctbs]);

  // Analytics
  const getStackUtilization = useCallback(
    (stackId: StackId): number => {
      const stack = stacks.find((s) => s.stackId === stackId);
      if (!stack) return 0;

      const ctbsInStack = ctbs.filter((ctb) => ctb.location.stack === stackId);
      const usedVolume = ctbsInStack.reduce((sum, ctb) => sum + ctb.volume, 0);

      return (usedVolume / stack.totalVolume) * 100;
    },
    [ctbs, stacks],
  );

  const getExpiringItems = useCallback(
    (daysAhead: number): InventoryItem[] => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysAhead);

      return inventoryItems.filter(
        (item) =>
          item.expiryDate &&
          item.expiryDate <= targetDate &&
          item.status !== "consumed",
      );
    },
    [inventoryItems],
  );

  // Get items that belong to categories marked as important
  const getImportantItems = useCallback(
    () => {
      const importantCategoryNames = new Set(
        categories.filter(cat => cat.isImportant).map(cat => cat.name)
      );
      return inventoryItems.filter((item) => importantCategoryNames.has(item.category));
    },
    [inventoryItems, categories],
  );

  const getWasteVolume = useCallback(
    () => wasteItems.reduce((sum, waste) => sum + waste.wasteVolume, 0),
    [wasteItems],
  );

  const updateWasteDisposalMethod = useCallback(
    async (itemId: string, method: "return-earth" | "deep-space" | "recycle") => {
      await localDb.updateWasteItemDisposalMethod(itemId, method);
      setWasteItems((prev) =>
        prev.map((w) => (w.itemId === itemId ? { ...w, disposalMethod: method } : w)),
      );
      await pushIfOnline();
    },
    [],
  );

  const reorganizeStack = useCallback(
    (stackId: StackId, mode: "manual" | "auto") => {
      console.log(`[Inventory] Reorganizing stack: ${stackId} (Mode: ${mode})`);
      if (mode === "auto") {
        setCTBs((prev) => {
          const stackCtbs = prev.filter((c) => c.location.stack === stackId);
          const sorted = [...stackCtbs].sort((a, b) => b.mass - a.mass);

          const specializedCtbs = prev.map((ctb) => {
            if (ctb.location.stack !== stackId) return ctb;
            const newIndex = sorted.findIndex((s) => s.id === ctb.id);
            return {
              ...ctb,
              location: { ...ctb.location, position: newIndex + 1 },
            };
          });
          return specializedCtbs;
        });
      }
    },
    [],
  );

  const updateStackLayout = useCallback(
    (stackId: StackId, newCtbOrder: CTB[]) => {
      console.log(`[Inventory] Updating layout for ${stackId}`);
      setCTBs((prev) => {
        const positionMap = new Map(
          newCtbOrder.map((ctb, index) => [ctb.id, index + 1]),
        );

        const updatedCtbs = prev.map((ctb) => {
          if (positionMap.has(ctb.id)) {
            return {
              ...ctb,
              location: { ...ctb.location, position: positionMap.get(ctb.id)! },
            };
          }
          return ctb;
        });

        return updatedCtbs;
      });
    },
    [],
  );

  // Legacy API
  const markDelivered = useCallback(
    (id: string) => deliverItem(id),
    [deliverItem],
  );

  const reload = useCallback(async () => {
    await loadFromDatabase();
  }, []);

  const value = useMemo(
    () => ({
      // Legacy
      items: legacyItems,
      markDelivered,
      reload,

      // Loading state
      isLoading,

      // New DSLM API
      inventoryItems,
      ctbs,
      stacks,
      wasteItems,
      categories,
      shipments,

      // Search & filter
      searchItems,
      findItemById,
      findCTBById,
      getItemsByLocation,
      getItemsByCategory,
      getItemsByStatus,

      // Actions
      addItem,
      addCTB,
      addShipment,
      deliverItem,
      moveItem,
      consumeItem,
      markAsWaste,
      relocateCTB,
      updateItemNotes,
      updateCTBTag,
      deleteItem,
      deleteCTB,

      // Category operations
      addCategory,

      // CTB operations
      getChildCTBs,
      getItemsInCTB,
      getNestingPath,
      getIncomingCTBs,
      receiveCTB,
      takeOutCTB,
      returnCTB,
      outsideCTBs,

      // Analytics
      getStackUtilization,
      getExpiringItems,
      getImportantItems,
      getWasteVolume,
      updateWasteDisposalMethod,
      reorganizeStack,
      updateStackLayout,
    }),
    [
      legacyItems,
      markDelivered,
      reload,
      isLoading,
      inventoryItems,
      ctbs,
      stacks,
      wasteItems,
      categories,
      shipments,
      searchItems,
      findItemById,
      findCTBById,
      getItemsByLocation,
      getItemsByCategory,
      getItemsByStatus,
      addItem,
      addCTB,
      addShipment,
      deliverItem,
      moveItem,
      consumeItem,
      markAsWaste,
      relocateCTB,
      updateItemNotes,
      updateCTBTag,
      deleteItem,
      deleteCTB,
      addCategory,
      getChildCTBs,
      getItemsInCTB,
      getNestingPath,
      getIncomingCTBs,
      receiveCTB,
      takeOutCTB,
      returnCTB,
      outsideCTBs,
      getStackUtilization,
      getExpiringItems,
      getImportantItems,
      getWasteVolume,
      updateWasteDisposalMethod,
      reorganizeStack,
      updateStackLayout,
    ],
  );

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx)
    throw new Error("useInventory must be used within InventoryProvider");
  return ctx;
}

export default useInventory;
