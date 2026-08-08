/*
  Warnings:

  - Added the required column `passwordHash` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "planItemId" TEXT,
    "date" TEXT NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT,
    "note" TEXT,
    "repeat" TEXT NOT NULL DEFAULT 'ONCE',
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
INSERT INTO "new_Reminder" ("answeredAt", "attempts", "audioPath", "callUuid", "completedAt", "createdAt", "date", "durationSec", "failureReason", "id", "kind", "language", "planItemId", "requestUuid", "scheduledAt", "script", "scriptBy", "status", "toNumber", "transcript", "updatedAt", "userId") SELECT "answeredAt", "attempts", "audioPath", "callUuid", "completedAt", "createdAt", "date", "durationSec", "failureReason", "id", "kind", "language", "planItemId", "requestUuid", "scheduledAt", "script", "scriptBy", "status", "toNumber", "transcript", "updatedAt", "userId" FROM "Reminder";
DROP TABLE "Reminder";
ALTER TABLE "new_Reminder" RENAME TO "Reminder";
CREATE INDEX "Reminder_status_scheduledAt_idx" ON "Reminder"("status", "scheduledAt");
CREATE INDEX "Reminder_userId_date_idx" ON "Reminder"("userId", "date");
CREATE UNIQUE INDEX "Reminder_planItemId_key" ON "Reminder"("planItemId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "profileComplete" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "ageRange" TEXT NOT NULL DEFAULT '25-34',
    "sex" TEXT,
    "heightCm" REAL NOT NULL DEFAULT 170,
    "weightKg" REAL NOT NULL DEFAULT 70,
    "goal" TEXT NOT NULL DEFAULT 'maintain',
    "activityLevel" TEXT NOT NULL DEFAULT 'light',
    "dietaryPreference" TEXT NOT NULL DEFAULT 'vegetarian',
    "cuisine" TEXT NOT NULL DEFAULT 'north_indian',
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
-- Backfill credentials for rows that predate authentication rather than dropping
-- them. `username` is derived from the row id so it is unique; `passwordHash` is
-- set to a sentinel that no password can ever hash to, so these accounts cannot
-- be logged into — they must be re-registered. `profileComplete` is 1 because
-- these rows already carry a filled-in wellness profile.
INSERT INTO "new_User" ("activityLevel", "ageRange", "allergies", "createdAt", "cuisine", "dietaryPreference", "dislikes", "equipment", "goal", "heightCm", "id", "limitations", "name", "phone", "reminderLanguage", "remindersEnabled", "sex", "sleepTime", "updatedAt", "wakeTime", "weightKg", "workoutWindowMin", "username", "passwordHash", "profileComplete") SELECT "activityLevel", "ageRange", "allergies", "createdAt", "cuisine", "dietaryPreference", "dislikes", "equipment", "goal", "heightCm", "id", "limitations", "name", "phone", "reminderLanguage", "remindersEnabled", "sex", "sleepTime", "updatedAt", "wakeTime", "weightKg", "workoutWindowMin", 'legacy_' || "id", 'disabled', 1 FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
