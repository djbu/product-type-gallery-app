# Product Type Gallery App

A Shopify embedded app that appends extra image/video galleries to products
based on configurable conditions (product type, title, tags) — a scalable,
**Metaobject-free** replacement built to run on stores with 5,000+ products.

Built with the Shopify App Remix template, Polaris, the Admin GraphQL API, a
Theme App Extension (app embed block), and Prisma + SQLite (PostgreSQL-ready).

---

## How it works

1. Merchants create **Gallery Rules** in the embedded admin. Each rule has
   ordered **media** (images + videos) and one or more **conditions**.
2. A condition matches a product when **Product Type** equals the condition's
   type **AND** (if set) the title contains a substring **AND** (if set) the
   product has **all** selected tags.
3. A rule matches if **any** of its conditions match. Rules are evaluated by
   **priority DESC**.
4. On the storefront, the app embed block requests matching media from the app
   proxy and **appends** it after native product media — never replacing it.

```
Storefront product page
  └─ App embed block (extensions/product-gallery)
       └─ GET /apps/gallery-media?productId=…&productType=…&title=…&tags=…
            └─ App proxy route (app/routes/proxy.tsx)
                 └─ evaluateGalleryRules(shop, product)  ← cached rules, no product scan
                      └─ { images: [...], videos: [...] }
```

## Project structure

| Path | Purpose |
| --- | --- |
| `prisma/schema.prisma` | Data model: `GalleryRule`, `GalleryMedia`, `GalleryCondition`, `Session` |
| `prisma/migrations/` | Initial SQL migration |
| `prisma/seed.js` | Seed data (PDF example rules) |
| `app/services/gallery.server.ts` | CRUD + extensible condition engine + `evaluateGalleryRules` + rule cache |
| `app/services/shopify-data.server.ts` | GraphQL: distinct product types & tags (cached) |
| `app/routes/app.rules._index.tsx` | Gallery Rules list (Polaris IndexTable) |
| `app/routes/app.rules.new.tsx`, `app.rules.$id.tsx` | Create / edit / delete rule |
| `app/components/RuleForm.tsx` | Rule editor: details, media uploaders (drag-reorder), conditions |
| `app/routes/proxy.tsx` | App proxy data endpoint (`/apps/gallery-media`) |
| `extensions/product-gallery/` | Theme App Extension (app embed block) |

---

## Installation

