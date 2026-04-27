-- CreateTable
CREATE TABLE "Organizer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "city" TEXT,
    "address" TEXT,
    "serviceArea" TEXT,
    "description" TEXT,
    "coverImage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Conversation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clientId" INTEGER NOT NULL,
    "adminId" INTEGER NOT NULL,
    "organizerId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientLastReadAt" DATETIME,
    "staffLastReadAt" DATETIME,
    CONSTRAINT "Conversation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Conversation_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Conversation_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Conversation" ("adminId", "clientId", "clientLastReadAt", "createdAt", "id", "staffLastReadAt", "updatedAt") SELECT "adminId", "clientId", "clientLastReadAt", "createdAt", "id", "staffLastReadAt", "updatedAt" FROM "Conversation";
DROP TABLE "Conversation";
ALTER TABLE "new_Conversation" RENAME TO "Conversation";
CREATE UNIQUE INDEX "Conversation_clientId_adminId_key" ON "Conversation"("clientId", "adminId");
CREATE TABLE "new_Event" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "occasionType" TEXT,
    "theme" TEXT,
    "location" TEXT,
    "guestCount" INTEGER,
    "budget" REAL,
    "notes" TEXT,
    "serviceBuffet" BOOLEAN NOT NULL DEFAULT false,
    "serviceDeco" BOOLEAN NOT NULL DEFAULT false,
    "serviceOrganisation" BOOLEAN NOT NULL DEFAULT false,
    "serviceGateaux" BOOLEAN NOT NULL DEFAULT false,
    "serviceMobilier" BOOLEAN NOT NULL DEFAULT false,
    "serviceAnimation" BOOLEAN NOT NULL DEFAULT false,
    "serviceLieu" BOOLEAN NOT NULL DEFAULT false,
    "isSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "statusText" TEXT,
    "statusColor" TEXT,
    "ownerId" INTEGER NOT NULL,
    "organizerId" INTEGER,
    "assignedStaffId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("assignedStaffId", "budget", "createdAt", "date", "guestCount", "id", "isSubmitted", "location", "name", "notes", "occasionType", "ownerId", "serviceAnimation", "serviceBuffet", "serviceDeco", "serviceGateaux", "serviceLieu", "serviceMobilier", "serviceOrganisation", "status", "statusColor", "statusText", "theme", "updatedAt") SELECT "assignedStaffId", "budget", "createdAt", "date", "guestCount", "id", "isSubmitted", "location", "name", "notes", "occasionType", "ownerId", "serviceAnimation", "serviceBuffet", "serviceDeco", "serviceGateaux", "serviceLieu", "serviceMobilier", "serviceOrganisation", "status", "statusColor", "statusText", "theme", "updatedAt" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
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
    "organizerId" INTEGER,
    "categoryId" INTEGER,
    CONSTRAINT "Product_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("categoryId", "createdAt", "description", "gallery", "id", "image", "isAvailable", "name", "price", "recommendedFor", "stock", "type", "updatedAt", "variants") SELECT "categoryId", "createdAt", "description", "gallery", "id", "image", "isAvailable", "name", "price", "recommendedFor", "stock", "type", "updatedAt", "variants" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE TABLE "new_QuickMessageTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PLATFORM_ADMIN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_QuickMessageTemplate" ("body", "createdAt", "id", "role", "title", "updatedAt") SELECT "body", "createdAt", "id", "role", "title", "updatedAt" FROM "QuickMessageTemplate";
DROP TABLE "QuickMessageTemplate";
ALTER TABLE "new_QuickMessageTemplate" RENAME TO "QuickMessageTemplate";
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CLIENT',
    "organizerId" INTEGER,
    "resetToken" TEXT,
    "resetTokenExpires" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("address", "createdAt", "email", "id", "name", "password", "phone", "resetToken", "resetTokenExpires", "role", "updatedAt") SELECT "address", "createdAt", "email", "id", "name", "password", "phone", "resetToken", "resetTokenExpires", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Organizer_slug_key" ON "Organizer"("slug");
