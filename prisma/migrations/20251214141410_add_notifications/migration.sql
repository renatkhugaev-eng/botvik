-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "notifyDailyReminder" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyEnergyFull" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyFriends" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyLeaderboard" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyLevelUp" BOOLEAN NOT NULL DEFAULT true;
