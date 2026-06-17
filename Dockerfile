# Multi-stage build for the Remix + Prisma app, sized for Koyeb's free instance.
FROM node:20-slim AS base
ENV NODE_ENV=production
WORKDIR /app
# Prisma needs openssl + ca-certificates at runtime (and build).
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# --- deps: install ALL deps (incl. dev) for the build ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --include=dev

# --- build: generate Prisma client + compile Remix ---
FROM deps AS build
COPY . .
RUN npx prisma generate
RUN npm run build

# --- prod deps only ---
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --omit=dev && npm cache clean --force

# --- runner ---
FROM base AS runner
ENV PORT=8000
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY --from=prod-deps /app/node_modules ./node_modules
# Prisma client generated during build (engine + client):
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/build ./build

EXPOSE 8000
# Apply migrations on boot, then serve. Koyeb sets $PORT; remix-serve reads it.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
