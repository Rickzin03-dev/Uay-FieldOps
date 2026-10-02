CREATE INDEX "ServiceOrder_technicianId_status_idx" ON "ServiceOrder"("technicianId", "status");

CREATE INDEX "Movement_technicianId_archivedAt_createdAt_idx" ON "Movement"("technicianId", "archivedAt", "createdAt");