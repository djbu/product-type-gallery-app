import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { invalidateRuleCache } from "../services/gallery.server";
import { invalidateStoreMetadata } from "../services/shopify-data.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  // Drop sessions + warm caches for the uninstalled shop.
  if (session) {
    await prisma.session.deleteMany({ where: { shop } });
  }
  invalidateRuleCache(shop);
  invalidateStoreMetadata(shop);

  return new Response();
};
