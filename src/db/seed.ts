import bcrypt from "bcryptjs";
import { db } from "./index";
import {
  categories,
  products,
  storeSettings,
  transactionItems,
  transactions,
  users,
} from "./schema";
import { eq, sql } from "drizzle-orm";

export async function seedDatabase() {
  console.log("🌱 Seeding database...");

  // Create default admin user
  const hashedPassword = await bcrypt.hash("admin123", 10);

  const [adminUser] = await db
    .insert(users)
    .values({
      username: "admin",
      email: "admin@pos.com",
      passwordHash: hashedPassword,
      role: "admin",
    })
    .returning();

  // Create default categories
  const [beverageCategory] = await db
    .insert(categories)
    .values({
      name: "Beverages",
      description: "Drinks and beverages",
    })
    .returning();

  const [snackCategory] = await db
    .insert(categories)
    .values({
      name: "Snacks",
      description: "Snacks and quick bites",
    })
    .returning();

  // Create sample products
  await db.insert(products).values([
    {
      name: "Coca Cola",
      description: "Soft drink 330ml",
      sku: "COKE-330",
      barcode: "123456789012",
      price: "2.50",
      cost: "1.20",
      stockQuantity: 100,
      categoryId: beverageCategory.id,
    },
    {
      name: "Water Bottle",
      description: "Pure water 500ml",
      sku: "WATER-500",
      barcode: "123456789013",
      price: "1.00",
      cost: "0.40",
      stockQuantity: 200,
      categoryId: beverageCategory.id,
    },
    {
      name: "Chips",
      description: "Potato chips 150g",
      sku: "CHIPS-150",
      barcode: "123456789014",
      price: "3.00",
      cost: "1.50",
      stockQuantity: 50,
      categoryId: snackCategory.id,
    },
  ]);

  // Create store settings
  await db.insert(storeSettings).values({
    storeName: "My POS Store",
    storeAddress: "123 Main Street, City, State 12345",
    storePhone: "+1-555-0123",
    storeEmail: "contact@pos.com",
    taxRate: "0.0875", // 8.75%
    currency: "USD",
    receiptFooter: "Thank you for your business!",
  });

  console.log("✅ Database seeded successfully!");
}

// Common database queries

// User queries
export async function getUserByUsername(username: string) {
  return await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.username, username),
  });
}

// Product queries
export async function getAllProducts(isActive = true) {
  return await db.query.products.findMany({
    where: (products, { eq }) => eq(products.isActive, isActive),
    with: {
      category: true,
    },
  });
}

export async function getProductByBarcode(barcode: string) {
  return await db.query.products.findFirst({
    where: (products, { eq, and }) =>
      and(eq(products.barcode, barcode), eq(products.isActive, true)),
    with: {
      category: true,
    },
  });
}

export async function searchProducts(searchTerm: string) {
  return await db.query.products.findMany({
    where: (products, { ilike, or, eq, and }) =>
      and(
        eq(products.isActive, true),
        or(
          ilike(products.name, `%${searchTerm}%`),
          ilike(products.sku, `%${searchTerm}%`),
          ilike(products.barcode, `%${searchTerm}%`)
        )
      ),
    with: {
      category: true,
    },
  });
}

// Transaction queries
export async function createTransaction(transactionData: any, items: any[]) {
  return await db.transaction(async (tx) => {
    // Create transaction
    const [transaction] = await tx
      .insert(transactions)
      .values(transactionData)
      .returning();

    // Create transaction items
    const transactionItemsData = items.map((item) => ({
      ...item,
      transactionId: transaction.id,
    }));

    await tx.insert(transactionItems).values(transactionItemsData);

    // Update product stock
    for (const item of items) {
      await tx
        .update(products)
        .set({
          stockQuantity: sql`stock_quantity - ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(products.id, item.productId));
    }

    return transaction;
  });
}

export async function getDailyTransactions(date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return await db.query.transactions.findMany({
    where: (transactions, { between, eq, and }) =>
      and(
        between(transactions.createdAt, startOfDay, endOfDay),
        eq(transactions.status, "completed")
      ),
    with: {
      items: {
        with: {
          product: true,
        },
      },
      user: true,
    },
  });
}

// Settings queries
export async function getStoreSettings() {
  return await db.query.storeSettings.findFirst();
}
