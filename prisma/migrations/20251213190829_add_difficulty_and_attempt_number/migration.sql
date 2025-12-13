-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "difficulty" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "QuizSession" ADD COLUMN     "attemptNumber" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "QuizSession_userId_quizId_idx" ON "QuizSession"("userId", "quizId");
