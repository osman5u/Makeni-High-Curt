-- CreateTable
CREATE TABLE "public"."CaseTrackingHistory" (
    "id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "updated_by_id" INTEGER NOT NULL,
    "court_start_date" TIMESTAMP(3),
    "decision_deadline" TIMESTAMP(3),
    "outcome" "public"."CaseOutcome",
    "progress" TEXT,
    "changes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseTrackingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseTrackingHistory_case_id_created_at_idx" ON "public"."CaseTrackingHistory"("case_id", "created_at");

-- AddForeignKey
ALTER TABLE "public"."CaseTrackingHistory" ADD CONSTRAINT "CaseTrackingHistory_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CaseTrackingHistory" ADD CONSTRAINT "CaseTrackingHistory_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
