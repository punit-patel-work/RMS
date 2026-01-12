import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL not set');
  }

  const pool = new Pool({ connectionString });

  console.log('🌱 Starting database seed...');

  // Hash password
  const hashedPassword = await bcrypt.hash('password123', 10);

  try {
    // Create Allergies
    await pool.query(`
      INSERT INTO allergies (id, name, badge) VALUES
        ('allergy-gluten', 'Gluten', 'amber'),
        ('allergy-nuts', 'Nuts', 'orange'),
        ('allergy-dairy', 'Dairy', 'blue'),
        ('allergy-shellfish', 'Shellfish', 'red'),
        ('allergy-eggs', 'Eggs', 'yellow'),
        ('allergy-soy', 'Soy', 'purple'),
        ('allergy-fish', 'Fish', 'teal')
      ON CONFLICT (name) DO NOTHING
    `);
    console.log('✅ Created allergies');

    // Create Users
    await pool.query(`
      INSERT INTO users (id, email, password, name, role, "createdAt", "updatedAt") VALUES
        ('user-owner', 'owner@rms.com', $1, 'John Owner', 'OWNER', NOW(), NOW()),
        ('user-supervisor', 'supervisor@rms.com', $1, 'Sarah Supervisor', 'SUPERVISOR', NOW(), NOW()),
        ('user-floor', 'floor@rms.com', $1, 'Mike Waiter', 'FLOOR_STAFF', NOW(), NOW()),
        ('user-kitchen', 'kitchen@rms.com', $1, 'Chef Gordon', 'KITCHEN_STAFF', NOW(), NOW())
      ON CONFLICT (email) DO NOTHING
    `, [hashedPassword]);
    console.log('✅ Created users');

    // Create Categories - Expanded cuisines
    await pool.query(`
      INSERT INTO categories (id, name, description, "order", "createdAt", "updatedAt") VALUES
        ('starters', 'Starters', 'Appetizers and small plates to begin', 1, NOW(), NOW()),
        ('soups-salads', 'Soups & Salads', 'Fresh and light options', 2, NOW(), NOW()),
        ('italian', 'Italian', 'Classic Italian favorites', 3, NOW(), NOW()),
        ('asian', 'Asian Fusion', 'Asian-inspired dishes', 4, NOW(), NOW()),
        ('mexican', 'Mexican', 'Authentic Mexican cuisine', 5, NOW(), NOW()),
        ('american', 'American Classics', 'Traditional American comfort food', 6, NOW(), NOW()),
        ('seafood', 'Seafood', 'Fresh from the ocean', 7, NOW(), NOW()),
        ('steaks', 'Steaks & Grills', 'Premium cuts and grilled meats', 8, NOW(), NOW()),
        ('desserts', 'Desserts', 'Sweet endings', 9, NOW(), NOW()),
        ('drinks', 'Drinks', 'Beverages and refreshments', 10, NOW(), NOW()),
        ('ice-cream', 'Ice Cream', 'Premium ice cream and frozen treats', 11, NOW(), NOW()),
        ('frozen-yogurt', 'Frozen Yogurt', 'Fresh and healthy frozen yogurt', 12, NOW(), NOW()),
        ('quick-grab', 'Quick Grab', 'Grab and go items - no wait!', 13, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('✅ Created categories');

    // Create Menu Items - Expanded with many cuisines and printStation
    await pool.query(`
      INSERT INTO menu_items (id, name, description, price, available, "isSpecial", "isPromotional", "promotionalPrice", "isFeatured", "printStation", "categoryId", allergies, "createdAt", "updatedAt") VALUES
        -- Starters (KITCHEN)
        ('item-1', 'Bruschetta', 'Toasted bread topped with fresh tomatoes, garlic, and basil', 8.99, true, false, false, NULL, true, 'KITCHEN', 'starters', ARRAY['allergy-gluten'], NOW(), NOW()),
        ('item-2', 'Garlic Shrimp', 'Sautéed shrimp in garlic butter sauce', 14.99, true, false, false, NULL, false, 'KITCHEN', 'starters', ARRAY['allergy-shellfish'], NOW(), NOW()),
        ('item-3', 'Mozzarella Sticks', 'Crispy breaded mozzarella with marinara', 9.99, true, false, false, NULL, false, 'KITCHEN', 'starters', ARRAY['allergy-gluten', 'allergy-dairy'], NOW(), NOW()),
        ('item-4', 'Chicken Wings', 'Crispy wings with choice of sauce', 13.99, true, true, false, NULL, true, 'KITCHEN', 'starters', ARRAY[]::text[], NOW(), NOW()),
        ('item-5', 'Spring Rolls', 'Crispy vegetable spring rolls with sweet chili', 7.99, true, false, false, NULL, false, 'KITCHEN', 'starters', ARRAY['allergy-gluten', 'allergy-soy'], NOW(), NOW()),
        ('item-6', 'Nachos Supreme', 'Loaded nachos with cheese, jalapeños, and guacamole', 12.99, true, false, false, NULL, false, 'KITCHEN', 'starters', ARRAY['allergy-dairy'], NOW(), NOW()),
        
        -- Soups & Salads (KITCHEN)
        ('item-7', 'Caesar Salad', 'Romaine lettuce, parmesan, croutons, Caesar dressing', 11.99, true, false, false, NULL, false, 'KITCHEN', 'soups-salads', ARRAY['allergy-gluten', 'allergy-dairy', 'allergy-eggs'], NOW(), NOW()),
        ('item-8', 'Tomato Basil Soup', 'Creamy tomato soup with fresh basil', 7.99, true, false, false, NULL, false, 'KITCHEN', 'soups-salads', ARRAY['allergy-dairy'], NOW(), NOW()),
        ('item-9', 'Greek Salad', 'Fresh vegetables with feta cheese and olives', 10.99, true, false, false, NULL, false, 'KITCHEN', 'soups-salads', ARRAY['allergy-dairy'], NOW(), NOW()),
        ('item-10', 'Clam Chowder', 'New England style clam chowder', 9.99, true, true, false, NULL, false, 'KITCHEN', 'soups-salads', ARRAY['allergy-shellfish', 'allergy-dairy'], NOW(), NOW()),
        
        -- Italian (KITCHEN)
        ('item-11', 'Spaghetti Carbonara', 'Classic carbonara with bacon and parmesan', 18.99, true, false, false, NULL, true, 'KITCHEN', 'italian', ARRAY['allergy-gluten', 'allergy-dairy', 'allergy-eggs'], NOW(), NOW()),
        ('item-12', 'Margherita Pizza', '12" pizza with fresh mozzarella and basil', 16.99, true, false, true, 13.99, true, 'KITCHEN', 'italian', ARRAY['allergy-gluten', 'allergy-dairy'], NOW(), NOW()),
        ('item-13', 'Chicken Alfredo', 'Fettuccine in creamy alfredo with grilled chicken', 19.99, true, false, false, NULL, false, 'KITCHEN', 'italian', ARRAY['allergy-gluten', 'allergy-dairy'], NOW(), NOW()),
        ('item-14', 'Lasagna', 'Layered pasta with meat sauce and ricotta', 17.99, true, true, false, NULL, false, 'KITCHEN', 'italian', ARRAY['allergy-gluten', 'allergy-dairy'], NOW(), NOW()),
        ('item-15', 'Risotto Mushroom', 'Creamy arborio rice with wild mushrooms', 16.99, true, false, false, NULL, false, 'KITCHEN', 'italian', ARRAY['allergy-dairy'], NOW(), NOW()),
        
        -- Asian Fusion (KITCHEN)
        ('item-16', 'Pad Thai', 'Rice noodles with shrimp, peanuts, and tamarind sauce', 17.99, true, false, false, NULL, true, 'KITCHEN', 'asian', ARRAY['allergy-nuts', 'allergy-shellfish', 'allergy-eggs', 'allergy-soy'], NOW(), NOW()),
        ('item-17', 'Teriyaki Salmon', 'Grilled salmon with teriyaki glaze and rice', 22.99, true, true, false, NULL, true, 'KITCHEN', 'asian', ARRAY['allergy-fish', 'allergy-soy'], NOW(), NOW()),
        ('item-18', 'Kung Pao Chicken', 'Spicy chicken with peanuts and vegetables', 16.99, true, false, false, NULL, false, 'KITCHEN', 'asian', ARRAY['allergy-nuts', 'allergy-soy'], NOW(), NOW()),
        ('item-19', 'Beef Fried Rice', 'Wok-fried rice with tender beef and vegetables', 14.99, true, false, false, NULL, false, 'KITCHEN', 'asian', ARRAY['allergy-eggs', 'allergy-soy'], NOW(), NOW()),
        ('item-20', 'Thai Green Curry', 'Coconut curry with vegetables and jasmine rice', 15.99, true, false, true, 12.99, false, 'KITCHEN', 'asian', ARRAY[]::text[], NOW(), NOW()),
        
        -- Mexican (KITCHEN)
        ('item-21', 'Beef Tacos', 'Three soft tacos with seasoned beef and salsa', 13.99, true, false, false, NULL, true, 'KITCHEN', 'mexican', ARRAY['allergy-gluten', 'allergy-dairy'], NOW(), NOW()),
        ('item-22', 'Chicken Burrito', 'Large flour tortilla with chicken, rice, and beans', 14.99, true, false, false, NULL, false, 'KITCHEN', 'mexican', ARRAY['allergy-gluten', 'allergy-dairy'], NOW(), NOW()),
        ('item-23', 'Quesadilla', 'Grilled tortilla with cheese and choice of meat', 12.99, true, false, false, NULL, false, 'KITCHEN', 'mexican', ARRAY['allergy-gluten', 'allergy-dairy'], NOW(), NOW()),
        ('item-24', 'Fish Tacos', 'Battered fish with cabbage slaw and chipotle mayo', 15.99, true, true, false, NULL, false, 'KITCHEN', 'mexican', ARRAY['allergy-gluten', 'allergy-fish', 'allergy-eggs'], NOW(), NOW()),
        ('item-25', 'Enchiladas', 'Three enchiladas with red sauce and melted cheese', 14.99, true, false, false, NULL, false, 'KITCHEN', 'mexican', ARRAY['allergy-gluten', 'allergy-dairy'], NOW(), NOW()),
        
        -- American Classics (KITCHEN)
        ('item-26', 'Classic Burger', '8oz beef patty with lettuce, tomato, and special sauce', 15.99, true, false, false, NULL, true, 'KITCHEN', 'american', ARRAY['allergy-gluten', 'allergy-dairy', 'allergy-eggs'], NOW(), NOW()),
        ('item-27', 'BBQ Ribs', 'Half rack of pork ribs with BBQ sauce and coleslaw', 24.99, true, true, false, NULL, true, 'KITCHEN', 'american', ARRAY[]::text[], NOW(), NOW()),
        ('item-28', 'Chicken Sandwich', 'Crispy chicken breast with pickles and mayo', 13.99, true, false, false, NULL, false, 'KITCHEN', 'american', ARRAY['allergy-gluten', 'allergy-eggs'], NOW(), NOW()),
        ('item-29', 'Mac and Cheese', 'Creamy three-cheese macaroni', 11.99, true, false, false, NULL, false, 'KITCHEN', 'american', ARRAY['allergy-gluten', 'allergy-dairy'], NOW(), NOW()),
        ('item-30', 'Hot Dog', 'All-beef hot dog with classic toppings', 8.99, true, false, false, NULL, false, 'KITCHEN', 'american', ARRAY['allergy-gluten'], NOW(), NOW()),
        
        -- Seafood (KITCHEN)
        ('item-31', 'Grilled Salmon', 'Fresh Atlantic salmon with lemon dill sauce', 24.99, true, false, false, NULL, true, 'KITCHEN', 'seafood', ARRAY['allergy-fish'], NOW(), NOW()),
        ('item-32', 'Lobster Tail', '8oz cold water lobster tail with butter', 39.99, true, true, false, NULL, true, 'KITCHEN', 'seafood', ARRAY['allergy-shellfish', 'allergy-dairy'], NOW(), NOW()),
        ('item-33', 'Fish and Chips', 'Beer-battered cod with fries and tartar sauce', 17.99, true, false, false, NULL, false, 'KITCHEN', 'seafood', ARRAY['allergy-gluten', 'allergy-fish', 'allergy-eggs'], NOW(), NOW()),
        ('item-34', 'Shrimp Scampi', 'Sautéed shrimp in garlic wine sauce over linguine', 22.99, true, false, true, 18.99, false, 'KITCHEN', 'seafood', ARRAY['allergy-shellfish', 'allergy-gluten', 'allergy-dairy'], NOW(), NOW()),
        ('item-35', 'Crab Cakes', 'Two jumbo lump crab cakes with remoulade', 19.99, true, false, false, NULL, false, 'KITCHEN', 'seafood', ARRAY['allergy-shellfish', 'allergy-eggs'], NOW(), NOW()),
        
        -- Steaks & Grills (KITCHEN)
        ('item-36', 'Ribeye Steak', '12oz prime ribeye with herb butter', 34.99, true, true, false, NULL, true, 'KITCHEN', 'steaks', ARRAY['allergy-dairy'], NOW(), NOW()),
        ('item-37', 'Filet Mignon', '8oz center-cut filet mignon', 38.99, true, true, false, NULL, true, 'KITCHEN', 'steaks', ARRAY[]::text[], NOW(), NOW()),
        ('item-38', 'NY Strip', '10oz New York strip steak', 29.99, true, false, false, NULL, false, 'KITCHEN', 'steaks', ARRAY[]::text[], NOW(), NOW()),
        ('item-39', 'Grilled Chicken Breast', 'Herb-marinated chicken breast', 18.99, true, false, false, NULL, false, 'KITCHEN', 'steaks', ARRAY[]::text[], NOW(), NOW()),
        ('item-40', 'Lamb Chops', 'Four New Zealand lamb chops with mint sauce', 32.99, true, true, false, NULL, false, 'KITCHEN', 'steaks', ARRAY[]::text[], NOW(), NOW()),
        
        -- Desserts (DESSERT station)
        ('item-41', 'Chocolate Lava Cake', 'Warm chocolate cake with molten center', 9.99, true, true, false, NULL, true, 'DESSERT', 'desserts', ARRAY['allergy-gluten', 'allergy-dairy', 'allergy-eggs'], NOW(), NOW()),
        ('item-42', 'Tiramisu', 'Classic Italian coffee dessert', 8.99, true, false, false, NULL, true, 'DESSERT', 'desserts', ARRAY['allergy-gluten', 'allergy-dairy', 'allergy-eggs'], NOW(), NOW()),
        ('item-43', 'Cheesecake', 'New York style with strawberry topping', 8.99, true, false, false, NULL, false, 'DESSERT', 'desserts', ARRAY['allergy-gluten', 'allergy-dairy', 'allergy-eggs'], NOW(), NOW()),
        ('item-44', 'Ice Cream Sundae', 'Three scoops with hot fudge and whipped cream', 7.99, true, false, false, NULL, false, 'DESSERT', 'desserts', ARRAY['allergy-dairy', 'allergy-nuts'], NOW(), NOW()),
        ('item-45', 'Apple Pie', 'Warm apple pie with vanilla ice cream', 7.99, true, false, false, NULL, false, 'DESSERT', 'desserts', ARRAY['allergy-gluten', 'allergy-dairy'], NOW(), NOW()),
        
        -- Drinks (BAR station)
        ('item-46', 'House Lemonade', 'Fresh squeezed lemonade with mint', 4.99, true, false, false, NULL, true, 'BAR', 'drinks', ARRAY[]::text[], NOW(), NOW()),
        ('item-47', 'Iced Tea', 'Fresh brewed iced tea, sweetened or unsweetened', 3.99, true, false, false, NULL, false, 'BAR', 'drinks', ARRAY[]::text[], NOW(), NOW()),
        ('item-48', 'Soft Drinks', 'Coke, Sprite, Fanta, or Diet Coke', 2.99, true, false, false, NULL, false, 'NO_PRINT', 'drinks', ARRAY[]::text[], NOW(), NOW()),
        ('item-49', 'Coffee', 'Fresh brewed coffee with refills', 3.49, true, false, false, NULL, false, 'BAR', 'drinks', ARRAY[]::text[], NOW(), NOW()),
        ('item-50', 'Milkshake', 'Chocolate, vanilla, or strawberry', 6.99, true, false, false, NULL, false, 'DESSERT', 'drinks', ARRAY['allergy-dairy'], NOW(), NOW()),
        ('item-51', 'Sparkling Water', 'Perrier or San Pellegrino', 3.99, true, false, false, NULL, false, 'NO_PRINT', 'drinks', ARRAY[]::text[], NOW(), NOW()),
        ('item-52', 'Fresh Orange Juice', 'Freshly squeezed orange juice', 5.99, true, false, false, NULL, false, 'BAR', 'drinks', ARRAY[]::text[], NOW(), NOW()),
        
        -- Ice Cream (NO_PRINT - Quick Sale)
        ('item-53', 'Vanilla Scoop', 'Premium vanilla ice cream, single scoop', 3.99, true, false, false, NULL, false, 'NO_PRINT', 'ice-cream', ARRAY['allergy-dairy'], NOW(), NOW()),
        ('item-54', 'Chocolate Scoop', 'Rich chocolate ice cream, single scoop', 3.99, true, false, false, NULL, false, 'NO_PRINT', 'ice-cream', ARRAY['allergy-dairy'], NOW(), NOW()),
        ('item-55', 'Strawberry Scoop', 'Fresh strawberry ice cream, single scoop', 3.99, true, false, false, NULL, false, 'NO_PRINT', 'ice-cream', ARRAY['allergy-dairy'], NOW(), NOW()),
        ('item-56', 'Mint Chip Scoop', 'Refreshing mint with chocolate chips', 4.49, true, false, false, NULL, false, 'NO_PRINT', 'ice-cream', ARRAY['allergy-dairy'], NOW(), NOW()),
        ('item-57', 'Cookie Dough Scoop', 'Vanilla with cookie dough pieces', 4.49, true, false, false, NULL, true, 'NO_PRINT', 'ice-cream', ARRAY['allergy-dairy', 'allergy-gluten', 'allergy-eggs'], NOW(), NOW()),
        ('item-58', 'Double Scoop Cup', 'Any two flavors in a cup', 6.99, true, false, false, NULL, false, 'NO_PRINT', 'ice-cream', ARRAY['allergy-dairy'], NOW(), NOW()),
        ('item-59', 'Triple Scoop Cone', 'Any three flavors on a waffle cone', 8.99, true, false, false, NULL, false, 'NO_PRINT', 'ice-cream', ARRAY['allergy-dairy', 'allergy-gluten'], NOW(), NOW()),
        ('item-60', 'Ice Cream Float', 'Ice cream in your choice of soda', 5.99, true, false, false, NULL, false, 'NO_PRINT', 'ice-cream', ARRAY['allergy-dairy'], NOW(), NOW()),
        
        -- Frozen Yogurt (NO_PRINT - Quick Sale)
        ('item-61', 'Plain Yogurt Cup', 'Creamy plain frozen yogurt, small', 4.49, true, false, false, NULL, false, 'NO_PRINT', 'frozen-yogurt', ARRAY['allergy-dairy'], NOW(), NOW()),
        ('item-62', 'Berry Blast Yogurt', 'Mixed berry frozen yogurt', 4.99, true, false, false, NULL, true, 'NO_PRINT', 'frozen-yogurt', ARRAY['allergy-dairy'], NOW(), NOW()),
        ('item-63', 'Mango Tango Yogurt', 'Tropical mango frozen yogurt', 4.99, true, false, false, NULL, false, 'NO_PRINT', 'frozen-yogurt', ARRAY['allergy-dairy'], NOW(), NOW()),
        ('item-64', 'Greek Honey Yogurt', 'Greek-style with honey drizzle', 5.49, true, false, false, NULL, false, 'NO_PRINT', 'frozen-yogurt', ARRAY['allergy-dairy'], NOW(), NOW()),
        ('item-65', 'Yogurt Parfait', 'Layered with granola and fresh fruits', 6.99, true, false, false, NULL, true, 'NO_PRINT', 'frozen-yogurt', ARRAY['allergy-dairy', 'allergy-gluten', 'allergy-nuts'], NOW(), NOW()),
        
        -- Quick Grab (NO_PRINT - Instant Sales)
        ('item-66', 'Bottled Water', 'Purified spring water, 500ml', 1.99, true, false, false, NULL, false, 'NO_PRINT', 'quick-grab', ARRAY[]::text[], NOW(), NOW()),
        ('item-67', 'Energy Drink', 'Red Bull or Monster', 3.99, true, false, false, NULL, false, 'NO_PRINT', 'quick-grab', ARRAY[]::text[], NOW(), NOW()),
        ('item-68', 'Chips', 'Assorted potato chips bag', 2.49, true, false, false, NULL, false, 'NO_PRINT', 'quick-grab', ARRAY[]::text[], NOW(), NOW()),
        ('item-69', 'Candy Bar', 'Assorted chocolate bars', 1.99, true, false, false, NULL, false, 'NO_PRINT', 'quick-grab', ARRAY[]::text[], NOW(), NOW()),
        ('item-70', 'Protein Bar', 'Healthy protein snack bar', 3.49, true, false, false, NULL, false, 'NO_PRINT', 'quick-grab', ARRAY['allergy-nuts', 'allergy-dairy'], NOW(), NOW()),
        ('item-71', 'Fresh Cookie', 'Freshly baked chocolate chip cookie', 2.49, true, false, false, NULL, true, 'NO_PRINT', 'quick-grab', ARRAY['allergy-gluten', 'allergy-dairy', 'allergy-eggs', 'allergy-nuts'], NOW(), NOW()),
        ('item-72', 'Fruit Cup', 'Fresh cut seasonal fruits', 4.99, true, false, false, NULL, false, 'NO_PRINT', 'quick-grab', ARRAY[]::text[], NOW(), NOW()),
        ('item-73', 'Iced Coffee Bottle', 'Cold brew coffee bottle', 3.99, true, false, false, NULL, false, 'NO_PRINT', 'quick-grab', ARRAY['allergy-dairy'], NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('✅ Created menu items');

    // Create Tables
    await pool.query(`
      INSERT INTO tables (id, number, capacity, status, "createdAt", "updatedAt") VALUES
        ('table-1', 1, 2, 'VACANT', NOW(), NOW()),
        ('table-2', 2, 2, 'VACANT', NOW(), NOW()),
        ('table-3', 3, 4, 'VACANT', NOW(), NOW()),
        ('table-4', 4, 4, 'VACANT', NOW(), NOW()),
        ('table-5', 5, 4, 'VACANT', NOW(), NOW()),
        ('table-6', 6, 6, 'VACANT', NOW(), NOW()),
        ('table-7', 7, 6, 'VACANT', NOW(), NOW()),
        ('table-8', 8, 8, 'VACANT', NOW(), NOW()),
        ('table-9', 9, 4, 'VACANT', NOW(), NOW()),
        ('table-10', 10, 4, 'VACANT', NOW(), NOW())
      ON CONFLICT (number) DO NOTHING
    `);
    console.log('✅ Created tables');

    // Create Promotions - Permanent deals (end date far in future)
    await pool.query(`
      INSERT INTO promotions (id, name, description, type, value, "bundlePrice", "startDate", "endDate", "isActive", "createdById", "createdAt", "updatedAt") VALUES
        ('promo-1', 'Meal Deal', 'Bruschetta + House Lemonade combo', 'BUNDLE', 0, 12.99, '2024-01-01', '2099-12-31', true, 'user-owner', NOW(), NOW()),
        ('promo-2', 'Burger Combo', 'Classic Burger + Soft Drink + Fries', 'BUNDLE', 0, 18.99, '2024-01-01', '2099-12-31', true, 'user-owner', NOW(), NOW()),
        ('promo-3', 'Italian Night', 'Margherita Pizza + Caesar Salad + Soft Drink', 'BUNDLE', 0, 24.99, '2024-01-01', '2099-12-31', true, 'user-owner', NOW(), NOW()),
        ('promo-4', 'Taco Tuesday Special', '3 Beef Tacos + Nachos Supreme + House Lemonade', 'BUNDLE', 0, 22.99, '2024-01-01', '2099-12-31', true, 'user-owner', NOW(), NOW()),
        ('promo-5', 'Surf & Turf', 'Ribeye Steak + Garlic Shrimp', 'BUNDLE', 0, 44.99, '2024-01-01', '2099-12-31', true, 'user-owner', NOW(), NOW()),
        ('promo-6', 'Date Night', 'Two Ribeye Steaks + Two House Lemonades + Chocolate Lava Cake', 'BUNDLE', 0, 74.99, '2024-01-01', '2099-12-31', true, 'user-owner', NOW(), NOW()),
        ('promo-7', 'Asian Feast', 'Pad Thai + Spring Rolls + Thai Green Curry', 'BUNDLE', 0, 34.99, '2024-01-01', '2099-12-31', true, 'user-owner', NOW(), NOW()),
        ('promo-8', 'Family Platter', 'BBQ Ribs + Chicken Wings + Mac and Cheese + 4 Soft Drinks', 'BUNDLE', 0, 49.99, '2024-01-01', '2099-12-31', true, 'user-owner', NOW(), NOW()),
        ('promo-9', 'Dessert Duo', 'Chocolate Lava Cake + Tiramisu', 'BUNDLE', 0, 14.99, '2024-01-01', '2099-12-31', true, 'user-owner', NOW(), NOW()),
        ('promo-10', 'Seafood Lovers', 'Lobster Tail + Grilled Salmon + Clam Chowder', 'BUNDLE', 0, 59.99, '2024-01-01', '2099-12-31', true, 'user-owner', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('✅ Created promotions');

    // Link promotions to menu items
    await pool.query(`
      INSERT INTO "_MenuItemToPromotion" ("A", "B") VALUES
        -- Meal Deal (Bruschetta + House Lemonade)
        ('item-1', 'promo-1'),
        ('item-46', 'promo-1'),
        -- Burger Combo (Burger + Soft Drink - fries not in menu, but value deal)
        ('item-26', 'promo-2'),
        ('item-48', 'promo-2'),
        -- Italian Night (Pizza + Caesar + Drink)
        ('item-12', 'promo-3'),
        ('item-7', 'promo-3'),
        ('item-48', 'promo-3'),
        -- Taco Tuesday (Tacos + Nachos + Lemonade)
        ('item-21', 'promo-4'),
        ('item-6', 'promo-4'),
        ('item-46', 'promo-4'),
        -- Surf & Turf (Ribeye + Shrimp)
        ('item-36', 'promo-5'),
        ('item-2', 'promo-5'),
        -- Date Night (2 Ribeyes + 2 Lemonades + Dessert)
        ('item-36', 'promo-6'),
        ('item-46', 'promo-6'),
        ('item-41', 'promo-6'),
        -- Asian Feast (Pad Thai + Spring Rolls + Curry)
        ('item-16', 'promo-7'),
        ('item-5', 'promo-7'),
        ('item-20', 'promo-7'),
        -- Family Platter (Ribs + Wings + Mac + Drinks)
        ('item-27', 'promo-8'),
        ('item-4', 'promo-8'),
        ('item-29', 'promo-8'),
        ('item-48', 'promo-8'),
        -- Dessert Duo (Lava Cake + Tiramisu)
        ('item-41', 'promo-9'),
        ('item-42', 'promo-9'),
        -- Seafood Lovers (Lobster + Salmon + Chowder)
        ('item-32', 'promo-10'),
        ('item-31', 'promo-10'),
        ('item-10', 'promo-10')
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Linked promotions to menu items');

    console.log('🎉 Database seed completed successfully!');
    console.log('\n📧 Test Accounts:');
    console.log('  Owner:      owner@rms.com / password123');
    console.log('  Supervisor: supervisor@rms.com / password123');
    console.log('  Floor:      floor@rms.com / password123');
    console.log('  Kitchen:    kitchen@rms.com / password123');
    console.log('\n🍽️  Menu: 52 items across 10 categories');
    console.log('🎁 Promotions: 10 permanent bundle deals');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
