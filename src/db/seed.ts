import { faker } from "@faker-js/faker";
import { db } from ".";
import { categories, products } from "./schema";

async function seed() {
  console.log("🌱 Start seeding...");

  // 1. Insert category
  const insertedCategories = await db
    .insert(categories)
    .values([
      { name: "Electronics", description: "Gadgets & devices" },
      { name: "Clothing", description: "Fashion and apparel" },
      { name: "Groceries", description: "Daily essentials" },
      { name: "Books", description: "Reading & education" },
      { name: "Toys", description: "Kids & fun stuff" },
    ])
    .returning();

  // 2. Insert product dummy
  const productData = Array.from({ length: 30 }).map(() => {
    const randomCategory =
      faker.helpers.arrayElement(insertedCategories) ?? null;

    return {
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      sku: faker.string.alphanumeric(10),
      barcode: faker.string.numeric(13),
      price: faker.commerce.price({ min: 10, max: 5000, dec: 2 }),
      cost: faker.commerce.price({ min: 5, max: 3000, dec: 2 }),
      stockQuantity: faker.number.int({ min: 0, max: 500 }),
      minStockLevel: faker.number.int({ min: 1, max: 50 }),
      categoryId: randomCategory?.id, // bisa null
      imageUrl: faker.image.urlPicsumPhotos({ width: 600, height: 600 }),
      isActive: faker.datatype.boolean(),
    };
  });

  await db.insert(products).values(productData);

  console.log("✅ Seeding done!");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error seeding:", err);
    process.exit(1);
  });
