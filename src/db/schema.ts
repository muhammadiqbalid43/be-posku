import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  decimal,
  timestamp,
  boolean,
  uuid,
  pgEnum,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";

// ================= Enums =================
export const userRoleEnum = pgEnum("user_role", ["admin", "cashier"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "card"]);
export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "completed",
  "cancelled",
]);

// ================= Users =================
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("cashier"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
});

// ================= Categories =================
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (t) => ({
    byName: index("categories_name_idx").on(t.name),
  })
);

// ================= Products =================
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    sku: text("sku").unique(),
    barcode: text("barcode").unique(),
    price: decimal("price", { precision: 12, scale: 2 }).notNull(),
    cost: decimal("cost", { precision: 12, scale: 2 }),
    stockQuantity: integer("stock_quantity").notNull().default(0),
    minStockLevel: integer("min_stock_level").default(5),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (t) => ({
    byCategory: index("products_category_idx").on(t.categoryId),
    byName: index("products_name_idx").on(t.name),
    byBarcode: uniqueIndex("products_barcode_uidx").on(t.barcode),
    nonNegChecks: [
      check("price_non_negative", sql`${t.price} >= 0`),
      check("cost_non_negative", sql`${t.cost} IS NULL OR ${t.cost} >= 0`),
      check("stock_non_negative", sql`${t.stockQuantity} >= 0`),
    ],
  })
);

// ================= Transactions =================
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionNumber: text("transaction_number").notNull().unique(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
    taxAmount: decimal("tax_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    discountAmount: decimal("discount_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    total: decimal("total", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    amountPaid: decimal("amount_paid", { precision: 12, scale: 2 }).notNull(),
    changeAmount: decimal("change_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    status: transactionStatusEnum("status").notNull().default("pending"),
    customerEmail: text("customer_email"),
    receiptSent: boolean("receipt_sent").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (t) => ({
    byUserCreated: index("transactions_user_created_idx").on(
      t.userId,
      t.createdAt
    ),
    byCreated: index("transactions_created_idx").on(t.createdAt),
    nonNegChecks: [
      check("subtotal_non_negative", sql`${t.subtotal} >= 0`),
      check("total_non_negative", sql`${t.total} >= 0`),
      check("amount_paid_non_negative", sql`${t.amountPaid} >= 0`),
    ],
  })
);

// ================= Transaction Items =================
export const transactionItems = pgTable(
  "transaction_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id")
      .references(() => transactions.id, { onDelete: "cascade" })
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "restrict" })
      .notNull(),
    productName: text("product_name").notNull(), // snapshot at sale time
    quantity: integer("quantity").notNull(),
    unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
    lineTotal: decimal("line_total", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    byTx: index("transaction_items_tx_idx").on(t.transactionId),
    byProduct: index("transaction_items_product_idx").on(t.productId),
    nonNegChecks: [
      check("qty_non_negative", sql`${t.quantity} > 0`),
      check("line_total_non_negative", sql`${t.lineTotal} >= 0`),
    ],
  })
);

// ================= Store Settings (Singleton) =================
export const storeSettings = pgTable(
  "store_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    singleton: boolean("singleton").notNull().default(true),
    storeName: text("store_name").notNull(),
    storeAddress: text("store_address"),
    storePhone: text("store_phone"),
    storeEmail: text("store_email"),
    taxRate: decimal("tax_rate", { precision: 5, scale: 4 })
      .notNull()
      .default("0"),
    currency: text("currency").notNull().default("USD"),
    receiptFooter: text("receipt_footer"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (t) => ({
    oneRow: uniqueIndex("store_settings_singleton_uidx").on(t.singleton),
  })
);

// ================= Relations =================
export const usersRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  transactionItems: many(transactionItems),
}));

export const transactionsRelations = relations(
  transactions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [transactions.userId],
      references: [users.id],
    }),
    items: many(transactionItems),
  })
);

export const transactionItemsRelations = relations(
  transactionItems,
  ({ one }) => ({
    transaction: one(transactions, {
      fields: [transactionItems.transactionId],
      references: [transactions.id],
    }),
    product: one(products, {
      fields: [transactionItems.productId],
      references: [products.id],
    }),
  })
);

// ================= Types =================
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type NewTransactionItem = typeof transactionItems.$inferInsert;
export type StoreSetting = typeof storeSettings.$inferSelect;
export type NewStoreSetting = typeof storeSettings.$inferInsert;
