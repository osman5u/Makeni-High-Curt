-- CreateEnum
CREATE TYPE "public"."CaseOutcome" AS ENUM ('pending', 'won', 'lost');

-- AlterTable
ALTER TABLE "public"."Case" ADD COLUMN     "court_start_date" TIMESTAMP(3),
ADD COLUMN     "decision_deadline" TIMESTAMP(3),
ADD COLUMN     "outcome" "public"."CaseOutcome" NOT NULL DEFAULT 'pending',
ADD COLUMN     "progress" TEXT;
