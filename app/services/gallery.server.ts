import prisma from "../db.server";
import type { GalleryRule, GalleryMedia, GalleryCondition } from "@prisma/client";

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export type MediaType = "image" | "video";

export interface MediaInput {
  mediaType: MediaType;
  shopifyFileId?: string | null;
  url: string;
  sortOrder: number;
}

export interface ConditionInput {
  productType: string;
  titleContains?: string | null;
  tags: string[];
}

export interface RuleInput {
  name: string;
  priority: number;
  media: MediaInput[];
  conditions: ConditionInput[];
}

export type RuleWithRelations = GalleryRule & {
  media: GalleryMedia[];
  conditions: GalleryCondition[];
};

/** Normalized product attributes the condition engine evaluates against. */
export interface ProductContext {
  productType: string;
  title: string;
  tags: string[];
  // Future fields land here without touching the matcher loop — see CONDITION_MATCHERS.
  vendor?: string;
  handle?: string;
  category?: string;
  collections?: string[];
  skus?: string[];
}

export interface GalleryMediaResult {
  images: { id: string; shopifyFileId: string | null; url: string }[];
  videos: { id: string; shopifyFileId: string | null; url: string }[];
}

/* ------------------------------------------------------------------ *
 * CRUD
 * ------------------------------------------------------------------ */

export interface RuleListItem {
  id: string;
  name: string;
  priority: number;
  conditionCount: number;
  imageCount: number;
  videoCount: number;
}

export async function listRules(shop: string): Promise<RuleListItem[]> {
  const rules = await prisma.galleryRule.findMany({
    where: { shop },
    orderBy: { priority: "desc" },
    include: {
      _count: { select: { conditions: true } },
      media: { select: { mediaType: true } },
    },
  });
  return rules.map((r) => ({
    id: r.id,
    name: r.name,
    priority: r.priority,
    conditionCount: r._count.conditions,
    imageCount: r.media.filter((m) => m.mediaType !== "video").length,
    videoCount: r.media.filter((m) => m.mediaType === "video").length,
  }));
}

export async function getRule(shop: string, id: string) {
  return prisma.galleryRule.findFirst({
    where: { id, shop },
    include: {
      media: { orderBy: { sortOrder: "asc" } },
      conditions: true,
    },
  });
}

export async function createRule(shop: string, input: RuleInput) {
  const rule = await prisma.galleryRule.create({
    data: {
      shop,
      name: input.name,
      priority: input.priority,
      media: { create: input.media.map(toMediaData) },
      conditions: { create: input.conditions.map(toConditionData) },
    },
  });
  invalidateRuleCache(shop);
  return rule;
}

export async function updateRule(shop: string, id: string, input: RuleInput) {
  // Replace child rows transactionally — simplest correct strategy for an
  // editor that sends the full media/condition set each save.
  const existing = await prisma.galleryRule.findFirst({ where: { id, shop } });
  if (!existing) throw new Response("Not found", { status: 404 });

  await prisma.$transaction([
    prisma.galleryMedia.deleteMany({ where: { galleryRuleId: id } }),
    prisma.galleryCondition.deleteMany({ where: { galleryRuleId: id } }),
    prisma.galleryRule.update({
      where: { id },
      data: {
        name: input.name,
        priority: input.priority,
        media: { create: input.media.map(toMediaData) },
        conditions: { create: input.conditions.map(toConditionData) },
      },
    }),
  ]);
  invalidateRuleCache(shop);
}

export async function deleteRule(shop: string, id: string) {
  await prisma.galleryRule.deleteMany({ where: { id, shop } });
  invalidateRuleCache(shop);
}

function toMediaData(m: MediaInput) {
  return {
    mediaType: m.mediaType,
    shopifyFileId: m.shopifyFileId ?? null,
    url: m.url,
    sortOrder: m.sortOrder,
  };
}

