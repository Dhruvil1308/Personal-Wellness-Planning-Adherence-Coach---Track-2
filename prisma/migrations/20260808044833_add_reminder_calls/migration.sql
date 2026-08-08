-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "planItemId" TEXT,
    "date" TEXT NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "kind" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'gu-IN',
    "script" TEXT NOT NULL,
    "scriptBy" TEXT NOT NULL DEFAULT 'ai',
    "audioPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "callUuid" TEXT,
    "requestUuid" TEXT,
    "failureReason" TEXT,
    "answeredAt" DATETIME,
    "completedAt" DATETIME,
    "durationSec" INTEGER,
    "transcript" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reminder_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "PlanItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ageRange" TEXT NOT NULL,
    "sex" TEXT,
    "heightCm" REAL NOT NULL,
    "weightKg" REAL NOT NULL,
    "goal" TEXT NOT NULL,
    "activityLevel" TEXT NOT NULL,
    "dietaryPreference" TEXT NOT NULL,
    "cuisine" TEXT NOT NULL,
    "allergies" TEXT NOT NULL DEFAULT '',
    "dislikes" TEXT NOT NULL DEFAULT '',
    "limitations" TEXT NOT NULL DEFAULT '',
    "equipment" TEXT NOT NULL DEFAULT 'none',
    "wakeTime" TEXT NOT NULL DEFAULT '07:00',
    "sleepTime" TEXT NOT NULL DEFAULT '23:00',
    "workoutWindowMin" INTEGER NOT NULL DEFAULT 30,
    "phone" TEXT,
    "remindersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderLanguage" TEXT NOT NULL DEFAULT 'gu-IN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("activityLevel", "ageRange", "allergies", "createdAt", "cuisine", "dietaryPreference", "dislikes", "equipment", "goal", "heightCm", "id", "limitations", "name", "sex", "sleepTime", "updatedAt", "wakeTime", "weightKg", "workoutWindowMin") SELECT "activityLevel", "ageRange", "allergies", "createdAt", "cuisine", "dietaryPreference", "dislikes", "equipment", "goal", "heightCm", "id", "limitations", "name", "sex", "sleepTime", "updatedAt", "wakeTime", "weightKg", "workoutWindowMin" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Reminder_status_scheduledAt_idx" ON "Reminder"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Reminder_userId_date_idx" ON "Reminder"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_planItemId_key" ON "Reminder"("planItemId");
