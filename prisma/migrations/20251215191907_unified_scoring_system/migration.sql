/*
  Warnings:

  - You are about to drop the column `score` on the `LeaderboardEntry` table. All the data in the column will be lost.
  - You are about to drop the column `score` on the `WeeklyScore` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "LeaderboardEntry_quizId_periodType_score_idx";

-- DropIndex
DROP INDEX "WeeklyScore_weekStart_score_idx";

-- AlterTable
ALTER TABLE "LeaderboardEntry" DROP COLUMN "score",
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "bestScore" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "WeeklyScore" DROP COLUMN "score",
ADD COLUMN     "bestScore" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "LeaderboardEntry_quizId_periodType_bestScore_idx" ON "LeaderboardEntry"("quizId", "periodType", "bestScore");

-- CreateIndex
CREATE INDEX "WeeklyScore_weekStart_bestScore_idx" ON "WeeklyScore"("weekStart", "bestScore");
