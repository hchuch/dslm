# 🚀 DSLM Supply Inventory System

## Deep Space Logistics Module - NASA Gateway Program

A comprehensive React Native application for managing inventory in NASA's Deep Space Logistics Module (DSLM), part of the Gateway program for lunar exploration and Mars missions.

## 📋 Overview

This application implements a sophisticated supply chain management system for the DSLM, designed to track and manage cargo from Earth-based loading at Kennedy Space Center through deployment at the Gateway lunar station. The system supports:

- **Hierarchical inventory tracking** with nested Cargo Transfer Bags (CTBs)
- **Precise location tracking** across 5 stacks with 16 positions and 4 layers each
- **RFID/barcode tagging** for automated tracking
- **Food management** with nutritional information, expiry dates, and meal planning
- **Waste management** with volume tracking (1.3-1.5x expansion)
- **Real-time search and filtering** capabilities
- **Visual module layout** representation

## 🎯 Key Features

### 1. Comprehensive Data Model

The system models the complete DSLM supply chain:

- **Cargo Transfer Bags (CTBs)**: 7 standard sizes (0.5, 1.0, 2.0, 4.0, 6.0, 8.0, 10.0 units)
- **Hierarchical Nesting**: Russian nesting doll structure for complex packing
- **Location System**: 5 stacks (S1, S2, S3, C1, C2) with precise position tracking
- **Item Categories**: Food, Water, Scientific Equipment, Lunar Equipment, Medical, Spare Parts
- **Status Tracking**: Incoming, Stock, Delivered, In-Use, Consumed, Waste

### 2. Advanced Inventory Management

#### Food Tracking
- 256+ meal types (Breakfast, Lunch, Dinner, Snacks, Special)
- Complete nutritional information (calories, macros, sodium, fiber, sugar)
- Expiry date tracking with alerts
- Meal preparation instructions
- Allergen information
- Temperature requirements

#### Item Metadata
- Unique RFID/barcode tags
- Mass and volume tracking
- Criticality levels (Critical, High, Medium, Low)
- Manufacturer and part numbers
- Serial number tracking
- Complete history logs

### 3. Location & Navigation

**Stack Configuration:**
- **S1, S2, S3**: Standard rectangular CTBs, 16 positions × 4 layers each
- **C1, C2**: Flexible shape stacks for irregular/soft cargo
- **Total Capacity**: ~52 m³ across all stacks
- **Location Encoding**: Path format (e.g., "S1-P5-L2")

### 4. Search & Analytics

- **Real-time search** across all items, CTBs, and locations
- **Multi-filter support**: Category, Stack, Status, Criticality
- **Statistics dashboard**: Total items, CTBs, critical items, expiring items
- **Stack utilization monitoring**: Real-time capacity tracking
- **Expiry alerts**: Configurable ahead-of-time warnings

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- iOS Simulator / Android Emulator (optional)

### Installation

```bash
# Install dependencies
npm install

# Start the development server
npm start

# Run on specific platform
npm run ios
npm run android
npm run web
```

### Development

```bash
# Start development with hot reload
npm start

# Run linter
npm run lint

# Build for production (requires EAS)
eas build
```

## 🏗️ Architecture

### Technology Stack

- **Framework**: React Native + Expo
- **Routing**: Expo Router (file-based)
- **Language**: TypeScript
- **UI**: Custom themed components
- **State Management**: React Context + Hooks
- **Platform**: iOS, Android, Web

### Project Structure

```
dslm/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx           # Main inventory screen
│   │   ├── module.tsx          # Module visualization
│   │   ├── incoming.tsx        # Incoming items
│   │   └── delivered.tsx       # Delivered items
│   └── _layout.tsx             # Root layout
├── components/
│   ├── module-visualization.tsx # Stack visualization
│   ├── themed-text.tsx
│   ├── themed-view.tsx
│   └── parallax-scroll-view.tsx
├── hooks/
│   └── use-inventory.tsx       # Main inventory hook
├── types/
│   └── dslm.ts                 # TypeScript definitions
├── constants/
│   └── theme.ts
└── requirements.txt            # DSLM system requirements
```

### Data Model

The system uses a comprehensive type system defined in `types/dslm.ts`:

