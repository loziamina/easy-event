-- CreateTable
CREATE TABLE "QuoteTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "calculationMode" TEXT NOT NULL DEFAULT 'MIXED',
    "defaultDeposit" REAL,
    "terms" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "templateId" INTEGER,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "calculationMode" TEXT NOT NULL DEFAULT 'MIXED',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "deliveryFee" REAL NOT NULL DEFAULT 0,
    "installationFee" REAL NOT NULL DEFAULT 0,
    "discount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "depositAmount" REAL,
    "depositRequired" BOOLEAN NOT NULL DEFAULT false,
    "clientComment" TEXT,
    "terms" TEXT,
    "sentAt" DATETIME,
    "decidedAt" DATETIME,
    "createdBy" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quoteId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "strategy" TEXT NOT NULL DEFAULT 'FIXED',
    "unitPrice" REAL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "guestCount" INTEGER,
    "lineTotal" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
