-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryRule" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryMedia" (
    "id" TEXT NOT NULL,
    "galleryRuleId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "shopifyFileId" TEXT,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GalleryMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryCondition" (
    "id" TEXT NOT NULL,
    "galleryRuleId" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "titleContains" TEXT,
    "tagsJson" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "GalleryCondition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GalleryRule_shop_priority_idx" ON "GalleryRule"("shop", "priority");

-- CreateIndex
CREATE INDEX "GalleryMedia_galleryRuleId_sortOrder_idx" ON "GalleryMedia"("galleryRuleId", "sortOrder");

-- CreateIndex
CREATE INDEX "GalleryCondition_galleryRuleId_idx" ON "GalleryCondition"("galleryRuleId");

-- CreateIndex
CREATE INDEX "GalleryCondition_productType_idx" ON "GalleryCondition"("productType");

-- AddForeignKey
ALTER TABLE "GalleryMedia" ADD CONSTRAINT "GalleryMedia_galleryRuleId_fkey" FOREIGN KEY ("galleryRuleId") REFERENCES "GalleryRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryCondition" ADD CONSTRAINT "GalleryCondition_galleryRuleId_fkey" FOREIGN KEY ("galleryRuleId") REFERENCES "GalleryRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

