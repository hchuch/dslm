# DSLM Critical Design Review - Presentation Guide

> Deep Space Logistics Module Inventory Management System

---

## Slide 1: Title Slide
- **Deep Space Logistics Module (DSLM)**
- Inventory Management System - Critical Design Review
- Team name, date, course/institution
- *Suggestion: Show the app icon or a screenshot of the dashboard as background*

---

## Slide 2: The Problem
**Why does this matter?**

- NASA's Gateway station will host 1,000+ items across hundreds of Cargo Transfer Bags (CTBs)
- ISS experience shows inventory management consumes significant crew time — crew hours are valued at ~$130K/hr
- Communication delay: 1-3 second round-trip to the Moon, minutes to hours for deep space
- Ground control cannot manage inventory in real-time; crews need autonomous capability
- Current methods (spreadsheets, ground-based manifests) break down without constant connectivity
- A single misplaced medical supply or expired food item creates mission risk

*Talking point: Explain that this isn't a warehouse app — it's a life-support logistics system where "out of stock" can mean mission failure.*

---

## Slide 3: Our Solution
**A mobile-first, offline-first inventory system built for space**

- Native mobile app (tablet-optimized) for crew use aboard Gateway
- Full functionality without any network connection — designed for comm blackouts
- Automatic bidirectional sync when connectivity is available
- NFC hardware integration for instant, hands-free CTB identification
- Ground crew interface for shipment preparation and remote monitoring
- Role-based access: 5 distinct user roles with appropriate permissions

*Diagram suggestion: Show the high-level flow: Crew Tablet -> Local DB -> Sync Engine -> Server -> Ground Console*

---

## Slide 4: System Architecture

```
+-------------------+        +-------------------+
| CREW TABLET       |  sync  | GROUND SERVER     |
|                   |<------>|                   |
| React Native App  |        | Node.js + Express |
| expo-sqlite (SQLite)       | Prisma ORM        |
| NFC Manager       |        | SQLite Database   |
| Offline Queue     |        | Change Log        |
+-------------------+        +-------------------+
```

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Mobile App | React Native + Expo + TypeScript | Cross-platform crew interface |
| Local Database | expo-sqlite | On-device persistent storage |
| Sync Engine | Version-based delta sync | Bidirectional data transfer |
| Server | Node.js + Express + TypeScript | Ground operations + data authority |
| Server Database | SQLite via Prisma ORM | Persistent ground truth |
| Authentication | JWT + bcrypt | Secure role-based sessions |
| NFC | react-native-nfc-manager | Hardware tag read/write |

*Talking point: Everything the server can do, the client can do offline. The sync layer reconciles when connection returns.*

---

## Slide 5: Data Model
**Structured around NASA's CTB standard**

- **CTBs (Cargo Transfer Bags)**: 7 standard sizes (0.5 - 10.0 m³), nestable up to 3 levels deep with volume-based capacity validation
- **Inventory Items**: 11 categories (food, water, medical, hygiene, clothing, scientific-equipment, spare-parts, lab-equipment, lunar-equipment, waste, misc)
- **Storage Layout**: 5 physical stacks (S1-S3 rigid 12m³, C1-C2 flexible 8m³) + virtual INCOMING staging area, each with 16 positions x 4 layers
- **Shipments**: Full manifest lifecycle tracking (draft -> manifested -> launched -> in-transit -> delivered -> received)
- **History/Audit Trail**: Every action on every item is logged with timestamp, user, locations, and notes
- **7 Item States**: incoming -> stock -> delivered -> in-use -> consumed -> waste -> relocated

*Show the entity relationship diagram if you have one. Key point: the data model mirrors real NASA CTB specifications.*

---

## Slide 6: Screen Tour - Home Dashboard

**The crew's command center** (screenshot recommended)

- Live statistics: total items, total CTBs, incoming count, expiring-soon count
- One-tap NFC scan button in header
- Global search across all items and CTBs (name, description, category, location, CTB ID)
- Critical alerts section: auto-surfaces low-stock critical items (qty <= 2)
- Recent activity feed: last 5 events across all items with action-specific icons
- Role-gated action cards: Receive Incoming, Waste Management, Activity Logs, Shipment Manifest, Storage Module
- Offline status banner: shows sync state (offline/syncing/pending changes)

