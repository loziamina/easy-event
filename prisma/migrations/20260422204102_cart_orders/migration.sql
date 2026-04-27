-- AlterTable
ALTER TABLE "EventItem" ADD COLUMN "reservedUntil" DATETIME;
ALTER TABLE "EventItem" ADD COLUMN "variant" TEXT;

-- CreateTable
CREATE TABLE "Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deliveryAddress" TEXT,
    "deliverySlot" TEXT,
    "clientNotes" TEXT,
    "deliveryFee" REAL NOT NULL DEFAULT 0,
    "installationFee" REAL NOT NULL DEFAULT 0,
    "subtotalFixed" REAL NOT NULL DEFAULT 0,
    "totalFixed" REAL NOT NULL DEFAULT 0,
    "hasQuoteItems" BOOLEAN NOT NULL DEFAULT false,
    "reservedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER,
    "name" TEXT NOT NULL,
    "priceLabel" TEXT NOT NULL,
    "unitPrice" REAL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "variant" TEXT,
    "lineTotal" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
