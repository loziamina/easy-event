-- CreateTable
CREATE TABLE "Mockup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileType" TEXT NOT NULL DEFAULT 'image',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "moodboard" TEXT,
    "createdBy" INTEGER,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Mockup_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MockupComment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mockupId" INTEGER NOT NULL,
    "authorId" INTEGER,
    "authorRole" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MockupComment_mockupId_fkey" FOREIGN KEY ("mockupId") REFERENCES "Mockup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
