# DSLM Data Transfer & Sync Guide

## Architecture Overview

The DSLM (Deep Space Logistics Module) inventory system uses a **hub-and-spoke architecture** with offline-first capabilities:

```
                    ┌─────────────────────┐
                    │   NASA Ground       │
                    │   Server            │
                    │   (Source of Truth) │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼───────┐ ┌──────▼──────┐ ┌──────▼──────┐
     │ Ground Device  │ │  Gateway    │ │  Lunar      │
     │ (Loader)       │ │  Tablet     │ │  Surface    │
     │ [Earth]        │ │ [Space]     │ │  Device     │
     └────────────────┘ └─────────────┘ └─────────────┘
```

### Components

1. **NASA Ground Server** - Central Node.js + Prisma + SQLite server
   - Source of truth for all inventory data
   - Handles authentication and authorization
   - Manages sync versions and conflict resolution
   - Located on Earth with reliable connectivity

2. **Client Devices** - Expo React Native apps with local SQLite
   - Ground devices (loaders, ground crew) - Usually connected
   - Gateway devices (astronauts in orbit) - Intermittent connectivity
   - Lunar surface devices - Extended offline periods possible

## Data Flow

### Normal Operation (Online)

```
User Action → Local SQLite → Push to Server → Server confirms → Sync complete
```

1. User performs an action (add item, move CTB, etc.)
2. Change is written to local SQLite database immediately
3. Change is queued for sync
4. If online, change is pushed to server immediately
5. Server validates and stores change
6. Server increments sync version
7. Other devices pull changes during next sync

### Offline Operation

```
User Action → Local SQLite → Queue locally → [Offline period] → Push when online
```

1. User performs an action
2. Change is written to local SQLite database
3. Change is added to pending queue
4. UI shows "Pending" badge on modified items
5. When connection is restored:
   - Queued changes are pushed to server
   - Server changes are pulled
   - Conflicts are resolved (last-write-wins)

## Sync Protocol

### Polling Interval

- **Default**: Every 30 seconds when online
- **Push**: Instant when online and changes are made
- **Manual**: Users can force sync via UI

### Sync Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sync/version` | GET | Get current sync version |
| `/api/sync/changes?since={version}` | GET | Get changes since version |
| `/api/sync/full` | GET | Full data dump for initial sync |
| `/api/sync/push` | POST | Push local changes to server |
| `/api/sync/ack` | POST | Acknowledge sync version |

### Sync Version Tracking

Each change on the server increments a global `syncVersion`. Clients track their last synced version to request only new changes:

```
Client: "I last synced at version 42"
Server: "Here are changes from version 43 to 67"
Client: "Thanks, I'm now at version 67"
```

### Change Log Structure

```json
{
  "tableName": "InventoryItem",
  "recordId": "item-123",
  "operation": "update",
  "changeData": {
    "status": "delivered",
    "deliveredDate": "2025-01-15T10:30:00Z"
  },
  "syncVersion": 67
}
```

## Offline Behavior

### All Devices Support Offline Mode

While ground devices are less likely to be offline, the system fully supports offline operation for all device types:

| Device Type | Typical Connectivity | Offline Duration |
|-------------|---------------------|------------------|
| Ground (Earth) | Usually connected | Minutes (network issues) |
| Gateway (Orbit) | Intermittent | Hours (communication windows) |
| Lunar Surface | Periodic | Days (communication blackouts) |

### Offline Indicators

1. **Banner**: Red "Offline Mode" banner when disconnected
2. **Pending Badge**: Orange dot on items/CTBs with unsynced changes
3. **Pending Count**: Header shows "3 pending" for unsynced changes
4. **Last Sync Time**: Shows when connection was last successful

### Conflict Resolution

The system uses **last-write-wins** based on `updatedAt` timestamp:

1. Device A modifies item at 10:00 (offline)
2. Device B modifies same item at 10:05 (online)
3. Device A comes online at 10:10 and pushes
4. Server compares timestamps
5. Device A's change is rejected (B's was later)
6. Device A receives B's changes during pull

For critical operations, the UI should warn users about potential conflicts.

## Data Tables

### Categories
System and custom categories for inventory classification.