- `InventoryItem`: Individual items with full metadata
- `CTB`: Cargo Transfer Bag containers
- `Location`: Stack/position/layer coordinates
- `FoodData`: Nutritional and meal information
- `TrackingTag`: RFID/barcode identifiers
- `WasteItem`: Waste tracking with volume multipliers
- `StackConfiguration`: Stack specifications

## 📊 Generated Sample Data

The system includes realistic DSLM inventory:

**Food Items (80 meals)**
- 20 CTBs × 4 meals each
- Distributed across S1 and S2 stacks
- Complete nutritional information
- Loaded on Day 1-20 timeline

**Scientific Equipment (6 items)**
- Mix of 4.0 and 8.0 CTB sizes
- Located in S2 and S3 stacks
- Loaded mid-month (Day 15)

**Lunar Equipment (3 items)**
- 10.0 CTB size (large/heavy)
- Located in C1 stack
- Loaded Day 27 for Day 28 deployment

## 🔍 Key Functions

### Inventory Hook API

```typescript
const {
  // Data
  inventoryItems,    // All items
  ctbs,              // All CTBs
  stacks,            // Stack configurations
  wasteItems,        // Waste tracking

  // Search & Filter
  searchItems,       // Full-text search
  findItemById,      // Get specific item
  getItemsByLocation,// Filter by location
  getItemsByCategory,// Filter by category

  // Actions
  deliverItem,       // Mark as delivered
  moveItem,          // Relocate item
  consumeItem,       // Mark as consumed
  markAsWaste,       // Flag for disposal
  relocateCTB,       // Move entire CTB

  // Analytics
  getStackUtilization,// Get capacity %
  getExpiringItems,  // Find items expiring soon
  getCriticalItems,  // Get critical items
  getWasteVolume,    // Total waste volume
} = useInventory();
```

## 📱 Application Screens

### Home Screen
- Comprehensive dashboard with statistics
- Advanced filtering by category, stack, and status
- Real-time search across all inventory
- Visual status badges and indicators
- Location tracking for every item

### Module View
- Interactive stack visualization
- Real-time utilization metrics
- Detailed CTB information
- Color-coded capacity indicators
- Position grid visualization

### Incoming/Delivered Screens
- Dedicated views for workflow management
- Quick item status updates
- Filtering and search capabilities

## 🎨 Design System

### Color Palette
- **Background**: #0A0B0D, #111214, #1A1B1E
- **Borders**: #2A2B2E
- **Primary**: #0F6FFF (NASA Blue)
- **Success**: #2ECC71 (Green)
- **Warning**: #FFB86B (Orange)
- **Error**: #E74C3C (Red)

### Typography
- **Titles**: 18-24px, Bold (700)
- **Body**: 13-15px, Regular (400)
- **Labels**: 11-12px, Semi-bold (600)

## 📖 Requirements Reference

This implementation is based on the DSLM requirements document (`requirements.txt`) which specifies:

### Supply Chain Stages
1. **Earth-Based Loading**: Kennedy Space Center
2. **Launch & Transit**: SpaceX launch vehicle
3. **Gateway Docking**: Autonomous docking
4. **Operational Use**: Astronaut retrieval
5. **Waste Management**: Return logistics
6. **Database Sync**: Earth ↔ Gateway communication

### Technical Specifications
- **Monthly Resupply**: ~900 kg for 4-person crew
- **RFID Tracking**: 394 items per mission
- **Storage Volume**: 370.8 m³ total (waste included)
- **Communication Latency**: 1.5s one-way Earth-Moon
- **Mission Duration**: 30-45 days typical
- **Waste Volume**: 1.3-1.5x original packaging

## 🔮 Future Enhancements

### Planned Features
- Item detail modal with full history
- Barcode/QR code scanning
- Offline mode with sync
- 3D module visualization
- AR view for astronauts
- Voice search and commands
- Real-time Gateway-Earth sync
- Advanced analytics dashboard
- Integration with backend server

## 📄 License

This project is a demonstration/prototype for NASA's DSLM system.

## 🙏 Acknowledgments

- **NASA Gateway Program**: For the vision of sustainable lunar exploration
- **SpaceX**: Launch provider and logistics partner
- **Kennedy Space Center**: Deep Space Logistics operations
- **Artemis Initiative**: Returning humans to the Moon

---

**Built for the stars. Managed on Earth. Delivered to the Moon.** 🌙

*DSLM Inventory System v1.0 - Deep Space Logistics Module*
