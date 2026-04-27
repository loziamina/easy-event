-- CreateTable
CREATE TABLE "PlanningBlock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "reason" TEXT,
    "createdBy" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EventChecklistItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "dueAt" DATETIME,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "assignedToId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventChecklistItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "assignedStaffId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Event_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("budget", "createdAt", "date", "guestCount", "id", "isSubmitted", "location", "name", "notes", "occasionType", "ownerId", "serviceAnimation", "serviceBuffet", "serviceDeco", "serviceGateaux", "serviceLieu", "serviceMobilier", "serviceOrganisation", "status", "statusColor", "statusText", "theme", "updatedAt") SELECT "budget", "createdAt", "date", "guestCount", "id", "isSubmitted", "location", "name", "notes", "occasionType", "ownerId", "serviceAnimation", "serviceBuffet", "serviceDeco", "serviceGateaux", "serviceLieu", "serviceMobilier", "serviceOrganisation", "status", "statusColor", "statusText", "theme", "updatedAt" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
