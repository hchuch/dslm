import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursAgo(n: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d;
}

async function main() {
  console.log('Seeding database...');

  const categories = [
    { name: 'food', label: 'Food', prefix: 'FOOD', isSystem: true },
    { name: 'water', label: 'Water', prefix: 'WATER', isSystem: true },
    { name: 'clothing', label: 'Clothing', prefix: 'CLOTH', isSystem: true },
    { name: 'hygiene', label: 'Hygiene', prefix: 'HYG', isSystem: true },
    { name: 'medical', label: 'Medical', prefix: 'MED', isSystem: true },
    { name: 'scientific-equipment', label: 'Scientific Equipment', prefix: 'SCI', isSystem: true },
    { name: 'spare-parts', label: 'Spare Parts', prefix: 'SPARE', isSystem: true },
    { name: 'lab-equipment', label: 'Lab Equipment', prefix: 'LAB', isSystem: true },
    { name: 'lunar-equipment', label: 'Lunar Equipment', prefix: 'LUNAR', isSystem: true },
    { name: 'waste', label: 'Waste', prefix: 'WASTE', isSystem: true },
    { name: 'misc', label: 'Miscellaneous', prefix: 'MISC', isSystem: true },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  console.log(`Created ${categories.length} categories`);

  const stacks = [
    { stackId: 'S1', positions: 16, maxLayers: 4, allowedCTBSizes: JSON.stringify([0.5, 1.0, 2.0, 4.0, 6.0, 8.0, 10.0]), isFlexibleShape: false, totalVolume: 12.0 },
    { stackId: 'S2', positions: 16, maxLayers: 4, allowedCTBSizes: JSON.stringify([0.5, 1.0, 2.0, 4.0, 6.0, 8.0, 10.0]), isFlexibleShape: false, totalVolume: 12.0 },
    { stackId: 'S3', positions: 16, maxLayers: 4, allowedCTBSizes: JSON.stringify([0.5, 1.0, 2.0, 4.0, 6.0, 8.0, 10.0]), isFlexibleShape: false, totalVolume: 12.0 },
    { stackId: 'C1', positions: 16, maxLayers: 4, allowedCTBSizes: JSON.stringify([0.5, 1.0, 2.0, 4.0]), isFlexibleShape: true, totalVolume: 8.0 },
    { stackId: 'C2', positions: 16, maxLayers: 4, allowedCTBSizes: JSON.stringify([0.5, 1.0, 2.0, 4.0]), isFlexibleShape: true, totalVolume: 8.0 },
    { stackId: 'INCOMING', positions: 100, maxLayers: 1, allowedCTBSizes: JSON.stringify([0.5, 1.0, 2.0, 4.0, 6.0, 8.0, 10.0]), isFlexibleShape: true, totalVolume: 100.0 },
  ];

  for (const stack of stacks) {
    await prisma.stack.upsert({
      where: { stackId: stack.stackId },
      update: {},
      create: stack,
    });
  }
  console.log(`Created ${stacks.length} stacks`);

  // Users
  const adminHash = await bcrypt.hash('password', 10);
  const crewHash = await bcrypt.hash('password', 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', name: 'System Administrator', role: 'admin', currentLocation: 'Earth', passwordHash: adminHash },
  });

  const users = [
    { username: 'astro', name: 'Astronaut', role: 'astronaut', currentLocation: 'Gateway' },
    { username: 't.chen', name: 'T. Chen', role: 'mission-specialist', currentLocation: 'Gateway' },
    { username: 'k.mitchell', name: 'K. Mitchell', role: 'astronaut', currentLocation: 'Gateway' },
    { username: 'ground', name: 'Ground Crew', role: 'ground-crew', currentLocation: 'Earth' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: { ...u, passwordHash: crewHash },
    });
  }
  console.log(`Created ${users.length + 1} users`);

  // CTBs across stacks
  const ctbData = [
    // S1 - Food & water
    { ctbId: 'CTB-FOOD-001', size: 4.0, stackId: 'S1', position: 1, layer: 1, mass: 8.2, volume: 0.10, rfidTagId: 'RFID-4A7B2C01', notes: 'Meal packs day 1-7' },
    { ctbId: 'CTB-FOOD-002', size: 4.0, stackId: 'S1', position: 2, layer: 1, mass: 7.8, volume: 0.10, rfidTagId: 'RFID-4A7B2C02' },
    { ctbId: 'CTB-FOOD-003', size: 2.0, stackId: 'S1', position: 3, layer: 1, mass: 4.1, volume: 0.05, rfidTagId: 'RFID-4A7B2C03', notes: 'Snacks and beverages' },
    { ctbId: 'CTB-FOOD-004', size: 4.0, stackId: 'S1', position: 1, layer: 2, mass: 8.5, volume: 0.10, rfidTagId: 'RFID-4A7B2C04', notes: 'Meal packs day 8-14' },
    { ctbId: 'CTB-WATER-001', size: 6.0, stackId: 'S1', position: 4, layer: 1, mass: 12.3, volume: 0.15, rfidTagId: 'RFID-5W8D3E01' },
    { ctbId: 'CTB-WATER-002', size: 6.0, stackId: 'S1', position: 5, layer: 1, mass: 12.1, volume: 0.15, rfidTagId: 'RFID-5W8D3E02' },

    // S2 - Medical, hygiene, clothing
    { ctbId: 'CTB-MED-001', size: 2.0, stackId: 'S2', position: 1, layer: 1, mass: 3.4, volume: 0.05, rfidTagId: 'RFID-6M9F4G01', notes: 'Primary medical kit' },
    { ctbId: 'CTB-MED-002', size: 1.0, stackId: 'S2', position: 2, layer: 1, mass: 1.8, volume: 0.025, rfidTagId: 'RFID-6M9F4G02', notes: 'Radiation dosimeters and meds' },
    { ctbId: 'CTB-HYG-001', size: 2.0, stackId: 'S2', position: 3, layer: 1, mass: 2.9, volume: 0.05, rfidTagId: 'RFID-7H0A5B01' },
    { ctbId: 'CTB-HYG-002', size: 1.0, stackId: 'S2', position: 4, layer: 1, mass: 1.5, volume: 0.025, rfidTagId: 'RFID-7H0A5B02' },
    { ctbId: 'CTB-CLOTH-001', size: 4.0, stackId: 'S2', position: 5, layer: 1, mass: 5.2, volume: 0.10, rfidTagId: 'RFID-8C1D6E01' },
    { ctbId: 'CTB-CLOTH-002', size: 2.0, stackId: 'S2', position: 6, layer: 1, mass: 2.8, volume: 0.05, rfidTagId: 'RFID-8C1D6E02' },

    // S3 - Science and spare parts
    { ctbId: 'CTB-SCI-001', size: 8.0, stackId: 'S3', position: 1, layer: 1, mass: 14.6, volume: 0.20, rfidTagId: 'RFID-9S2E7F01', notes: 'Spectrometer components' },
    { ctbId: 'CTB-SCI-002', size: 4.0, stackId: 'S3', position: 2, layer: 1, mass: 6.9, volume: 0.10, rfidTagId: 'RFID-9S2E7F02' },
    { ctbId: 'CTB-SPARE-001', size: 4.0, stackId: 'S3', position: 3, layer: 1, mass: 9.1, volume: 0.10, rfidTagId: 'RFID-0P3G8H01', notes: 'ECLSS filter replacements' },
    { ctbId: 'CTB-SPARE-002', size: 2.0, stackId: 'S3', position: 4, layer: 1, mass: 4.7, volume: 0.05, rfidTagId: 'RFID-0P3G8H02' },
    { ctbId: 'CTB-LAB-001', size: 4.0, stackId: 'S3', position: 5, layer: 1, mass: 7.3, volume: 0.10, rfidTagId: 'RFID-1L4H9I01' },

    // C1 - Smaller crew items
    { ctbId: 'CTB-MISC-001', size: 1.0, stackId: 'C1', position: 1, layer: 1, mass: 1.2, volume: 0.025, rfidTagId: 'RFID-2M5I0J01', notes: 'Crew personal items - Garcia' },
    { ctbId: 'CTB-MISC-002', size: 1.0, stackId: 'C1', position: 2, layer: 1, mass: 1.1, volume: 0.025, rfidTagId: 'RFID-2M5I0J02', notes: 'Crew personal items - Chen' },
    { ctbId: 'CTB-MISC-003', size: 0.5, stackId: 'C1', position: 3, layer: 1, mass: 0.6, volume: 0.012, rfidTagId: 'RFID-2M5I0J03' },

    // C2 - Lunar surface prep
    { ctbId: 'CTB-LUNAR-001', size: 4.0, stackId: 'C2', position: 1, layer: 1, mass: 6.4, volume: 0.10, rfidTagId: 'RFID-3N6J1K01', notes: 'EVA tool kit' },
    { ctbId: 'CTB-LUNAR-002', size: 2.0, stackId: 'C2', position: 2, layer: 1, mass: 3.8, volume: 0.05, rfidTagId: 'RFID-3N6J1K02', notes: 'Sample collection bags' },

    // INCOMING - Recent resupply
    { ctbId: 'CTB-FOOD-005', size: 4.0, stackId: 'INCOMING', position: 1, layer: 1, mass: 8.0, volume: 0.10, rfidTagId: 'RFID-4A7B2C05', notes: 'Resupply meals day 15-21' },
    { ctbId: 'CTB-WATER-003', size: 6.0, stackId: 'INCOMING', position: 2, layer: 1, mass: 12.0, volume: 0.15, rfidTagId: 'RFID-5W8D3E03' },
    { ctbId: 'CTB-MED-003', size: 1.0, stackId: 'INCOMING', position: 3, layer: 1, mass: 1.6, volume: 0.025, rfidTagId: 'RFID-6M9F4G03', notes: 'Pharmaceutical resupply' },
  ];

  for (const ctb of ctbData) {
    const locationPath = `${ctb.stackId}-P${ctb.position}-L${ctb.layer}`;
    await prisma.cTB.upsert({
      where: { ctbId: ctb.ctbId },
      update: {},
      create: {
        ctbId: ctb.ctbId,
        rfidTagType: 'RFID',
        rfidTagId: ctb.rfidTagId,
        size: ctb.size,
        stackId: ctb.stackId,
        position: ctb.position,
        layer: ctb.layer,
        locationPath,
        mass: ctb.mass,
        volume: ctb.volume,
        packedVolume: ctb.volume * 1.12,
        unpackedVolume: ctb.volume * 0.9,
        loadedDate: ctb.stackId === 'INCOMING' ? daysAgo(2) : daysAgo(18),
        lastAccessedDate: ctb.stackId === 'INCOMING' ? undefined : hoursAgo(Math.floor(Math.random() * 72) + 1),
        lastAccessedBy: ['r.garcia', 't.chen', 'k.mitchell'][Math.floor(Math.random() * 3)],
        notes: ctb.notes || null,
        rfidBatteryLife: 300 + Math.floor(Math.random() * 65),
      },
    });
  }
  console.log(`Created ${ctbData.length} CTBs`);

  // Inventory items
  const items = [
    // Food items in CTB-FOOD-001
    { itemId: 'FOOD-0001', name: 'Beef Stroganoff (Thermo)', category: 'food', ctbId: 'CTB-FOOD-001', mass: 0.32, volume: 0.0008, quantity: 4, status: 'stock', criticality: 'medium', manufacturer: 'Percheron Foods' },
    { itemId: 'FOOD-0002', name: 'Chicken Teriyaki (Thermo)', category: 'food', ctbId: 'CTB-FOOD-001', mass: 0.30, volume: 0.0008, quantity: 4, status: 'stock', criticality: 'medium', manufacturer: 'Percheron Foods' },
    { itemId: 'FOOD-0003', name: 'Vegetable Curry (Thermo)', category: 'food', ctbId: 'CTB-FOOD-001', mass: 0.28, volume: 0.0007, quantity: 4, status: 'stock', criticality: 'medium' },
    { itemId: 'FOOD-0004', name: 'Tortillas (Pkg of 12)', category: 'food', ctbId: 'CTB-FOOD-001', mass: 0.45, volume: 0.0012, quantity: 3, status: 'stock', criticality: 'low' },
    { itemId: 'FOOD-0005', name: 'Scrambled Eggs (FD)', category: 'food', ctbId: 'CTB-FOOD-001', mass: 0.18, volume: 0.0005, quantity: 6, status: 'stock', criticality: 'medium' },
    { itemId: 'FOOD-0006', name: 'Oatmeal w/ Brown Sugar (FD)', category: 'food', ctbId: 'CTB-FOOD-001', mass: 0.14, volume: 0.0004, quantity: 7, status: 'stock', criticality: 'medium' },

    // Food items in CTB-FOOD-002
    { itemId: 'FOOD-0007', name: 'Shrimp Cocktail (Irrad)', category: 'food', ctbId: 'CTB-FOOD-002', mass: 0.26, volume: 0.0007, quantity: 4, status: 'stock', criticality: 'medium' },
    { itemId: 'FOOD-0008', name: 'Pasta Primavera (Thermo)', category: 'food', ctbId: 'CTB-FOOD-002', mass: 0.31, volume: 0.0008, quantity: 4, status: 'stock', criticality: 'medium' },
    { itemId: 'FOOD-0009', name: 'Granola Bar (Pkg of 8)', category: 'food', ctbId: 'CTB-FOOD-002', mass: 0.24, volume: 0.0006, quantity: 5, status: 'stock', criticality: 'low' },
    { itemId: 'FOOD-0010', name: 'Dried Apricots', category: 'food', ctbId: 'CTB-FOOD-002', mass: 0.15, volume: 0.0004, quantity: 6, status: 'stock', criticality: 'low' },

    // Snacks in CTB-FOOD-003
    { itemId: 'FOOD-0011', name: 'Cashew Nuts (Pkg)', category: 'food', ctbId: 'CTB-FOOD-003', mass: 0.12, volume: 0.0003, quantity: 8, status: 'stock', criticality: 'low' },
    { itemId: 'FOOD-0012', name: 'Lemonade Drink Mix', category: 'food', ctbId: 'CTB-FOOD-003', mass: 0.08, volume: 0.0002, quantity: 12, status: 'stock', criticality: 'low' },
    { itemId: 'FOOD-0013', name: 'Coffee (Freeze Dried)', category: 'food', ctbId: 'CTB-FOOD-003', mass: 0.10, volume: 0.0003, quantity: 20, status: 'stock', criticality: 'low' },

    // Water in CTB-WATER-001 / 002
    { itemId: 'WATER-0001', name: 'Potable Water Bag (2L)', category: 'water', ctbId: 'CTB-WATER-001', mass: 2.05, volume: 0.002, quantity: 6, status: 'stock', criticality: 'critical' },
    { itemId: 'WATER-0002', name: 'Potable Water Bag (2L)', category: 'water', ctbId: 'CTB-WATER-002', mass: 2.05, volume: 0.002, quantity: 6, status: 'stock', criticality: 'critical' },

    // Medical in CTB-MED-001
    { itemId: 'MED-0001', name: 'Ibuprofen 200mg (Bottle)', category: 'medical', ctbId: 'CTB-MED-001', mass: 0.12, volume: 0.0002, quantity: 1, status: 'stock', criticality: 'high', partNumber: 'MK-IBU-200' },
    { itemId: 'MED-0002', name: 'Adhesive Bandages (Box)', category: 'medical', ctbId: 'CTB-MED-001', mass: 0.08, volume: 0.0002, quantity: 2, status: 'stock', criticality: 'high' },
    { itemId: 'MED-0003', name: 'Saline Eye Drops', category: 'medical', ctbId: 'CTB-MED-001', mass: 0.04, volume: 0.00005, quantity: 3, status: 'stock', criticality: 'medium' },
    { itemId: 'MED-0004', name: 'Oral Thermometer', category: 'medical', ctbId: 'CTB-MED-001', mass: 0.05, volume: 0.00008, quantity: 1, status: 'stock', criticality: 'high', serialNumber: 'TH-0491' },
    { itemId: 'MED-0005', name: 'CPR Pocket Mask', category: 'medical', ctbId: 'CTB-MED-001', mass: 0.09, volume: 0.0001, quantity: 1, status: 'stock', criticality: 'critical' },

    // Medical in CTB-MED-002
    { itemId: 'MED-0006', name: 'Radiation Dosimeter', category: 'medical', ctbId: 'CTB-MED-002', mass: 0.06, volume: 0.00004, quantity: 4, status: 'stock', criticality: 'critical', serialNumber: 'RD-2025-A' },
    { itemId: 'MED-0007', name: 'Potassium Iodide Tabs', category: 'medical', ctbId: 'CTB-MED-002', mass: 0.03, volume: 0.00002, quantity: 2, status: 'stock', criticality: 'critical' },

    // Hygiene in CTB-HYG-001
    { itemId: 'HYG-0001', name: 'No-Rinse Body Wipes (Pkg)', category: 'hygiene', ctbId: 'CTB-HYG-001', mass: 0.22, volume: 0.0005, quantity: 8, status: 'stock', criticality: 'medium' },
    { itemId: 'HYG-0002', name: 'Toothpaste (Edible)', category: 'hygiene', ctbId: 'CTB-HYG-001', mass: 0.06, volume: 0.00006, quantity: 3, status: 'stock', criticality: 'medium' },
    { itemId: 'HYG-0003', name: 'Dry Shampoo Packets', category: 'hygiene', ctbId: 'CTB-HYG-001', mass: 0.04, volume: 0.00005, quantity: 10, status: 'stock', criticality: 'low' },
    { itemId: 'HYG-0004', name: 'Nail Clippers', category: 'hygiene', ctbId: 'CTB-HYG-001', mass: 0.03, volume: 0.00002, quantity: 2, status: 'stock', criticality: 'low' },

    // Hygiene in CTB-HYG-002
    { itemId: 'HYG-0005', name: 'Deodorant Wipes', category: 'hygiene', ctbId: 'CTB-HYG-002', mass: 0.10, volume: 0.0003, quantity: 6, status: 'stock', criticality: 'low' },

    // Clothing in CTB-CLOTH-001
    { itemId: 'CLOTH-0001', name: 'Crew T-Shirt (M)', category: 'clothing', ctbId: 'CTB-CLOTH-001', mass: 0.18, volume: 0.0004, quantity: 6, status: 'stock', criticality: 'medium' },
    { itemId: 'CLOTH-0002', name: 'Compression Shorts', category: 'clothing', ctbId: 'CTB-CLOTH-001', mass: 0.12, volume: 0.0003, quantity: 6, status: 'stock', criticality: 'medium' },
    { itemId: 'CLOTH-0003', name: 'Crew Socks (Pair)', category: 'clothing', ctbId: 'CTB-CLOTH-001', mass: 0.06, volume: 0.0001, quantity: 12, status: 'stock', criticality: 'low' },

    // Clothing in CTB-CLOTH-002
    { itemId: 'CLOTH-0004', name: 'Flight Coverall', category: 'clothing', ctbId: 'CTB-CLOTH-002', mass: 0.85, volume: 0.002, quantity: 2, status: 'stock', criticality: 'medium' },

    // Science in CTB-SCI-001
    { itemId: 'SCI-0001', name: 'Near-IR Spectrometer Module', category: 'scientific-equipment', ctbId: 'CTB-SCI-001', mass: 4.2, volume: 0.008, quantity: 1, status: 'stock', criticality: 'critical', serialNumber: 'NIRS-GW-001', manufacturer: 'JPL', partNumber: 'NIRS-4200' },
    { itemId: 'SCI-0002', name: 'Spectrometer Calibration Target', category: 'scientific-equipment', ctbId: 'CTB-SCI-001', mass: 0.8, volume: 0.001, quantity: 1, status: 'stock', criticality: 'high', serialNumber: 'CAL-T-044' },
    { itemId: 'SCI-0003', name: 'Fiber Optic Cable (2m)', category: 'scientific-equipment', ctbId: 'CTB-SCI-001', mass: 0.15, volume: 0.0003, quantity: 3, status: 'stock', criticality: 'high' },

    // Science in CTB-SCI-002
    { itemId: 'SCI-0004', name: 'Regolith Sample Container', category: 'scientific-equipment', ctbId: 'CTB-SCI-002', mass: 0.45, volume: 0.001, quantity: 6, status: 'stock', criticality: 'medium', manufacturer: 'GSFC' },
    { itemId: 'SCI-0005', name: 'Radiation Sensor Array', category: 'scientific-equipment', ctbId: 'CTB-SCI-002', mass: 1.1, volume: 0.002, quantity: 2, status: 'stock', criticality: 'high', serialNumber: 'RSA-2025-B' },

    // Spare parts in CTB-SPARE-001
    { itemId: 'SPARE-0001', name: 'ECLSS CO2 Filter Cartridge', category: 'spare-parts', ctbId: 'CTB-SPARE-001', mass: 1.8, volume: 0.003, quantity: 4, status: 'stock', criticality: 'critical', partNumber: 'ECLSS-CO2-F4', manufacturer: 'Hamilton Sundstrand' },
    { itemId: 'SPARE-0002', name: 'Cabin Air Fan Motor', category: 'spare-parts', ctbId: 'CTB-SPARE-001', mass: 2.1, volume: 0.004, quantity: 1, status: 'stock', criticality: 'critical', partNumber: 'CAF-M-110', serialNumber: 'CAF-S-0872' },

    // Spare parts in CTB-SPARE-002
    { itemId: 'SPARE-0003', name: 'LED Panel Replacement', category: 'spare-parts', ctbId: 'CTB-SPARE-002', mass: 0.35, volume: 0.001, quantity: 4, status: 'stock', criticality: 'medium', partNumber: 'LED-P-60W' },
    { itemId: 'SPARE-0004', name: 'M6 Bolt Assortment', category: 'spare-parts', ctbId: 'CTB-SPARE-002', mass: 0.40, volume: 0.0005, quantity: 1, status: 'stock', criticality: 'low' },
    { itemId: 'SPARE-0005', name: 'Cable Ties (100-Pack)', category: 'spare-parts', ctbId: 'CTB-SPARE-002', mass: 0.15, volume: 0.0003, quantity: 2, status: 'stock', criticality: 'low' },

    // Lab equipment in CTB-LAB-001
    { itemId: 'LAB-0001', name: 'Portable Microscope', category: 'lab-equipment', ctbId: 'CTB-LAB-001', mass: 1.4, volume: 0.003, quantity: 1, status: 'stock', criticality: 'high', serialNumber: 'PM-GW-003' },
    { itemId: 'LAB-0002', name: 'Pipette Set (Adjustable)', category: 'lab-equipment', ctbId: 'CTB-LAB-001', mass: 0.22, volume: 0.0005, quantity: 1, status: 'stock', criticality: 'medium' },
    { itemId: 'LAB-0003', name: 'Petri Dishes (Sterile, 20-Pack)', category: 'lab-equipment', ctbId: 'CTB-LAB-001', mass: 0.30, volume: 0.0008, quantity: 2, status: 'stock', criticality: 'medium' },
    { itemId: 'LAB-0004', name: 'Nitrile Gloves (Box of 50)', category: 'lab-equipment', ctbId: 'CTB-LAB-001', mass: 0.25, volume: 0.0006, quantity: 2, status: 'stock', criticality: 'medium' },

    // Crew personal items in C1
    { itemId: 'MISC-0001', name: 'Garcia Family Photos (USB)', category: 'misc', ctbId: 'CTB-MISC-001', mass: 0.02, volume: 0.00001, quantity: 1, status: 'delivered', criticality: 'low' },
    { itemId: 'MISC-0002', name: 'Resistance Bands (Set)', category: 'misc', ctbId: 'CTB-MISC-001', mass: 0.35, volume: 0.0005, quantity: 1, status: 'delivered', criticality: 'low' },
    { itemId: 'MISC-0003', name: 'Chen Personal Kit', category: 'misc', ctbId: 'CTB-MISC-002', mass: 0.40, volume: 0.0006, quantity: 1, status: 'delivered', criticality: 'low' },
    { itemId: 'MISC-0004', name: 'Velcro Strips (Roll)', category: 'misc', ctbId: 'CTB-MISC-003', mass: 0.10, volume: 0.0002, quantity: 3, status: 'stock', criticality: 'low' },

    // Lunar surface items in C2
    { itemId: 'LUNAR-0001', name: 'EVA Torque Wrench', category: 'lunar-equipment', ctbId: 'CTB-LUNAR-001', mass: 0.8, volume: 0.001, quantity: 2, status: 'stock', criticality: 'high', partNumber: 'TW-EVA-12' },
    { itemId: 'LUNAR-0002', name: 'EVA Hammer', category: 'lunar-equipment', ctbId: 'CTB-LUNAR-001', mass: 0.55, volume: 0.0008, quantity: 1, status: 'stock', criticality: 'medium' },
    { itemId: 'LUNAR-0003', name: 'Surface Sample Bags (10-Pack)', category: 'lunar-equipment', ctbId: 'CTB-LUNAR-002', mass: 0.12, volume: 0.0003, quantity: 5, status: 'stock', criticality: 'medium' },
    { itemId: 'LUNAR-0004', name: 'Boot Covers (Pair)', category: 'lunar-equipment', ctbId: 'CTB-LUNAR-002', mass: 0.20, volume: 0.0005, quantity: 4, status: 'stock', criticality: 'medium' },

    // Incoming items
    { itemId: 'FOOD-0014', name: 'Mac & Cheese (Thermo)', category: 'food', ctbId: 'CTB-FOOD-005', mass: 0.30, volume: 0.0008, quantity: 6, status: 'incoming', criticality: 'medium' },
    { itemId: 'FOOD-0015', name: 'Peanut Butter Packets', category: 'food', ctbId: 'CTB-FOOD-005', mass: 0.05, volume: 0.0001, quantity: 20, status: 'incoming', criticality: 'low' },
    { itemId: 'WATER-0003', name: 'Potable Water Bag (2L)', category: 'water', ctbId: 'CTB-WATER-003', mass: 2.05, volume: 0.002, quantity: 6, status: 'incoming', criticality: 'critical' },
    { itemId: 'MED-0008', name: 'Epinephrine Auto-Injector', category: 'medical', ctbId: 'CTB-MED-003', mass: 0.10, volume: 0.0001, quantity: 2, status: 'incoming', criticality: 'critical', serialNumber: 'EPI-2026-01' },

    // Some consumed items (history)
    { itemId: 'FOOD-0020', name: 'Chicken Fajita (Thermo)', category: 'food', ctbId: 'CTB-FOOD-001', mass: 0.30, volume: 0.0008, quantity: 0, status: 'consumed', criticality: 'medium' },
    { itemId: 'FOOD-0021', name: 'Breakfast Sausage (Irrad)', category: 'food', ctbId: 'CTB-FOOD-002', mass: 0.22, volume: 0.0006, quantity: 0, status: 'consumed', criticality: 'medium' },
    { itemId: 'HYG-0010', name: 'No-Rinse Body Wipes (Pkg)', category: 'hygiene', ctbId: 'CTB-HYG-001', mass: 0.22, volume: 0.0005, quantity: 0, status: 'consumed', criticality: 'medium' },
  ];

  for (const item of items) {
    const ctb = ctbData.find(c => c.ctbId === item.ctbId)!;
    const locationPath = `${ctb.stackId}-P${ctb.position}-L${ctb.layer}`;
    const isConsumed = item.status === 'consumed';
    const isIncoming = item.status === 'incoming';
    const isDelivered = item.status === 'delivered';

    await prisma.inventoryItem.upsert({
      where: { itemId: item.itemId },
      update: {},
      create: {
        itemId: item.itemId,
        name: item.name,
        description: '',
        categoryName: item.category,
        status: item.status,
        ctbId: item.ctbId,
        stackId: ctb.stackId,
        position: ctb.position,
        layer: ctb.layer,
        locationPath,
        mass: item.mass,
        volume: item.volume,
        quantity: item.quantity,
        criticality: item.criticality,
        manufacturer: (item as any).manufacturer || null,
        partNumber: (item as any).partNumber || null,
        serialNumber: (item as any).serialNumber || null,
        loadedDate: isIncoming ? daysAgo(2) : daysAgo(18),
        deliveredDate: isDelivered ? daysAgo(16) : null,
        consumedDate: isConsumed ? daysAgo(Math.floor(Math.random() * 10) + 1) : null,
        expiryDate: item.category === 'food' ? new Date('2026-12-15') : null,
      },
    });
  }
  console.log(`Created ${items.length} inventory items`);

  // Item history entries for consumed items and some moves
  const historyEntries = [
    { itemId: 'FOOD-0020', action: 'loaded', timestamp: daysAgo(18), userId: 'j.park', notes: 'Loaded at KSC' },
    { itemId: 'FOOD-0020', action: 'delivered', timestamp: daysAgo(16), userId: 'r.garcia' },
    { itemId: 'FOOD-0020', action: 'consumed', timestamp: daysAgo(5), userId: 'r.garcia', notes: 'Day 13 dinner' },
    { itemId: 'FOOD-0021', action: 'loaded', timestamp: daysAgo(18), userId: 'j.park' },
    { itemId: 'FOOD-0021', action: 'consumed', timestamp: daysAgo(3), userId: 't.chen' },
    { itemId: 'HYG-0010', action: 'loaded', timestamp: daysAgo(18), userId: 'j.park' },
    { itemId: 'HYG-0010', action: 'consumed', timestamp: daysAgo(7), userId: 'k.mitchell' },
    { itemId: 'MISC-0001', action: 'loaded', timestamp: daysAgo(18), userId: 'j.park' },
    { itemId: 'MISC-0001', action: 'delivered', timestamp: daysAgo(16), userId: 'r.garcia', notes: 'Personal effects distributed' },
    { itemId: 'SCI-0001', action: 'loaded', timestamp: daysAgo(18), userId: 'j.park', notes: 'Fragile - handle with care' },
    { itemId: 'SCI-0001', action: 'inspected', timestamp: daysAgo(15), userId: 't.chen', notes: 'Post-launch inspection passed', timeTaken: 420 },
    { itemId: 'SPARE-0001', action: 'loaded', timestamp: daysAgo(18), userId: 'j.park' },
    { itemId: 'SPARE-0001', action: 'inspected', timestamp: daysAgo(14), userId: 'k.mitchell', notes: 'Verified seal integrity', timeTaken: 180 },
  ];

  for (const entry of historyEntries) {
    await prisma.itemHistoryEntry.create({
      data: {
        itemId: entry.itemId,
        action: entry.action,
        timestamp: entry.timestamp,
        userId: entry.userId || null,
        notes: entry.notes || null,
        timeTaken: (entry as any).timeTaken || null,
      },
    });
  }
  console.log(`Created ${historyEntries.length} history entries`);

  // Shipments
  await prisma.shipment.upsert({
    where: { manifestId: 'MNF-2025-014' },
    update: {},
    create: {
      manifestId: 'MNF-2025-014',
      destination: 'Gateway NRHO',
      priority: 'High',
      status: 'received',
      notes: 'Artemis IV crew resupply',
      createdAt: daysAgo(45),
      launchedAt: daysAgo(30),
      deliveredAt: daysAgo(18),
      receivedAt: daysAgo(17),
    },
  });

  await prisma.shipment.upsert({
    where: { manifestId: 'MNF-2026-001' },
    update: {},
    create: {
      manifestId: 'MNF-2026-001',
      destination: 'Gateway NRHO',
      priority: 'Normal',
      status: 'in-transit',
      notes: 'Scheduled resupply - food, water, medical',
      createdAt: daysAgo(14),
      launchedAt: daysAgo(5),
    },
  });

  await prisma.shipment.upsert({
    where: { manifestId: 'MNF-2026-002' },
    update: {},
    create: {
      manifestId: 'MNF-2026-002',
      destination: 'Gateway NRHO',
      priority: 'Normal',
      status: 'draft',
      notes: 'EVA equipment and lab consumables',
      createdAt: daysAgo(3),
    },
  });

  console.log('Created 3 shipments');

  // Sync metadata
  await prisma.syncMetadata.upsert({
    where: { id: 'global' },
    update: {},
    create: { id: 'global', currentVersion: 0 },
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
