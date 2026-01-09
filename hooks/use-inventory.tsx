import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type {
  CTB,
  CTBSize,
  InventoryItem,
  ItemCategory,
  ItemStatus,
  Location,
  NestingRule,
  SearchCriteria,
  StackConfiguration,
  StackId,
  WasteItem,
} from '../types/dslm';

// Legacy type for backward compatibility
export type Item = {
  id: string;
  name: string;
  qty: number;
  category: string;
  status: 'incoming' | 'stock';
};

type InventoryContextValue = {
  // Legacy API
  items: Item[];
  markDelivered: (id: string) => void;
  reload: () => void;

  // New DSLM API
  inventoryItems: InventoryItem[];
  ctbs: CTB[];
  stacks: StackConfiguration[];
  wasteItems: WasteItem[];

  // Search & filter
  searchItems: (criteria: SearchCriteria) => InventoryItem[];
  findItemById: (id: string) => InventoryItem | undefined;
  findCTBById: (id: string) => CTB | undefined;
  getItemsByLocation: (location: Partial<Location>) => InventoryItem[];
  getItemsByCategory: (category: ItemCategory) => InventoryItem[];
  getItemsByStatus: (status: ItemStatus) => InventoryItem[];

  // Actions
  addItem: (item: InventoryItem) => void;
  addCTB: (ctb: CTB) => void;
  addShipment: (ctbs: CTB[], items: InventoryItem[]) => void;
  deliverItem: (itemId: string, userId?: string, timeTaken?: number) => void;
  moveItem: (itemId: string, newLocation: Location, userId?: string, timeTaken?: number) => void;
  consumeItem: (itemId: string, userId?: string, timeTaken?: number) => void;
  markAsWaste: (itemId: string, userId?: string, timeTaken?: number) => void;
  relocateCTB: (ctbId: string, newLocation: Location, userId?: string, timeTaken?: number) => void;

  // CTB operations
  getChildCTBs: (parentCTBId: string) => CTB[];
  getItemsInCTB: (ctbId: string) => InventoryItem[];
  getNestingPath: (ctbId: string) => string[];
  getIncomingCTBs: () => CTB[];
  receiveCTB: (ctbId: string, userId?: string) => void;

  // Analytics
  getStackUtilization: (stackId: StackId) => number;
  getExpiringItems: (daysAhead: number) => InventoryItem[];
  getCriticalItems: () => InventoryItem[];
  getWasteVolume: () => number;
  reorganizeStack: (stackId: StackId) => void;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

// Nesting rules for CTBs (per requirements)
const NESTING_RULES: NestingRule[] = [
  { parentSize: 1.0, allowedChildSizes: [0.5], maxChildren: 2 },
  { parentSize: 2.0, allowedChildSizes: [1.0, 0.5], maxChildren: 2 },
  { parentSize: 4.0, allowedChildSizes: [2.0, 1.0, 0.5], maxChildren: 2 },
  { parentSize: 6.0, allowedChildSizes: [4.0, 2.0, 1.0, 0.5], maxChildren: 2 },
  { parentSize: 8.0, allowedChildSizes: [6.0, 4.0, 2.0, 1.0, 0.5], maxChildren: 2 },
  { parentSize: 10.0, allowedChildSizes: [8.0, 6.0, 4.0, 2.0, 1.0, 0.5], maxChildren: 3 },
];

// Generate sample DSLM inventory data
const generateDSLMInventory = () => {
  const stacks: StackConfiguration[] = [
    { stackId: 'S1', positions: 16, maxLayers: 4, allowedCTBSizes: [0.5, 1.0, 2.0, 4.0, 6.0, 8.0, 10.0], isFlexibleShape: false, totalVolume: 12.0, currentUtilization: 0 },
    { stackId: 'S2', positions: 16, maxLayers: 4, allowedCTBSizes: [0.5, 1.0, 2.0, 4.0, 6.0, 8.0, 10.0], isFlexibleShape: false, totalVolume: 12.0, currentUtilization: 0 },
    { stackId: 'S3', positions: 16, maxLayers: 4, allowedCTBSizes: [0.5, 1.0, 2.0, 4.0, 6.0, 8.0, 10.0], isFlexibleShape: false, totalVolume: 12.0, currentUtilization: 0 },
    { stackId: 'C1', positions: 16, maxLayers: 4, allowedCTBSizes: [0.5, 1.0, 2.0, 4.0], isFlexibleShape: true, totalVolume: 8.0, currentUtilization: 0 },
    { stackId: 'C2', positions: 16, maxLayers: 4, allowedCTBSizes: [0.5, 1.0, 2.0, 4.0], isFlexibleShape: true, totalVolume: 8.0, currentUtilization: 0 },
  ];

  const ctbs: CTB[] = [];
  const items: InventoryItem[] = [];

  // Generate CTBs and items for food (meals)
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
  const stacks_for_food: StackId[] = ['S1', 'S2'];

  for (let i = 0; i < 20; i++) {
    const stackId = stacks_for_food[i % 2];
    const position = (i % 8) + 1;
    const layer = Math.floor(i / 8) + 1;

    const location: Location = {
      stack: stackId,
      position,
      layer,
      path: `${stackId}-P${position}-L${layer}`,
    };

    const ctbId = `CTB-FOOD-${String(i + 1).padStart(3, '0')}`;
    const ctb: CTB = {
      id: ctbId,
      rfidTag: {
        type: 'RFID',
        id: `RFID-${ctbId}`,
        assignedDate: new Date(2025, 0, 1 + i),
        batteryLife: 365,
      },
      size: 0.5,
      location,
      childCTBs: [],
      items: [],
      mass: 2.0,
      volume: 0.05,
      isWaste: false,
      loadedDate: new Date(2025, 0, 1 + i),
    };

    // Add 4 meals per CTB
    for (let m = 0; m < 4; m++) {
      const itemId = `MEAL-${String(i * 4 + m + 1).padStart(4, '0')}`;
      const mealType = mealTypes[m % 4];
      const expiryDate = new Date(2025, 11, 31); // End of year

      const item: InventoryItem = {
        id: itemId,
        name: `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} Meal ${i * 4 + m + 1}`,
        description: `Prepared ${mealType} with nutritional balance`,
        category: 'food',
        status: i < 5 ? 'incoming' : 'stock',
        rfidTag: {
          type: 'barcode',
          id: `BC-${itemId}`,
          assignedDate: new Date(2025, 0, 1 + i),
        },
        ctbId,
        location,
        mass: 0.5,
        volume: 0.01,
        quantity: 1,
        foodData: {
          mealType,
          mealNumber: i * 4 + m + 1,
          expiryDate,
          nutritionalInfo: {
            calories: 500 + Math.floor(Math.random() * 300),
            protein: 20 + Math.floor(Math.random() * 30),
            carbs: 40 + Math.floor(Math.random() * 40),
            fat: 10 + Math.floor(Math.random() * 20),
            fiber: 5 + Math.floor(Math.random() * 10),
            sodium: 500 + Math.floor(Math.random() * 500),
            sugar: 5 + Math.floor(Math.random() * 15),
          },
          preparationInstructions: 'Heat in food warmer for 5 minutes',
          allergens: [],
          temperature: 'ambient',
        },
        expiryDate,
        loadedDate: new Date(2025, 0, 1 + i),
        criticality: 'critical',
        history: [
          {
            timestamp: new Date(2025, 0, 1 + i),
            action: 'loaded',
            notes: `Loaded at Kennedy Space Center - Day ${i + 1}`,
          },
        ],
      };

      items.push(item);
      ctb.items.push(itemId);
    }

    ctbs.push(ctb);
  }

  // Generate CTBs for scientific equipment
  const scienceStacks: StackId[] = ['S2', 'S3'];
  for (let i = 0; i < 6; i++) {
    const stackId = scienceStacks[i % 2];
    const position = 9 + (i % 4);
    const layer = Math.floor(i / 4) + 1;

    const location: Location = {
      stack: stackId,
      position,
      layer,
      path: `${stackId}-P${position}-L${layer}`,
    };

    const ctbId = `CTB-SCI-${String(i + 1).padStart(3, '0')}`;
    const size: CTBSize = i < 2 ? 8.0 : 4.0;

    const ctb: CTB = {
      id: ctbId,
      rfidTag: {
        type: 'RFID',
        id: `RFID-${ctbId}`,
        assignedDate: new Date(2025, 0, 15),
        batteryLife: 365,
      },
      size,
      location,
      childCTBs: [],
      items: [],
      mass: size * 1.5,
      volume: size * 0.2,
      isWaste: false,
      loadedDate: new Date(2025, 0, 15),
    };

    const itemId = `SCI-EQUIP-${String(i + 1).padStart(3, '0')}`;
    const item: InventoryItem = {
      id: itemId,
      name: `Scientific Equipment ${i + 1}`,
      description: `Lab analysis equipment for Gateway experiments`,
      category: 'scientific-equipment',
      status: 'stock',
      rfidTag: {
        type: 'RFID',
        id: `RFID-${itemId}`,
        assignedDate: new Date(2025, 0, 15),
        batteryLife: 365,
      },
      ctbId,
      location,
      mass: size * 1.2,
      volume: size * 0.15,
      quantity: 1,
      loadedDate: new Date(2025, 0, 15),
      criticality: 'medium',
      partNumber: `SCI-${1000 + i}`,
      history: [
        {
          timestamp: new Date(2025, 0, 15),
          action: 'loaded',
          notes: 'Loaded mid-month - Lab equipment',
        },
      ],
    };

    items.push(item);
    ctb.items.push(itemId);
    ctbs.push(ctb);
  }

  // Generate large lunar equipment CTBs
  for (let i = 0; i < 3; i++) {
    const location: Location = {
      stack: 'C1',
      position: i + 1,
      layer: 1,
      path: `C1-P${i + 1}-L1`,
    };

    const ctbId = `CTB-LUNAR-${String(i + 1).padStart(3, '0')}`;

    const ctb: CTB = {
      id: ctbId,
      rfidTag: {
        type: 'RFID',
        id: `RFID-${ctbId}`,
        assignedDate: new Date(2025, 0, 27),
        batteryLife: 365,
      },
      size: 10.0,
      location,
      childCTBs: [],
      items: [],
      mass: 25.0,
      volume: 2.5,
      isWaste: false,
      loadedDate: new Date(2025, 0, 27),
      notes: 'Heavy lunar equipment - Day 28 deployment',
    };

    const itemId = `LUNAR-${String(i + 1).padStart(3, '0')}`;
    const item: InventoryItem = {
      id: itemId,
      name: `Lunar Exploration Equipment ${i + 1}`,
      description: `Large equipment for lunar surface operations`,
      category: 'lunar-equipment',
      status: 'stock',
      rfidTag: {
        type: 'RFID',
        id: `RFID-${itemId}`,
        assignedDate: new Date(2025, 0, 27),
        batteryLife: 365,
      },
      ctbId,
      location,
      mass: 24.5,
      volume: 2.8,
      quantity: 1,
      loadedDate: new Date(2025, 0, 27),
      criticality: 'high',
      partNumber: `LUN-${5000 + i}`,
      history: [
        {
          timestamp: new Date(2025, 0, 27),
          action: 'loaded',
          notes: 'Loaded Day 27 - Lunar equipment for Day 28 mission',
        },
      ],
    };

    items.push(item);
    ctb.items.push(itemId);
    ctbs.push(ctb);
  }

  return { items, ctbs, stacks };
};

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [inventoryData, setInventoryData] = useState(() => generateDSLMInventory());
  const [wasteItems, setWasteItems] = useState<WasteItem[]>([]);

  // Legacy items for backward compatibility
  const legacyItems = useMemo((): Item[] => {
    return inventoryData.items.map((item) => ({
      id: item.id,
      name: item.name,
      qty: item.quantity,
      category: item.category,
      status: item.status === 'incoming' ? 'incoming' : 'stock',
    }));
  }, [inventoryData.items]);

  // Search & filter functions
  const searchItems = useCallback(
    (criteria: SearchCriteria): InventoryItem[] => {
      return inventoryData.items.filter((item) => {
        if (criteria.query && !item.name.toLowerCase().includes(criteria.query.toLowerCase())) {
          return false;
        }
        if (criteria.category && item.category !== criteria.category) return false;
        if (criteria.status && item.status !== criteria.status) return false;
        if (criteria.stack && item.location.stack !== criteria.stack) return false;
        if (criteria.criticality && item.criticality !== criteria.criticality) return false;
        if (criteria.mealType && item.foodData?.mealType !== criteria.mealType) return false;
        if (criteria.expiryBefore && item.expiryDate && item.expiryDate > criteria.expiryBefore) {
          return false;
        }
        return true;
      });
    },
    [inventoryData.items]
  );

  const findItemById = useCallback(
    (id: string) => inventoryData.items.find((item) => item.id === id),
    [inventoryData.items]
  );

  const findCTBById = useCallback(
    (id: string) => inventoryData.ctbs.find((ctb) => ctb.id === id),
    [inventoryData.ctbs]
  );

  const getItemsByLocation = useCallback(
    (location: Partial<Location>) => {
      return inventoryData.items.filter((item) => {
        if (location.stack && item.location.stack !== location.stack) return false;
        if (location.position && item.location.position !== location.position) return false;
        if (location.layer && item.location.layer !== location.layer) return false;
        return true;
      });
    },
    [inventoryData.items]
  );

  const getItemsByCategory = useCallback(
    (category: ItemCategory) => inventoryData.items.filter((item) => item.category === category),
    [inventoryData.items]
  );

  const getItemsByStatus = useCallback(
    (status: ItemStatus) => inventoryData.items.filter((item) => item.status === status),
    [inventoryData.items]
  );

  // Actions
  const addItem = useCallback((item: InventoryItem) => {
    console.log(`[Inventory] Adding item: ${item.name} (${item.id}) to ${item.ctbId}`);
    setInventoryData((prev) => ({
      ...prev,
      items: [item, ...prev.items],
    }));
  }, []);

  const addCTB = useCallback((ctb: CTB) => {
    console.log(`[Inventory] Adding CTB: ${ctb.id} (Size: ${ctb.size})`);
    setInventoryData((prev) => ({
      ...prev,
      ctbs: [ctb, ...prev.ctbs],
    }));
  }, []);

  const addShipment = useCallback((newCtbs: CTB[], newItems: InventoryItem[]) => {
    console.log(`[Inventory] Adding Shipment: ${newCtbs.length} CTBs, ${newItems.length} Items`);
    setInventoryData((prev) => ({
      ...prev,
      ctbs: [...newCtbs, ...prev.ctbs],
      items: [...newItems, ...prev.items],
    }));
  }, []);

  const deliverItem = useCallback((itemId: string, userId?: string, timeTaken?: number) => {
    console.log(`[Inventory] Delivering item: ${itemId}`);
    setInventoryData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId
          ? {
            ...item,
            status: 'stock',
            deliveredDate: new Date(),
            history: [
              ...item.history,
              {
                timestamp: new Date(),
                action: 'delivered',
                userId,
                notes: 'Item delivered to Gateway and moved to stock',
                timeTaken,
              },
            ],
          }
          : item
      ),
    }));
  }, []);

  const moveItem = useCallback((itemId: string, newLocation: Location, userId?: string, timeTaken?: number) => {
    console.log(`[Inventory] Moving item: ${itemId} to ${newLocation.path}`);
    setInventoryData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId
          ? {
            ...item,
            location: newLocation,
            history: [
              ...item.history,
              {
                timestamp: new Date(),
                action: 'moved',
                userId,
                fromLocation: item.location,
                toLocation: newLocation,
                notes: `Moved from ${item.location.path} to ${newLocation.path}`,
                timeTaken,
              },
            ],
          }
          : item
      ),
    }));
  }, []);

  const consumeItem = useCallback((itemId: string, userId?: string, timeTaken?: number) => {
    console.log(`[Inventory] Consuming item: ${itemId}`);
    setInventoryData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId
          ? {
            ...item,
            status: 'consumed',
            consumedDate: new Date(),
            history: [
              ...item.history,
              {
                timestamp: new Date(),
                action: 'consumed',
                userId,
                notes: 'Item consumed',
                timeTaken,
              },
            ],
          }
          : item
      ),
    }));
  }, []);

  const markAsWaste = useCallback((itemId: string, userId?: string, timeTaken?: number) => {
    console.log(`[Inventory] Marking item as waste: ${itemId}`);
    const item = inventoryData.items.find((i) => i.id === itemId);
    if (!item) return;

    const wasteItem: WasteItem = {
      itemId,
      ctbId: item.ctbId,
      originalVolume: item.volume,
      wasteVolume: item.volume * 1.4, // 1.3-1.5x multiplier
      disposalMethod: 'return-earth',
      markedDate: new Date(),
    };

    setWasteItems((prev) => [...prev, wasteItem]);

    setInventoryData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId
          ? {
            ...item,
            status: 'waste',
            history: [
              ...item.history,
              {
                timestamp: new Date(),
                action: 'marked-waste',
                userId,
                notes: 'Marked for waste disposal',
                timeTaken,
              },
            ],
          }
          : item
      ),
    }));
  }, [inventoryData.items]);

  const relocateCTB = useCallback((ctbId: string, newLocation: Location, userId?: string, timeTaken?: number) => {
    console.log(`[Inventory] Relocating CTB: ${ctbId} to ${newLocation.path}`);
    setInventoryData((prev) => ({
      ...prev,
      ctbs: prev.ctbs.map((ctb) =>
        ctb.id === ctbId
          ? {
            ...ctb,
            location: newLocation,
            lastAccessedDate: new Date(),
            lastAccessedBy: userId,
          }
          : ctb
      ),
      items: prev.items.map((item) =>
        item.ctbId === ctbId
          ? {
            ...item,
            location: newLocation,
            history: [
              ...item.history,
              {
                timestamp: new Date(),
                action: 'relocated',
                userId,
                fromLocation: item.location,
                toLocation: newLocation,
                notes: `CTB ${ctbId} relocated`,
                timeTaken,
              },
            ],
          }
          : item
      ),
    }));
  }, []);

  // CTB operations
  const getChildCTBs = useCallback(
    (parentCTBId: string): CTB[] => {
      const parentCTB = inventoryData.ctbs.find((ctb) => ctb.id === parentCTBId);
      if (!parentCTB) return [];
      return inventoryData.ctbs.filter((ctb) => parentCTB.childCTBs.includes(ctb.id));
    },
    [inventoryData.ctbs]
  );

  const getItemsInCTB = useCallback(
    (ctbId: string): InventoryItem[] => {
      return inventoryData.items.filter((item) => item.ctbId === ctbId);
    },
    [inventoryData.items]
  );

  const getNestingPath = useCallback(
    (ctbId: string): string[] => {
      const path: string[] = [ctbId];
      let currentCTB = inventoryData.ctbs.find((ctb) => ctb.id === ctbId);

      while (currentCTB?.parentCTB) {
        path.unshift(currentCTB.parentCTB);
        currentCTB = inventoryData.ctbs.find((ctb) => ctb.id === currentCTB!.parentCTB);
      }

      return path;
    },
    [inventoryData.ctbs]
  );

  const getIncomingCTBs = useCallback((): CTB[] => {
    // A CTB is incoming if it contains any items with status 'incoming'
    // We only want top-level incoming CTBs (those that don't have a parent that is also incoming)
    // For simplicity in this version, we'll just return all CTBs that have incoming items
    // and let the UI handle hierarchy if needed.
    // Actually, let's return top-level CTBs that have *any* incoming content (recursive check could be expensive,
    // so we'll check if the CTB itself has incoming items or if we can infer it).
    // Given the data structure, items have a `ctbId`.

    const incomingItemCTBIds = new Set(
      inventoryData.items
        .filter((item) => item.status === 'incoming')
        .map((item) => item.ctbId)
    );

    // Filter CTBs that are in the set
    return inventoryData.ctbs.filter((ctb) => incomingItemCTBIds.has(ctb.id));
  }, [inventoryData.items, inventoryData.ctbs]);

  const receiveCTB = useCallback((ctbId: string, userId?: string) => {
    console.log(`[Inventory] Receiving CTB: ${ctbId}`);
    // Recursively find all items in this CTB and its children
    const findAllItemsInCTB = (currentCtbId: string): string[] => {
      const directItems = inventoryData.items
        .filter((item) => item.ctbId === currentCtbId)
        .map((item) => item.id);

      const currentCtb = inventoryData.ctbs.find((c) => c.id === currentCtbId);
      const childCtbIds = currentCtb?.childCTBs || [];

      const childItems = childCtbIds.flatMap(findAllItemsInCTB);
      return [...directItems, ...childItems];
    };

    const allItemIds = findAllItemsInCTB(ctbId);
    console.log(`[Inventory] Found ${allItemIds.length} items in CTB ${ctbId} to receive`);

    setInventoryData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        allItemIds.includes(item.id) && item.status === 'incoming'
          ? {
            ...item,
            status: 'stock',
            deliveredDate: new Date(),
            history: [
              ...item.history,
              {
                timestamp: new Date(),
                action: 'delivered',
                userId,
                notes: `CTB ${ctbId} received at Gateway`,
              },
            ],
          }
          : item
      ),
    }));
  }, [inventoryData.items, inventoryData.ctbs]);

  // Analytics
  const getStackUtilization = useCallback(
    (stackId: StackId): number => {
      const stack = inventoryData.stacks.find((s) => s.stackId === stackId);
      if (!stack) return 0;

      const ctbsInStack = inventoryData.ctbs.filter((ctb) => ctb.location.stack === stackId);
      const usedVolume = ctbsInStack.reduce((sum, ctb) => sum + ctb.volume, 0);

      return (usedVolume / stack.totalVolume) * 100;
    },
    [inventoryData.ctbs, inventoryData.stacks]
  );

  const getExpiringItems = useCallback(
    (daysAhead: number): InventoryItem[] => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysAhead);

      return inventoryData.items.filter(
        (item) => item.expiryDate && item.expiryDate <= targetDate && item.status !== 'consumed'
      );
    },
    [inventoryData.items]
  );

  const getCriticalItems = useCallback(
    () => inventoryData.items.filter((item) => item.criticality === 'critical'),
    [inventoryData.items]
  );

  const getWasteVolume = useCallback(
    () => wasteItems.reduce((sum, waste) => sum + waste.wasteVolume, 0),
    [wasteItems]
  );

  // Legacy API
  const markDelivered = useCallback((id: string) => deliverItem(id), [deliverItem]);

  const reload = useCallback(() => {
    setInventoryData(generateDSLMInventory());
    setWasteItems([]);
  }, []);

  const value = useMemo(
    () => ({
      // Legacy
      items: legacyItems,
      markDelivered,
      reload,

      // New DSLM API
      inventoryItems: inventoryData.items,
      ctbs: inventoryData.ctbs,
      stacks: inventoryData.stacks,
      wasteItems,

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

      // CTB operations
      getChildCTBs,
      getItemsInCTB,
      getNestingPath,
      getIncomingCTBs,
      receiveCTB,

      // Analytics
      getStackUtilization,
      getExpiringItems,
      getCriticalItems,
      getWasteVolume,
    }),
    [
      legacyItems,
      markDelivered,
      reload,
      inventoryData,
      wasteItems,
      searchItems,
      findItemById,
      findCTBById,
      getItemsByLocation,
      getItemsByCategory,
      getItemsByStatus,
      addItem,
      deliverItem,
      moveItem,
      consumeItem,
      markAsWaste,
      relocateCTB,
      getChildCTBs,
      getItemsInCTB,
      getNestingPath,
      getIncomingCTBs,
      receiveCTB,
      getStackUtilization,
      getExpiringItems,
      getCriticalItems,
      getWasteVolume,
      reorganizeStack,
    ]
  );

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be used within InventoryProvider');
  return ctx;
}

export default useInventory;