---

## Slide 7: Screen Tour - Module Visualization

**Interactive 3D-style grid of the physical DSLM** (screenshot recommended)

- Pixel-grid map of all stacks showing occupied vs. empty cells
- Color-coded by CTB size (7 distinct colors for each standard size)
- Utilization bar per stack with color thresholds (green < 50%, orange 50-80%, red > 80%)
- Tap a stack -> detail modal with:
  - Stats grid: CTB count, total mass, capacity %, position count
  - CTB list sorted by layer, with item previews
- **Stack reorganization**: Auto-optimize (sort by mass, heaviest-first) or manual drag-to-reorder with animated wobble/pulse UI
- "Outside CTBs" section: CTBs temporarily removed from storage for crew access

---

## Slide 8: Screen Tour - CTB Viewer (Detail Modal)

**The most feature-rich component** (screenshot recommended - show both CTB view and item view)

**CTB View:**
- Browse items inside, navigate nested child CTBs (breadcrumb navigation)
- Receive incoming CTB (auto-assigns free position accounting for multi-slot sizes)
- Take Out / Return CTB (tracks temporary removal)
- Move to different stack/position
- NFC tag assignment: scan -> write CTB ID to physical tag, undo accidental removal
- Delete CTB (password-gated)

**Item View:**
- Full detail: name, category, criticality, mass, volume, quantity, description, location, dates, barcode info
- **Edit Item**: modify quantity, mass, volume, criticality, category, expiry, description (change history logged)
- **Report Discrepancy**: flag wrong-quantity, missing, damaged, or wrong-item with description
- Edit notes, mark consumed, mark as waste (1.4x volume multiplier calculated)
- Relocate to different CTB
- Delete with 5-second undo toast
- Full history timeline

*Talking point: This is where crew members spend most of their time. Every action creates an audit trail.*

---

## Slide 9: Shipment Management

**Ground crew builds manifests, crew receives them** (screenshot recommended)

- **Manifest Builder** (ground-crew/admin role):
  - Set manifest ID (MNF-YYYY-NNN), destination, priority (Low/Normal/High)
  - Add CTBs with size picker (7 standard sizes), target stack/position
  - Add items to each CTB with name, quantity, category
  - Auto-generated item IDs with category prefixes (FOOD-xxx, MED-xxx, etc.)
  - NFC tag assignment during CTB creation
- **Receiving Workflow** (astronaut role):
  - Incoming CTBs shown with summary: count, total mass, item count
  - One-tap receive: auto-assigns to nearest free position respecting multi-slot sizes
  - All items transition from "incoming" to "stock" with delivery history entry
- **Shipment Lifecycle**: 6 states tracked end-to-end

---

## Slide 10: NFC Integration

**Scan a tag, get instant context** (photo of NFC tag on CTB if possible)

- Hardware NFC read/write using react-native-nfc-manager
- **Scan mode**: Read tag -> instantly opens the linked CTB in the viewer
- **Write mode**: Write a CTB ID to a blank NFC tag during creation or reassignment
- Tag undo: accidentally removed a tag? One-tap restore to previous assignment
- Supports RFID, barcode, QR, and visual tag types
- Works completely offline: tag-to-CTB mapping stored in local SQLite
- NFC FAB (floating action button) always accessible from dashboard

*Talking point: This eliminates manual lookup. Crew scans the physical bag and immediately sees everything inside.*

---

## Slide 11: Offline-First Architecture (Key Differentiator)

**The app works identically with or without network**

1. **All mutations go to SQLite first** — the local database is the source of truth during operations
2. **Pending changes queue** — every create/update/delete is recorded in an outbox table
3. **Visual sync indicators**: offline banner (red), syncing animation (blue), pending count (amber with "tap to sync")
4. **Offline authentication**: User credentials cached locally with hashed passwords; login works without server
5. **Automatic push-on-write**: When online, changes push to server immediately after each operation
6. **Background polling**: 10-second sync cycle pulls changes from other devices

**Sync Protocol:**
- Version-based delta sync: each server change gets an incrementing version number
- Client tracks `lastSyncVersion`, requests only newer changes
- Full sync fallback if versions diverge
- Per-change success/failure tracking: failed items stay in queue for retry

