# Despliegue en sleefs.com — Koyeb + Neon

Guía paso a paso para montar el app en la tienda **sleefs.com**.
Stack: **Neon** (Postgres) + **Koyeb** (host del contenedor) + **Shopify Partners**.

---

## Estado actual

- [x] Código listo y verificado (build Docker + migración + seed contra Postgres real)
- [x] Repo privado: **github.com/djbu/product-type-gallery-app**
- [ ] Paso 1 — Vincular app de Partner (`shopify app config link`)
- [ ] Paso 2 — Base de datos Neon
- [ ] Paso 3 — Servicio en Koyeb
- [ ] Paso 4 — Apuntar Shopify a Koyeb + `deploy`
- [ ] Paso 5 — Instalar en sleefs y activar el App embed

---

## Paso 1 — Vincular app de Partner

Escribe el `client_id` en `shopify.app.toml`.

```
shopify app config link
```

Responde:
- **Partner org** → la que tiene sleefs
- **App** → "Create a new app" → nombre *Product Type Gallery* (o selecciona una existente)

Verifica que `shopify.app.toml` ahora tenga una línea `client_id = "..."`.

> Guarda de tu app de Partner (Settings → Client credentials):
> - **API key** → será `SHOPIFY_API_KEY`
> - **API secret** → será `SHOPIFY_API_SECRET`

---

## Paso 2 — Base de datos (Neon)

1. Crea un proyecto en https://neon.tech (sin tarjeta, uso comercial permitido).
2. En el dashboard → **Connection string** → usa la opción **Pooled connection**.
3. Copia la cadena. Debe verse así:
   ```
   postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
   ```
   Esta cadena es tu `DATABASE_URL`.

> Las migraciones se aplican solas al arrancar el contenedor
> (`prisma migrate deploy` en el `CMD` del Dockerfile). No tienes que correrlas a mano.

---

## Paso 3 — Servicio en Koyeb

Koyeb construye el `Dockerfile` directo desde el repo de GitHub.

1. Entra a https://app.koyeb.com → **Create Service** → **GitHub**.
2. Conecta la cuenta **djbu** y elige el repo `product-type-gallery-app`.
3. **Builder**: Dockerfile (autodetectado).
4. **Instance**: **Free**.
5. **Port**: `8000`.
6. **Environment variables** (Settings → Environment) — las 4 son obligatorias:

   | Variable | Valor |
   |----------|-------|
   | `DATABASE_URL` | cadena pooled de Neon (Paso 2) |
   | `SHOPIFY_API_KEY` | API key del Partner app (Paso 1) |
   | `SHOPIFY_API_SECRET` | API secret del Partner app (Paso 1) |
   | `SHOPIFY_APP_URL` | `https://<tu-servicio>.koyeb.app` (el dominio que te asigna Koyeb) |
   | `SCOPES` | `read_products,read_files,write_files` |

7. **Deploy**. El contenedor corre `prisma migrate deploy` y luego `remix-serve`.

> ⚠️ El app **no arranca** sin las 4 variables de Shopify — las valida al inicio.
>
> ⚠️ El Free tier de Koyeb se duerme tras ~1h sin tráfico (cold start 1–5s).
> Para evitar cold starts en la tienda, pon **min instances = 1** en el servicio.

Cuando termine el deploy, anota el dominio público: `https://<tu-servicio>.koyeb.app`.

---

## Paso 4 — Apuntar Shopify a Koyeb

Edita `shopify.app.toml` con el dominio de Koyeb:

- `application_url = "https://<tu-servicio>.koyeb.app"`
- En `[auth] redirect_urls` → reemplaza `https://localhost` por `https://<tu-servicio>.koyeb.app`
- En `[app_proxy]` → `url = "https://<tu-servicio>.koyeb.app/proxy"`

Luego despliega config + la theme extension a Shopify:

```
shopify app deploy
```

Esto sube la configuración del app y la extensión de tema (gallery.liquid/js/css) al CDN de Shopify.

---

## Paso 5 — Instalar en sleefs + activar el bloque

1. **Instalar el app**: en el Partner dashboard → tu app → **Test on development store** /
   o genera el link de instalación e instálalo en **sleefs**.
   (Si sleefs es tienda de producción, instálalo como app personalizada/no listada.)
2. **Activar el App embed**:
   - Admin de sleefs → **Online Store → Themes → Customize**
   - Panel izquierdo abajo → **App embeds**
   - Activa **Product Type Gallery**, ajusta settings, **Save**.
3. **Crear reglas**: en el admin embebido (app) → **Gallery Rules** → crea reglas
   con condiciones (Product Type / Title / Tags) y sube media.

---

## (Opcional) Sembrar datos de prueba en producción

```
SEED_SHOP=sleefs.myshopify.com DATABASE_URL="<cadena-neon>" npm run seed
```

> Usa el dominio `.myshopify.com` real de sleefs, no el dominio público.

---

## Verificación

- Abre una página de producto que matchee una regla → el media extra debe aparecer
  **después** del media nativo (nunca lo reemplaza).
- Prueba directa del endpoint (desde el navegador, logueado en la tienda):
  ```
  https://sleefs.com/apps/gallery-media?productId=<ID>
  ```
  Debe devolver `{ "images": [...], "videos": [...] }`.

---

## Notas

- **Hosting del backend es obligatorio**: el endpoint `/apps/gallery-media` se llama
  en vivo desde cada página de producto. Sin backend corriendo, no hay galerías.
- **Cold starts**: con min instances = 1 el app queda always-on (sigue siendo gratis,
  1 instancia Free).
- **Migrar a más capacidad**: si 0.1 vCPU de Koyeb se siente lento, sube de instancia
  en Koyeb (de pago) o mueve a Fly.io (~$2–5/mes). El mismo Dockerfile sirve.