function toConditionData(c: ConditionInput) {
  return {
    productType: c.productType,
    titleContains: c.titleContains?.trim() ? c.titleContains.trim() : null,
    tagsJson: JSON.stringify(c.tags ?? []),
  };
}

export function parseConditionTags(c: GalleryCondition): string[] {
  try {
    const parsed = JSON.parse(c.tagsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ *
 * Extensible condition engine
 *
 * Each matcher inspects ONE aspect of a condition. To add a future condition
 * (vendor, handle, collections, sku, variant options) register a matcher here
 * + add the column to GalleryCondition + the input field — no change to the
 * evaluation loop below.
 * ------------------------------------------------------------------ */

type Matcher = (cond: GalleryCondition, product: ProductContext) => boolean;

const CONDITION_MATCHERS: Matcher[] = [
  // Product Type — required, exact match.
  (cond, p) =>
    normalize(p.productType) === normalize(cond.productType),

  // Title Contains — optional, case-insensitive substring.
  (cond, p) => {
    if (!cond.titleContains) return true;
    return p.title.toLowerCase().includes(cond.titleContains.toLowerCase());
  },

  // Tags — optional, product must contain ALL selected tags.
  (cond, p) => {
    const required = parseConditionTags(cond);
    if (required.length === 0) return true;
    const have = new Set(p.tags.map((t) => t.toLowerCase()));
    return required.every((t) => have.has(t.toLowerCase()));
  },
];

function normalize(s: string) {
  return (s ?? "").trim().toLowerCase();
}

/** A condition matches when every registered matcher passes (AND). */
function conditionMatches(cond: GalleryCondition, product: ProductContext) {
  return CONDITION_MATCHERS.every((m) => m(cond, product));
}

/** A rule matches when ANY of its conditions match (OR). */
function ruleMatches(rule: RuleWithRelations, product: ProductContext) {
  return rule.conditions.some((c) => conditionMatches(c, product));
}

/* ------------------------------------------------------------------ *
 * Rule cache — keeps the storefront hot path off the DB after warmup.
 * ------------------------------------------------------------------ */

type CachedRules = { value: RuleWithRelations[]; expiresAt: number };
const RULE_TTL_MS = 5 * 60 * 1000;
const ruleCache = new Map<string, CachedRules>();

export function invalidateRuleCache(shop: string) {
  ruleCache.delete(shop);
}

async function getRulesForShop(shop: string): Promise<RuleWithRelations[]> {
  const hit = ruleCache.get(shop);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await prisma.galleryRule.findMany({
    where: { shop },
    orderBy: { priority: "desc" }, // priority DESC — highest first
    include: {
      media: { orderBy: { sortOrder: "asc" } },
      conditions: true,
    },
  });
  ruleCache.set(shop, { value, expiresAt: Date.now() + RULE_TTL_MS });
  return value;
}

/* ------------------------------------------------------------------ *
 * Evaluation — the reusable service required by the spec.
 * ------------------------------------------------------------------ */

/**
 * evaluateGalleryRules(shop, product) -> { images, videos }
 *
 * 1. Load rules ordered by priority DESC (cached).
 * 2. Evaluate conditions for THIS product only (no full product scan).
 * 3. Merge matching media, dedupe (by shopifyFileId else url), preserve order.
 */
export async function evaluateGalleryRules(
  shop: string,
  product: ProductContext,
): Promise<GalleryMediaResult> {
  const rules = await getRulesForShop(shop);

  const seen = new Set<string>();
  const images: GalleryMediaResult["images"] = [];
  const videos: GalleryMediaResult["videos"] = [];

  for (const rule of rules) {
    if (!ruleMatches(rule, product)) continue;
    for (const m of rule.media) {
      const key = m.shopifyFileId || m.url;
      if (seen.has(key)) continue; // remove duplicates across rules
      seen.add(key);
      const entry = { id: m.id, shopifyFileId: m.shopifyFileId, url: m.url };
      if (m.mediaType === "video") videos.push(entry);
      else images.push(entry);
    }
  }

  return { images, videos };
}