*Talking point: This is critical for Gateway. Comm windows may be limited or scheduled. The crew should never have to wait for ground to manage their supplies.*

---

## Slide 12: Discrepancy Management (NEW)

**Crew can flag inventory mistakes in real-time**

- **Edit Item**: Astronauts can modify quantity, mass, volume, criticality, expiry after unpacking (e.g., volume changes from packed to unpacked state)
- **Report Discrepancy** with 4 types:
  - Wrong Quantity — count doesn't match manifest
  - Missing Item — item not found in CTB
  - Damaged — item arrived damaged or broken
  - Wrong Item — different item than expected
- Each discrepancy creates a permanent history entry with `[type] description` format
- All edits log a change summary (e.g., "qty: 10 -> 8, mass: 2.5kg -> 2.1kg")
- Ground crew sees discrepancy reports in activity logs after sync

*Talking point: ISS has documented cases where manifests don't match reality. This gives crew a formal process to report and track issues.*

---

## Slide 13: User Roles and Access Control

| Role | Access | Tab Visibility |
|------|--------|----------------|
| **Admin** | Full system access, user management | All tabs including Admin |
| **Astronaut** | Inventory ops, CTB management, receiving | Home, Module, Logs, Waste |
| **Mission Specialist** | Same as astronaut, science equipment focus | Home, Module, Logs, Waste |
| **Ground Crew** | Remote monitoring, shipment creation | Home, Module, Logs, Shipment |
| **Loader** | Pre-launch CTB loading | Home, Module, Logs |

- JWT authentication with 7-day token expiry
- Server-side role enforcement on all API endpoints
- Offline login falls back to locally cached credentials (bcrypt hash)
- Admin panel: create/edit/delete users, assign roles and locations

---

## Slide 14: Smart Notifications

**Proactive alerts, not passive logs**

Automatic detection and notification for:
- New incoming shipments (with CTB count)
- CTBs received and stored (with location)
- Items consumed or marked as waste
- Items relocated between stacks
- **Low stock warnings** on important categories (threshold: qty <= 3)
- **Expiry warnings** for items expiring within 3 days

Delivery:
- **Foreground**: Animated slide-down banner with spring physics
- **Background**: Native push notification via expo-notifications
- **Badge count**: App icon shows number of incoming CTBs

---

## Slide 15: Reliability and UX

- **Error boundary**: Catches unhandled crashes with "Reload" recovery
- **Haptic feedback**: Tactile confirmation on tab presses, scans, deletes, and key actions (via expo-haptics)
- **Confirmation dialogs**: Required for destructive operations (delete, consume, waste)
- **Undo capability**: 5-second toast with countdown bar for item/CTB deletion
- **Waste tracking**: Automatic 1.4x volume multiplier for used packaging; mission budget progress bar against 240L limit
- **Multi-slot CTB positioning**: Larger CTBs (size 4+) correctly occupy multiple slots; placement logic prevents overlap

---

## Slide 16: Tech Stack Summary

| Layer | Technology | Why |
|-------|-----------|-----|
| Mobile App | React Native, Expo, TypeScript | Cross-platform, rapid iteration |
| Local DB | expo-sqlite | Full SQL on-device, no network needed |
| Server | Node.js, Express, TypeScript | Same language as client, fast development |
| Server DB | SQLite via Prisma ORM | Type-safe queries, easy migrations |
| Auth | JWT + bcrypt | Industry standard, offline-capable |
| NFC | react-native-nfc-manager | Native hardware access |
| Notifications | expo-notifications | Cross-platform push |
| Haptics | expo-haptics | Tactile feedback in gloved environments |
| Animations | react-native-reanimated | 60fps UI transitions |

---

## Slide 17: Live Demo Script

**Recommended flow (~10-15 minutes):**

