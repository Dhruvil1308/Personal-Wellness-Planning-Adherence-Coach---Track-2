-- CreateTable
CREATE TABLE "PlanUnlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "blockedByDate" TEXT NOT NULL,
    "blockedByPct" REAL NOT NULL,
    "thresholdPct" REAL NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PlanUnlock_userId_idx" ON "PlanUnlock"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanUnlock_userId_date_key" ON "PlanUnlock"("userId", "date");
