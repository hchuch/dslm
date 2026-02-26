# DSLM Code Agent Context

Use this file to provide context to AI coding assistants working on this project.

## Project Overview

**Name:** DSLM (Deep Space Logistics Management)  
**Type:** React Native / Expo mobile application  
**Purpose:** Inventory management system for space missions (Gateway lunar station)

## Tech Stack

- **Framework:** Expo (React Native)
- **Language:** TypeScript
- **Navigation:** Expo Router (file-based routing)
- **Styling:** React Native StyleSheet with custom theme
- **State Management:** React Context + custom hooks

## Project Structure

```
/app                    # Expo Router pages
  /_layout.tsx          # Root layout
  /index.tsx            # Entry/splash screen
  /login.tsx            # Authentication screen
  /(tabs)/              # Tab-based navigation
    /_layout.tsx        # Tab navigator config
    /index.tsx          # Home/Dashboard screen
    /incoming.tsx       # Incoming shipments
    /delivered.tsx      # Delivered items
    /shipment.tsx       # Shipment management
    /module.tsx         # Module visualization
    /logs.tsx           # Activity logs

/components             # Reusable UI components
  /ui/                  # Base UI components
  /storage/             # Storage visualization components
  *.tsx                 # Feature components (modals, viewers, etc.)

/hooks                  # Custom React hooks
  /use-inventory.tsx    # Main inventory state & actions
  /use-nfc.ts           # NFC scanning functionality
  /use-color-scheme.ts  # Theme detection

/contexts               # React Context providers
  /auth-context.tsx     # Authentication state

/constants              # App constants
  /colors.ts            # Color palette
  /theme.ts             # Theme configuration

/types                  # TypeScript type definitions
  /dslm.ts              # Domain types (CTB, InventoryItem, etc.)

/server                 # Backend server (separate package)
  /src/                 # Server source code

/ios                    # iOS native code
/android                # Android native code
```

## Key Domain Concepts

### CTB (Cargo Transfer Bag)

- Container for storing items
- Has properties: `id`, `size`, `location`, `volume`, `items[]`, `childCTBs[]`
- Sizes: 0.5, 1.0, 2.0, 4.0, 6.0, 8.0, 10.0
- Can be nested (parent/child relationships)

### InventoryItem

- Individual tracked item
- Properties: `id`, `name`, `ctbId`, `location`, `volume`, `mass`, `status`, `criticality`
- Statuses: `incoming`, `stock`, `delivered`, `consumed`
- Criticality levels: `critical`, `high`, `medium`, `low`

### Location

- Represents physical position
- Properties: `stack`, `position`, `layer`, `path`
- Stacks: S1, S2, S3 (standard), C1, C2 (curved), INCOMING

## Key Files to Understand

| File                                 | Purpose                                             |
| ------------------------------------ | --------------------------------------------------- |
| `hooks/use-inventory.tsx`            | Central inventory state, CRUD operations, mock data |
| `components/ctb-viewer.tsx`          | Modal for viewing/managing CTB contents             |
| `components/relocate-item-modal.tsx` | Modal for moving items between CTBs                 |
| `types/dslm.ts`                      | All TypeScript interfaces                           |
| `constants/colors.ts`                | Color constants (dark theme)                        |

## Coding Conventions

### Imports

```typescript
// External packages first
import { Ionicons } from "@expo/vector-icons";
import React, { useState, useMemo } from "react";
import { View, Pressable, StyleSheet } from "react-native";

// Internal imports with relative paths
import { Colors } from "../constants/colors";
import { useInventory } from "../hooks/use-inventory";
import type { CTB, InventoryItem } from "../types/dslm";
```

### Component Structure

```typescript
type Props = {
  visible: boolean;
  item: InventoryItem | null;
  onClose: () => void;
};

export function ComponentName({ visible, item, onClose }: Props) {
  // Hooks
  const { someAction } = useInventory();
  const [state, setState] = useState<Type>(initial);

  // Computed values with useMemo
  const computed = useMemo(() => { ... }, [deps]);

  // Event handlers
  const handleSomething = () => { ... };

  // Render
  return (
    <ThemedView style={styles.container}>
      ...
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { ... },
});
```

### Naming Conventions

- Components: PascalCase (`CTBViewer`, `RelocateItemModal`)
- Files: kebab-case (`ctb-viewer.tsx`, `relocate-item-modal.tsx`)
- Hooks: camelCase with `use` prefix (`useInventory`, `useNFC`)
- Types: PascalCase (`InventoryItem`, `CTB`, `Location`)
- Constants: PascalCase for objects, UPPER_SNAKE for primitives

### Styling

- Use `StyleSheet.create()` at bottom of file
- Reference `Colors` constant for all colors
- Common patterns:
  - `container`, `header`, `content`, `footer` for layout
  - `*Card`, `*Row`, `*Button` for interactive elements
  - `*Text`, `*Title`, `*Label` for typography

## Color Palette (Dark Theme)

```typescript
Colors = {
  background: "#000000",
  surface: "#1C1C1E",
  surfaceElevated: "#2C2C2E",
  border: "#38383A",

  textPrimary: "#FFFFFF",
  textSecondary: "#8E8E93",
  textTertiary: "#636366",

  blue: "#0A84FF",
  blueGlow: "rgba(10, 132, 255, 0.15)",
  green: "#30D158",
  red: "#FF453A",
  orange: "#FF9F0A",
  yellow: "#FFD60A",
};
```

## Common Patterns

### Modal Pattern

```typescript
<Modal
  visible={visible}
  animationType="slide"
  presentationStyle="pageSheet"
  onRequestClose={onClose}
>
  <ThemedView style={styles.container}>
    {/* Header with Cancel/Done */}
    <View style={styles.header}>
      <Pressable onPress={onClose}>
        <ThemedText style={styles.cancelText}>Cancel</ThemedText>
      </Pressable>
      <ThemedText style={styles.headerTitle}>Title</ThemedText>
      <Pressable onPress={handleDone} disabled={!canSubmit}>
        <ThemedText style={styles.doneText}>Done</ThemedText>
      </Pressable>
    </View>

    <ScrollView style={styles.content}>
      {/* Content */}
    </ScrollView>
  </ThemedView>
</Modal>
```

### Inventory Hook Usage

```typescript
const {
  inventoryItems, // All items
  ctbs, // All CTBs
  moveItem, // Move item to new location/CTB
  getItemsInCTB, // Get items in a specific CTB
  findCTBById, // Find CTB by ID
  getCriticalItems, // Get critical priority items
} = useInventory();
```

## Important Functions

### moveItem

```typescript
moveItem(
  itemId: string,
  newLocation: Location,
  newCtbId?: string,      // Optional: relocate to different CTB
  userId?: string,
  timeTaken?: number
)
```

## Running the Project

```bash
# Install dependencies
npm install

# Start Expo dev server
npm start

# iOS
npm run ios

# Android
npm run android
```

## Notes for AI Assistants

1. **Always check current file contents** before editing - files may have been modified
2. **Use ThemedText/ThemedView** instead of plain Text/View for consistent theming
3. **Import types with `type` keyword** for type-only imports
4. **CTB volume = capacity** - the `volume` property on CTB represents how much it can hold
5. **Item volume** represents how much space an item takes up
6. **Check errors after edits** to catch TypeScript issues early
