import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default categories
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
  console.log(`✅ Created ${categories.length} categories`);

  // Create stacks
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
  console.log(`✅ Created ${stacks.length} stacks`);

  // Create admin user with secure password
  const adminPasswordHash = await bcrypt.hash('dslm-admin-2025', 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      name: 'System Administrator',
      role: 'admin',
      currentLocation: 'Earth',
      passwordHash: adminPasswordHash,
    },
  });
  console.log('✅ Created admin user (username: admin)');

  // Initialize sync metadata
  await prisma.syncMetadata.upsert({
    where: { id: 'global' },
    update: {},
    create: { id: 'global', currentVersion: 0 },
  });
  console.log('✅ Initialized sync metadata');

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
