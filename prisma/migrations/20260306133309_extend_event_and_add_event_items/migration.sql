-- CreateTable
CREATE TABLE "EventItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EventItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "statusText" TEXT,
    "statusColor" TEXT,
    "ownerId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("createdAt", "date", "id", "name", "ownerId", "status", "statusColor", "statusText") SELECT "createdAt", "date", "id", "name", "ownerId", "status", "statusColor", "statusText" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "EventItem_eventId_productId_key" ON "EventItem"("eventId", "productId");