### Prerequisites
- Node 18.20+, 20.10+, or 21+
- A [Shopify Partner](https://partners.shopify.com) account + a development store
- [Shopify CLI](https://shopify.dev/docs/api/shopify-cli): `npm i -g @shopify/cli@latest`

### Setup

```bash
# 1. Install deps
npm install

# 2. Configure env
cp .env.example .env          # DATABASE_URL defaults to file:./dev.sqlite

# 3. Create the dev database
npx prisma migrate deploy     # applies prisma/migrations
npx prisma generate

# 4. (optional) Seed example rules — use your real store domain
SEED_SHOP=your-store.myshopify.com npm run seed

# 5. Link the app to your Partner app + run it
npm run config:link           # writes client_id into shopify.app.toml
npm run dev                   # starts tunnel, Remix, and the extension
```

`npm run dev` prints an install URL. Open it to install on your dev store; the
embedded admin opens to **Gallery Rules**.

### Enable the storefront block
1. In the dev store admin: **Online Store → Themes → Customize**.
2. Open **App embeds** (bottom of the left sidebar).
3. Toggle **Product Type Gallery** on, adjust settings, **Save**.

### Deploy

```bash
npm run deploy                # deploys app config + the theme extension
```

For production, switch Prisma to PostgreSQL (see below) and host the app
(Fly.io, Render, Heroku, etc.) with `npm run setup && npm run start`.

---

## App proxy endpoint

```
GET /apps/gallery-media?productId=<id>
```

Optional query params `productType`, `title`, `tags` (comma-separated). When the
theme passes these (it does — from Liquid), the app evaluates against cached
rules with **zero** GraphQL calls. If omitted, the app makes a single product
lookup (never a full scan).

**Response**

```json
{
  "images": [{ "id": "…", "shopifyFileId": "gid://…", "url": "https://…" }],
  "videos": [{ "id": "…", "shopifyFileId": "gid://…", "url": "https://…" }]
}
```

---

## Theme integration

The extension **provides data only**. Your theme keeps its own gallery markup.
Two ways to consume the data:

### A. Auto-append (default)
Turn on **Auto-append media** in the block settings. The block inserts a simple
grid after the element matched by the **Append after** selector. Adjust that
selector to your theme's media container.

### B. Render it yourself (recommended for custom galleries)
Turn **Auto-append off** and listen for the event the block dispatches. The data
is also at `window.ProductTypeGalleryData`.

```js
document.addEventListener("product-gallery:loaded", function (e) {
  const { images, videos } = e.detail; // [{ id, shopifyFileId, url }]
  // hand off to your existing gallery — examples below
});
```

#### Example: main gallery rendering

```js
document.addEventListener("product-gallery:loaded", (e) => {
  const main = document.querySelector(".product__media-list"); // your theme's container
  if (!main) return;
  e.detail.images.forEach((img) => {
    const li = document.createElement("li");
    li.className = "product__media-item";
    li.innerHTML = `<img src="${img.url}" loading="lazy" alt="">`;
    main.appendChild(li); // append only
  });
});
```

#### Example: thumbnail rendering

```js
document.addEventListener("product-gallery:loaded", (e) => {
  const thumbs = document.querySelector(".product__thumbnails");
  if (!thumbs) return;
  [...e.detail.images, ...e.detail.videos].forEach((m) => {
    const btn = document.createElement("button");
    btn.className = "product__thumbnail";
    btn.innerHTML = `<img src="${m.url}" alt="">`;
    thumbs.appendChild(btn);
  });
});
```

#### Example: video rendering

```js
document.addEventListener("product-gallery:loaded", (e) => {
  const container = document.querySelector(".product__media-list");
  if (!container) return;
  e.detail.videos.forEach((vid) => {
    const wrap = document.createElement("div");
    wrap.className = "product__media-item";
    wrap.innerHTML =
      `<video src="${vid.url}" controls playsinline preload="metadata"></video>`;
    container.appendChild(wrap);
  });
});
```

#### Liquid alternative
If you prefer Liquid, fetch the same endpoint from a section/snippet with JS, or
read `window.ProductTypeGalleryData` after the event. Returned URLs are usable
directly in `<img>`/`<video>` tags.

---

## Performance

- **No full product scans.** Only the current product is evaluated.
- **Rule cache.** All rules for a shop are cached in memory (5-min TTL),
  invalidated on every create/update/delete. Storefront responses run against
  the cache — target **< 100ms** after warmup.
- **Product types & tags cached** (5-min TTL) so the condition editor doesn't
  re-query the Admin API on each open.
- **Indexed DB fields:** `GalleryRule(shop, priority)`,
  `GalleryMedia(galleryRuleId, sortOrder)`, `GalleryCondition(productType)`.
- Theme passes product attributes via Liquid → the hot path makes **0**
  GraphQL calls.

## Extending conditions

The condition engine is a matcher registry in `gallery.server.ts`
(`CONDITION_MATCHERS`). To add a future condition (vendor, handle, product
category, collections, SKU contains, variant options):

1. Add the column to `GalleryCondition` in `schema.prisma` + a migration.
2. Add the field to `ConditionInput` / `RuleFormData` and the editor UI.
3. Append one matcher function to `CONDITION_MATCHERS`.

No change to the evaluation loop is required.

## Migrating to PostgreSQL

1. In `schema.prisma` set `provider = "postgresql"`.
2. Point `DATABASE_URL` at your Postgres instance.
3. `npx prisma migrate dev --name init_pg`.

The app code already serializes condition tags through the service layer, so the
`tagsJson` string can become a native `String[]` column with only a schema +
service tweak.
