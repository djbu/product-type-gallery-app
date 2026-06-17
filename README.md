# Product Type Gallery App

A Shopify embedded app that appends extra image/video galleries to products
based on configurable conditions (product type, title, tags) — a scalable,
**Metaobject-free** replacement built to run on stores with 5,000+ products.

Built with the Shopify App Remix template, Polaris, the Admin GraphQL API, a
Theme App Extension (app embed block), and Prisma + PostgreSQL (Neon).

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

# 2. Configure env — set DATABASE_URL to a Postgres instance
cp .env.example .env          # e.g. a free Neon dev branch, or local Postgres

# 3. Create the schema
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

---

## Production hosting — Koyeb + Neon (free)

The app ships with a `Dockerfile` (node:20-slim, applies migrations on boot).
Recommended free stack: **Neon** (Postgres) + **Koyeb** (container host). Both
allow commercial use with no card.

### 1. Database — Neon
1. Create a project at [neon.tech](https://neon.tech).
2. Copy the **pooled** connection string → this is `DATABASE_URL`
   (`postgresql://…-pooler…/neondb?sslmode=require`).

### 2. App — Koyeb
Koyeb builds the `Dockerfile` straight from a GitHub repo.
1. Push this repo to GitHub (private is fine).
2. [app.koyeb.com](https://app.koyeb.com) → **Create Service → GitHub** → pick the repo.
3. Builder: **Dockerfile**. Instance: **Free**. Port: **8000**.
4. Set env vars (Service → Settings → Environment):
   - `DATABASE_URL` = Neon pooled string
   - `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` = from your Partner app
   - `SHOPIFY_APP_URL` = `https://<your-service>.koyeb.app`
   - `SCOPES` = `read_products,read_files,write_files`
5. Deploy. The container runs `prisma migrate deploy` then `remix-serve`.

> The app **will not boot** without `SHOPIFY_API_URL`/key/secret/scopes set — it
> validates them at startup. Set all four.

> Koyeb free scales to zero after ~1h idle (1–5s cold start). To avoid cold
> starts on the storefront, set the service **min instances = 1**.

### 3. Point the Shopify app at Koyeb
In `shopify.app.toml` set `application_url` and the `app_proxy.url` to your
Koyeb domain, then `shopify app deploy` (pushes app config + the theme
extension to Shopify's CDN). Install on the store from the Partner dashboard.

### Seeding production (optional)
`SEED_SHOP=your-store.myshopify.com DATABASE_URL=<neon> npm run seed`

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

## Schema notes

Tags are stored as a JSON string (`tagsJson`) for portability and are
serialized through the service layer. On Postgres this can become a native
`text[]` column with only a schema + service tweak if you ever want SQL-level
tag filtering.
