ALTER TABLE "ServiceOrder" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "ServiceOrder_archivedAt_idx" ON "ServiceOrder"("archivedAt");