1. **Login** as astronaut (username: `astro`, password: `password`)
2. **Dashboard tour**: Point out statistics, alerts, NFC button, search
3. **Module view**: Show the stack grid, tap S1, show CTB layout by layer
4. **Open a CTB**: Show items inside, demonstrate nested navigation
5. **Edit an item**: Change quantity, show the history entry it creates
6. **Report a discrepancy**: Select "wrong-quantity", add description, submit
7. **NFC scan** (if hardware available): Scan a tag, show it opens the CTB
8. **Receive a shipment**: Go to Incoming, tap Receive on a CTB, show it moves to stock
9. **Take Out / Return**: Demonstrate the "outside CTB" workflow
10. **Search**: Type a food item name, show cross-CTB search results
11. **Go offline**: Toggle airplane mode, show offline banner
12. **Make changes offline**: Edit an item, consume another
13. **Reconnect**: Show "N pending", tap sync, watch changes push
14. **Switch to ground-crew**: Logout, login as `ground` - show Shipment tab, demonstrate manifest builder
15. **Admin panel**: Login as `admin`, show user management

*Tip: Seed the database before the demo. The seed script creates 25 CTBs, 60+ items, 5 users, and 3 shipments with realistic NASA data.*

---

## Slide 18: Requirements Traceability

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Offline operation | Complete | SQLite local DB, pending changes queue |
| CTB hierarchy (3 levels) | Complete | Nested CTBs with volume validation |
| 7 standard CTB sizes | Complete | 0.5 - 10.0 m³ per NASA specs |
| NFC tag read/write | Complete | react-native-nfc-manager |
| Role-based access | Complete | 5 roles, JWT auth, tab gating |
| Item lifecycle tracking | Complete | 7 states with full audit trail |
| Shipment manifest | Complete | 6-state lifecycle, manifest builder |
| Search and filter | Complete | Multi-field search, category/status/criticality filters |
| Sync across devices | Complete | Version-based delta sync |
| Waste management | Complete | 1.4x volume tracking, disposal methods, budget progress |
| Discrepancy reporting | Complete | 4 types with history logging |
| Item editing | Complete | Inline edit with change diff history |
| Expiry monitoring | Complete | Alerts for items expiring within 3 days |
| Notification system | Complete | Foreground banners + background push |

---

## Slide 19: Testing and Validation

- **Type safety**: TypeScript strict mode, zero type errors across full codebase
- **Device testing**: iOS simulator, physical iPhone/iPad, Android emulator
- **Offline testing**: Airplane mode transitions, extended offline operation, reconnect sync
- **NFC testing**: Physical NFC tag read/write on supported devices
- **Multi-device sync**: Two devices making concurrent changes, verifying bidirectional sync
- **Edge cases**: Empty states, max nesting depth, full stacks, expired items
- **Seed data**: Comprehensive demo environment with realistic NASA inventory data (spectrometers, ECLSS filters, meal packs, EVA suits, etc.)

---

## Slide 20: Challenges and Lessons Learned

- **Stale closure bugs in React Native**: State updates inside async callbacks can read outdated values; solved with `useRef` pattern for critical fields
- **NFC data format**: Bridging between NDEF text records and the app's data model required careful serialization
- **Sync conflict resolution**: Client-side field names vs. server-side Prisma column names required a flattening/translation layer
- **Multi-slot CTB positioning**: A size-4 CTB occupies 4 positions; naive "is position occupied" check caused overlap; fixed with span-aware placement
- **Offline authentication**: Caching credentials securely while supporting offline login required a dual-path auth flow

---

## Slide 21: Future Work

- **Camera-based scanning**: Barcode/QR scanning as NFC alternative for devices without NFC hardware
- **Crew time analytics**: Track time spent per inventory operation for mission planning optimization
- **Ground analytics dashboard**: Consumption rates, reorder forecasting, category trends
- **Multi-module support**: DSLM-1, DSLM-2 — track inventory across multiple logistics modules
- **NASA RFID standards integration**: Align with ISS RFID infrastructure specifications
- **Conflict resolution UI**: Visual diff for conflicting edits from multiple crew members
- **Voice commands**: Hands-free inventory operations for EVA or gloved scenarios

---

## Slide 22: Questions

*Be prepared for:*
- "How does it handle conflicts when two crew members edit the same item?" — Last-write-wins with full history; future work includes visual diff
- "What happens if the database corrupts?" — Full sync from server restores complete state
- "How big can the local database get?" — SQLite handles millions of rows; current schema is lightweight
- "Why not use a cloud database directly?" — Communication delay makes real-time cloud access impractical; offline-first is a hard requirement
- "How does this compare to what ISS uses?" — ISS uses IMS (Inventory Management System) with barcode scanning; DSLM modernizes this with NFC, offline-first, and mobile-native UI