```
categories
├── id (UUID)
├── name (unique slug: "food", "custom-tools")
├── label (display: "Food", "Custom Tools")
├── prefix (ID generation: "FOOD", "CTOOLS")
├── icon (optional)
├── isSystem (true for built-in)
└── syncVersion
```

### Stacks
Storage locations in the DSLM module.

```
stacks
├── stackId (S1, S2, S3, C1, C2, INCOMING)
├── positions (16)
├── maxLayers (4)
├── allowedCTBSizes (JSON array)
└── totalVolume
```

### CTBs (Cargo Transfer Bags)
Containers that hold inventory items.

```
ctbs
├── ctbId (human-readable: "CTB-FOOD-001")
├── size (0.5 - 10.0 m³)
├── location (stack, position, layer)
├── items (related items)
├── shipmentId (if in transit)
└── syncVersion
```

### Inventory Items
Individual trackable items.

```
items
├── itemId (human-readable: "FOOD-001-ITEM-1")
├── name, description
├── category (FK to categories)
├── status (incoming, stock, delivered, consumed, waste)
├── ctbId (FK to CTB)
├── location (stack, position, layer)
├── history (related history entries)
└── syncVersion
```

### History Entries
Audit trail for item movements and status changes.

```
itemHistory
├── itemId (FK to item)
├── timestamp
├── action (loaded, delivered, moved, consumed, relocated, marked-waste)
├── fromLocation, toLocation
├── userId
└── notes
```

### Shipments
Manifest for cargo in transit.

```
shipments
├── manifestId ("MNF-2025-001")
├── destination
├── priority (Low, Normal, High)
├── status (draft, launched, in-transit, received)
├── ctbs (related CTBs)
└── syncVersion
```

## Export Format

When exporting shipment manifests, the following JSON structure is used:

```json
{
  "manifestId": "MNF-2025-001",
  "destination": "Lunar Gateway",
  "priority": "High",
  "status": "launched",
  "launchedAt": "2025-01-15T10:00:00Z",
  "ctbs": [
    {
      "ctbId": "CTB-FOOD-001",
      "size": 2.0,
      "mass": 15.5,
      "items": [
        {
          "itemId": "FOOD-001-ITEM-1",
          "name": "Emergency Ration Pack",
          "quantity": 10,
          "category": "food"
        }
      ]
    }
  ],
  "totalMass": 45.2,
  "totalVolume": 6.0
}
```

## Import Process

When receiving incoming data (e.g., from a shipment manifest):

1. **Validation**: Check required fields and data types
2. **Deduplication**: Check if items/CTBs already exist
3. **Assignment**: Assign INCOMING location to new items
4. **Merge**: Insert into local database
5. **Sync**: Push to server if online

### Validation Rules

- `ctbId` must be unique across system
- `itemId` must be unique across system
- `category` must exist (system or custom)
- `size` must be valid CTB size (0.5, 1.0, 2.0, 4.0, 6.0, 8.0, 10.0)

## Security Considerations

1. **Authentication**: JWT tokens with 7-day expiry
2. **Token Storage**: expo-secure-store for secure token storage
3. **Offline Cache**: User credentials cached for offline login
4. **Sync Authorization**: All sync endpoints require valid auth token

## Troubleshooting

### Common Issues

**Q: Changes not syncing?**
- Check network connectivity
- Look for "Pending" badges indicating queued changes
- Force sync via UI

**Q: Duplicate items after sync?**
- This shouldn't happen with proper ID generation
- Check itemId/ctbId uniqueness

**Q: Old data appearing?**
- May indicate conflict resolution
- Check item history for "delivered" actions with later timestamps

### Logs

Client-side operations are logged to console:
```
[Inventory] Adding item: Food Item 1 (FOOD-001-ITEM-1) to CTB-FOOD-001
[Inventory] Receiving CTB: CTB-FOOD-001
[Sync] Pushed 3 changes, current version: 67
```

Server-side logs available via:
```bash
npm run server:dev  # Development with auto-reload
```

## API Reference

See server routes for full API documentation:
- `server/src/routes/auth.ts` - Authentication
- `server/src/routes/categories.ts` - Category CRUD
- `server/src/routes/ctbs.ts` - CTB management
- `server/src/routes/items.ts` - Item management
- `server/src/routes/shipments.ts` - Shipment manifests
- `server/src/routes/sync.ts` - Sync endpoints
