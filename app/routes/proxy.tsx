import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
  evaluateGalleryRules,
  type ProductContext,
} from "../services/gallery.server";

/**
 * App Proxy endpoint.
 *
 * Storefront URL:  /apps/gallery-media?productId=<id>
 * Shopify proxies it here ({app}/proxy) and signs the request; we verify with
 * authenticate.public.appProxy.
 *
 * The theme block SHOULD pass product attributes available in Liquid
 * (productType, title, tags) so we evaluate purely against cached rules with
 * zero GraphQL calls — the <100ms hot path. If they're missing we fall back to
 * one Admin GraphQL lookup for just this product (never a full scan).
 *
 * Returns: { images: [...], videos: [...] }
 */

const PRODUCT_QUERY = `#graphql
  query ProductForGallery($id: ID!) {
    product(id: $id) {
      productType
      title
      tags
    }
  }`;

function toGid(productId: string) {
  return productId.startsWith("gid://")
    ? productId
    : `gid://shopify/Product/${productId}`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.public.appProxy(request);
  if (!session || !admin) {
    return json({ images: [], videos: [] }, { status: 401 });
  }

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  if (!productId) {
    return json(
      { error: "productId is required", images: [], videos: [] },
      { status: 400 },
    );
  }

  // Prefer attributes supplied by the theme (no API cost).
  let productType = url.searchParams.get("productType") ?? undefined;
  let title = url.searchParams.get("title") ?? undefined;
  const tagsParam = url.searchParams.get("tags");
  let tags = tagsParam
    ? tagsParam.split(",").map((t) => t.trim()).filter(Boolean)
    : undefined;

  // Fallback: fetch this single product if the theme didn't pass attributes.
  if (productType === undefined || title === undefined || tags === undefined) {
    const res = await admin.graphql(PRODUCT_QUERY, {
      variables: { id: toGid(productId) },
    });
    const body = await res.json();
    const product = body?.data?.product;
    if (!product) {
      return json({ images: [], videos: [] });
    }
    productType = productType ?? product.productType ?? "";
    title = title ?? product.title ?? "";
    tags = tags ?? product.tags ?? [];
  }

  const ctx: ProductContext = {
    productType: productType || "",
    title: title || "",
    tags: tags || [],
  };

  const result = await evaluateGalleryRules(session.shop, ctx);

  return json(result, {
    headers: {
      // Short edge/browser cache; rule cache lives server-side too.
      "Cache-Control": "public, max-age=30",
      "Content-Type": "application/json",
    },
  });
};
