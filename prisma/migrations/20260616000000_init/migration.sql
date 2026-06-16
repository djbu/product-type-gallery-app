-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" DATETIME,
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false
);

-- CreateTable
CREATE TABLE "GalleryRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GalleryMedia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "galleryRuleId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "shopifyFileId" TEXT,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "GalleryMedia_galleryRuleId_fkey" FOREIGN KEY ("galleryRuleId") REFERENCES "GalleryRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GalleryCondition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "galleryRuleId" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "titleContains" TEXT,
    "tagsJson" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "GalleryCondition_galleryRuleId_fkey" FOREIGN KEY ("galleryRuleId") REFERENCES "GalleryRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GalleryRule_shop_priority_idx" ON "GalleryRule"("shop", "priority");

-- CreateIndex
CREATE INDEX "GalleryMedia_galleryRuleId_sortOrder_idx" ON "GalleryMedia"("galleryRuleId", "sortOrder");

-- CreateIndex
CREATE INDEX "GalleryCondition_galleryRuleId_idx" ON "GalleryCondition"("galleryRuleId");

-- CreateIndex
CREATE INDEX "GalleryCondition_productType_idx" ON "GalleryCondition"("productType");
