// Minimal structural type for the Admin GraphQL client returned by
// authenticate.admin(...).admin.graphql — avoids coupling to the SDK's
// deeply-generic context type.
type GraphQLClient = (
  query: string,
  options?: { variables?: Record<string, unknown> },
) => Promise<{ json: () => Promise<any> }>;

/**
 * Reads store-wide metadata used to build conditions (product types + tags).
 *
 * These come from Shopify's aggregated `shop.productTypes` / `shop.productTags`
 * connections — NOT from scanning products — so they stay cheap on 5,000+
 * product stores. Results are cached per shop (see CACHE below) so the
 * admin condition editor never hammers the GraphQL API.
 */

type Cached<T> = { value: T; expiresAt: number };
const TTL_MS = 5 * 60 * 1000; // 5 minutes
const productTypeCache = new Map<string, Cached<string[]>>();
const productTagCache = new Map<string, Cached<string[]>>();

const PRODUCT_TYPES_QUERY = `#graphql
  query ProductTypes($first: Int!, $after: String) {
    shop {
      productTypes(first: $first, after: $after) {
        edges { node }
        pageInfo { hasNextPage endCursor }
      }
    }
  }`;

const PRODUCT_TAGS_QUERY = `#graphql
  query ProductTags($first: Int!, $after: String) {
    shop {
      productTags(first: $first, after: $after) {
        edges { node }
        pageInfo { hasNextPage endCursor }
      }
    }
  }`;

type Admin = GraphQLClient;

async function paginate(
  graphql: Admin,
  query: string,
  field: "productTypes" | "productTags",
): Promise<string[]> {
  const out: string[] = [];
  let after: string | null = null;
  // Connections are bounded (a store has a finite set of types/tags); cap at
  // 20 pages * 250 = 5,000 distinct values as a safety stop.
  for (let page = 0; page < 20; page++) {
    const res = await graphql(query, { variables: { first: 250, after } });
    const body = await res.json();
    const conn = body?.data?.shop?.[field];
    if (!conn) break;
    for (const edge of conn.edges) {
      if (edge.node) out.push(edge.node);
    }
    if (!conn.pageInfo?.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  return out;
}

export async function getProductTypes(
  shop: string,
  graphql: Admin,
): Promise<string[]> {
  const hit = productTypeCache.get(shop);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await paginate(graphql, PRODUCT_TYPES_QUERY, "productTypes");
  productTypeCache.set(shop, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

export async function getProductTags(
  shop: string,
  graphql: Admin,
): Promise<string[]> {
  const hit = productTagCache.get(shop);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await paginate(graphql, PRODUCT_TAGS_QUERY, "productTags");
  productTagCache.set(shop, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

export function invalidateStoreMetadata(shop: string) {
  productTypeCache.delete(shop);
  productTagCache.delete(shop);
}
