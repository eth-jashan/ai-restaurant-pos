import { PrismaClient, UserRole, SelectionType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo restaurant
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: 'demo-restaurant' },
    update: {},
    create: {
      name: 'The Spice Garden',
      slug: 'demo-restaurant',
      address: '123 Food Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      phone: '+91-9876543210',
      email: 'hello@spicegarden.com',
      gstin: '27AABCU9603R1ZM',
      fssaiNumber: '11521999000123',
      settings: {
        theme: 'default',
        taxInclusive: true,
        defaultTaxRate: 5,
        printKOT: true,
        printReceipt: true,
      },
    },
  });

  console.log(`✅ Created restaurant: ${restaurant.name}`);

  // Create demo users
  const hashedPassword = await bcrypt.hash('demo123', 10);

  const users = [
    {
      email: 'owner@spicegarden.com',
      phone: '9876543210',
      name: 'Raj Kumar',
      role: UserRole.OWNER,
      pin: '1234',
    },
    {
      email: 'manager@spicegarden.com',
      phone: '9876543211',
      name: 'Priya Sharma',
      role: UserRole.MANAGER,
      pin: '2345',
    },
    {
      email: 'cashier@spicegarden.com',
      phone: '9876543212',
      name: 'Amit Singh',
      role: UserRole.CASHIER,
      pin: '3456',
    },
    {
      email: 'waiter@spicegarden.com',
      phone: '9876543213',
      name: 'Vikram Patel',
      role: UserRole.WAITER,
      pin: '4567',
    },
  ];

  for (const userData of users) {
    await prisma.user.upsert({
      where: {
        restaurantId_email: {
          restaurantId: restaurant.id,
          email: userData.email,
        },
      },
      update: {},
      create: {
        restaurantId: restaurant.id,
        ...userData,
        passwordHash: hashedPassword,
      },
    });
  }

  console.log(`✅ Created ${users.length} users`);

  // Create categories
  const categories = [
    { name: 'Starters', sortOrder: 1 },
    { name: 'Main Course', sortOrder: 2 },
    { name: 'Breads', sortOrder: 3 },
    { name: 'Rice & Biryani', sortOrder: 4 },
    { name: 'Beverages', sortOrder: 5 },
    { name: 'Desserts', sortOrder: 6 },
  ];

  const createdCategories: Record<string, string> = {};

  for (const cat of categories) {
    const category = await prisma.category.upsert({
      where: {
        restaurantId_name: {
          restaurantId: restaurant.id,
          name: cat.name,
        },
      },
      update: {},
      create: {
        restaurantId: restaurant.id,
        name: cat.name,
        sortOrder: cat.sortOrder,
      },
    });
    createdCategories[cat.name] = category.id;
  }

  console.log(`✅ Created ${categories.length} categories`);

  // Create modifier groups
  const spiceLevelGroup = await prisma.modifierGroup.upsert({
    where: {
      restaurantId_name: {
        restaurantId: restaurant.id,
        name: 'Spice Level',
      },
    },
    update: {},
    create: {
      restaurantId: restaurant.id,
      name: 'Spice Level',
      displayName: 'How spicy would you like it?',
      selectionType: SelectionType.SINGLE,
      minSelection: 0,
      maxSelection: 1,
      isRequired: false,
      options: {
        create: [
          { name: 'Mild', price: 0, sortOrder: 1 },
          { name: 'Medium', price: 0, sortOrder: 2, isDefault: true },
          { name: 'Spicy', price: 0, sortOrder: 3 },
          { name: 'Extra Spicy', price: 0, sortOrder: 4 },
        ],
      },
    },
  });

  const extrasToppingsGroup = await prisma.modifierGroup.upsert({
    where: {
      restaurantId_name: {
        restaurantId: restaurant.id,
        name: 'Add-ons',
      },
    },
    update: {},
    create: {
      restaurantId: restaurant.id,
      name: 'Add-ons',
      displayName: 'Would you like any extras?',
      selectionType: SelectionType.MULTIPLE,
      minSelection: 0,
      maxSelection: 5,
      isRequired: false,
      options: {
        create: [
          { name: 'Extra Cheese', price: 30, sortOrder: 1 },
          { name: 'Extra Paneer', price: 40, sortOrder: 2 },
          { name: 'Extra Gravy', price: 20, sortOrder: 3 },
          { name: 'Butter Topping', price: 15, sortOrder: 4 },
        ],
      },
    },
  });

  console.log('✅ Created modifier groups');

  // Create menu items
  const menuItems = [
    // Starters
    { name: 'Paneer Tikka', category: 'Starters', price: 280, isVeg: true },
    { name: 'Chicken Tikka', category: 'Starters', price: 320, isVeg: false },
    { name: 'Veg Seekh Kebab', category: 'Starters', price: 220, isVeg: true },
    { name: 'Mutton Seekh Kebab', category: 'Starters', price: 380, isVeg: false },
    { name: 'Crispy Corn', category: 'Starters', price: 180, isVeg: true },
    { name: 'Tandoori Mushroom', category: 'Starters', price: 240, isVeg: true },

    // Main Course
    { name: 'Butter Chicken', category: 'Main Course', price: 380, isVeg: false },
    { name: 'Paneer Butter Masala', category: 'Main Course', price: 320, isVeg: true },
    { name: 'Dal Makhani', category: 'Main Course', price: 260, isVeg: true },
    { name: 'Kadhai Paneer', category: 'Main Course', price: 300, isVeg: true },
    { name: 'Chicken Kadhai', category: 'Main Course', price: 360, isVeg: false },
    { name: 'Palak Paneer', category: 'Main Course', price: 280, isVeg: true },
    { name: 'Mixed Veg Curry', category: 'Main Course', price: 240, isVeg: true },
    { name: 'Mutton Rogan Josh', category: 'Main Course', price: 450, isVeg: false },

    // Breads
    { name: 'Butter Naan', category: 'Breads', price: 50, isVeg: true },
    { name: 'Garlic Naan', category: 'Breads', price: 60, isVeg: true },
    { name: 'Cheese Naan', category: 'Breads', price: 80, isVeg: true },
    { name: 'Tandoori Roti', category: 'Breads', price: 30, isVeg: true },
    { name: 'Laccha Paratha', category: 'Breads', price: 50, isVeg: true },
    { name: 'Missi Roti', category: 'Breads', price: 40, isVeg: true },

    // Rice & Biryani
    { name: 'Steamed Rice', category: 'Rice & Biryani', price: 120, isVeg: true },
    { name: 'Jeera Rice', category: 'Rice & Biryani', price: 150, isVeg: true },
    { name: 'Veg Biryani', category: 'Rice & Biryani', price: 280, isVeg: true },
    { name: 'Chicken Biryani', category: 'Rice & Biryani', price: 340, isVeg: false },
    { name: 'Mutton Biryani', category: 'Rice & Biryani', price: 420, isVeg: false },
    { name: 'Paneer Biryani', category: 'Rice & Biryani', price: 300, isVeg: true },

    // Beverages
    { name: 'Masala Chai', category: 'Beverages', price: 40, isVeg: true },
    { name: 'Fresh Lime Soda', category: 'Beverages', price: 60, isVeg: true },
    { name: 'Mango Lassi', category: 'Beverages', price: 90, isVeg: true },
    { name: 'Sweet Lassi', category: 'Beverages', price: 70, isVeg: true },
    { name: 'Buttermilk', category: 'Beverages', price: 50, isVeg: true },
    { name: 'Cold Coffee', category: 'Beverages', price: 100, isVeg: true },

    // Desserts
    { name: 'Gulab Jamun', category: 'Desserts', price: 80, isVeg: true },
    { name: 'Rasmalai', category: 'Desserts', price: 100, isVeg: true },
    { name: 'Kheer', category: 'Desserts', price: 90, isVeg: true },
    { name: 'Ice Cream', category: 'Desserts', price: 70, isVeg: true },
    { name: 'Gajar Halwa', category: 'Desserts', price: 110, isVeg: true },
  ];

  for (let i = 0; i < menuItems.length; i++) {
    const item = menuItems[i];
    const categoryId = createdCategories[item.category];

    await prisma.menuItem.upsert({
      where: {
        restaurantId_name: {
          restaurantId: restaurant.id,
          name: item.name,
        },
      },
      update: {},
      create: {
        restaurantId: restaurant.id,
        categoryId,
        name: item.name,
        basePrice: item.price,
        isVeg: item.isVeg,
        taxRate: 5,
        sortOrder: i + 1,
        modifierLinks: {
          create:
            item.category !== 'Beverages' && item.category !== 'Desserts'
              ? [
                  { modifierGroupId: spiceLevelGroup.id, sortOrder: 1 },
                  { modifierGroupId: extrasToppingsGroup.id, sortOrder: 2 },
                ]
              : [],
        },
      },
    });
  }

  console.log(`✅ Created ${menuItems.length} menu items`);

  // Create tables
  const tables = [
    { name: 'T1', capacity: 2, section: 'Indoor' },
    { name: 'T2', capacity: 2, section: 'Indoor' },
    { name: 'T3', capacity: 4, section: 'Indoor' },
    { name: 'T4', capacity: 4, section: 'Indoor' },
    { name: 'T5', capacity: 6, section: 'Indoor' },
    { name: 'T6', capacity: 6, section: 'Indoor' },
    { name: 'T7', capacity: 8, section: 'Indoor' },
    { name: 'P1', capacity: 4, section: 'Patio' },
    { name: 'P2', capacity: 4, section: 'Patio' },
    { name: 'P3', capacity: 6, section: 'Patio' },
    { name: 'VIP1', capacity: 8, section: 'VIP' },
    { name: 'VIP2', capacity: 10, section: 'VIP' },
  ];

  for (const table of tables) {
    await prisma.restaurantTable.upsert({
      where: {
        restaurantId_name: {
          restaurantId: restaurant.id,
          name: table.name,
        },
      },
      update: {},
      create: {
        restaurantId: restaurant.id,
        ...table,
      },
    });
  }

  console.log(`✅ Created ${tables.length} tables`);

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📝 Demo Credentials:');
  console.log('   Email: owner@spicegarden.com');
  console.log('   Password: demo123');
  console.log('   PIN: 1234');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
