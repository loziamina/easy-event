-- CreateTable
CREATE TABLE "EventAttachment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventAttachment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventHistory_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "statusText" TEXT,
    "statusColor" TEXT,
    "ownerId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("budget", "createdAt", "date", "guestCount", "id", "isSubmitted", "location", "name", "notes", "occasionType", "ownerId", "serviceAnimation", "serviceBuffet", "serviceDeco", "serviceGateaux", "serviceLieu", "serviceMobilier", "serviceOrganisation", "status", "statusColor", "statusText", "theme") SELECT "budget", "createdAt", "date", "guestCount", "id", "isSubmitted", "location", "name", "notes", "occasionType", "ownerId", "serviceAnimation", "serviceBuffet", "serviceDeco", "serviceGateaux", "serviceLieu", "serviceMobilier", "serviceOrganisation", "status", "statusColor", "statusText", "theme" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
