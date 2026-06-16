import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Override with: SEED_SHOP=your-store.myshopify.com npm run seed
const shop = process.env.SEED_SHOP || "example.myshopify.com";

const PLACEHOLDER_IMG = "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png";
const PLACEHOLDER_VID = "https://cdn.shopify.com/videos/c/o/v/placeholder.mp4";

async function main() {
  console.log(`Seeding gallery rules for shop: ${shop}`);

  // Clean prior seed data for this shop so the seed is idempotent.
  await prisma.galleryRule.deleteMany({ where: { shop } });

  // Rule 1 — high priority. Sleeve + "Pro" + Football & Premium tags.
  await prisma.galleryRule.create({
    data: {
      shop,
      name: "Pro Sleeve Gallery",
      priority: 100,
      media: {
        create: [
          { mediaType: "image", url: PLACEHOLDER_IMG, shopifyFileId: "gid://shopify/MediaImage/1001", sortOrder: 0 },
          { mediaType: "image", url: PLACEHOLDER_IMG, shopifyFileId: "gid://shopify/MediaImage/1002", sortOrder: 1 },
          { mediaType: "video", url: PLACEHOLDER_VID, shopifyFileId: "gid://shopify/Video/2001", sortOrder: 2 },
        ],
      },
      conditions: {
        create: [
          {
            productType: "Sleeve",
            titleContains: "Pro",
            tagsJson: JSON.stringify(["Football", "Premium"]),
          },
        ],
      },
    },
  });

  // Rule 2 — medium priority. Multiple conditions (OR): Spats, or Visor+Football.
  await prisma.galleryRule.create({
    data: {
      shop,
      name: "Accessories Gallery",
      priority: 50,
      media: {
        create: [
          { mediaType: "image", url: PLACEHOLDER_IMG, shopifyFileId: "gid://shopify/MediaImage/1003", sortOrder: 0 },
        ],
      },
      conditions: {
        create: [
          { productType: "Spats", titleContains: null, tagsJson: "[]" },
          { productType: "Visor", titleContains: null, tagsJson: JSON.stringify(["Football"]) },
        ],
      },
    },
  });

  // Rule 3 — low priority catch-all for any Sleeve.
  await prisma.galleryRule.create({
    data: {
      shop,
      name: "All Sleeves Default",
      priority: 10,
      media: {
        create: [
          { mediaType: "image", url: PLACEHOLDER_IMG, shopifyFileId: "gid://shopify/MediaImage/1004", sortOrder: 0 },
        ],
      },
      conditions: {
        create: [{ productType: "Sleeve", titleContains: null, tagsJson: "[]" }],
      },
    },
  });

  const count = await prisma.galleryRule.count({ where: { shop } });
  console.log(`Done. ${count} rules seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
