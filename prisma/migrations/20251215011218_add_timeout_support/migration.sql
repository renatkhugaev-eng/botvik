-- DropForeignKey
ALTER TABLE "Answer" DROP CONSTRAINT "Answer_optionId_fkey";

-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "isTimeout" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "optionId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "AnswerOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
