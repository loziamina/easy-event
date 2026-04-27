-- CreateTable
CREATE TABLE "Category" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EventTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "occasionType" TEXT NOT NULL,
    "description" TEXT,
    "theme" TEXT,
    "guestCount" INTEGER,
    "budget" REAL,
    "suggestedTags" TEXT,
    "suggestedProductIds" TEXT,
    "serviceBuffet" BOOLEAN NOT NULL DEFAULT false,
    "serviceDeco" BOOLEAN NOT NULL DEFAULT false,
    "serviceOrganisation" BOOLEAN NOT NULL DEFAULT false,
    "serviceGateaux" BOOLEAN NOT NULL DEFAULT false,
    "serviceMobilier" BOOLEAN NOT NULL DEFAULT false,
    "serviceAnimation" BOOLEAN NOT NULL DEFAULT false,
    "serviceLieu" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" TEXT NOT NULL,
    "image" TEXT,
    "gallery" TEXT,
    "type" TEXT NOT NULL DEFAULT 'PRODUCT',
    "variants" TEXT,
    "stock" INTEGER,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "recommendedFor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoryId" INTEGER,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("createdAt", "id", "image", "name", "price") SELECT "createdAt", "id", "image", "name", "price" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
