CREATE TYPE "EquipmentUnitStatus" AS ENUM ('EM_ESTOQUE', 'ALOCADO', 'EM_USO_CLIENTE', 'MANUTENCAO', 'AGUARDANDO_DEVOLUCAO', 'DEVOLVIDO', 'BAIXADO');

CREATE TYPE "EquipmentUnitEventType" AS ENUM ('ENTRADA', 'ALOCACAO', 'INSTALACAO', 'RETIRADA', 'MANUTENCAO', 'DEVOLUCAO', 'BAIXA', 'AJUSTE');

CREATE TABLE "EquipmentUnit" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "status" "EquipmentUnitStatus" NOT NULL DEFAULT 'EM_ESTOQUE',
    "condition" "Condition" NOT NULL DEFAULT 'BOM',
    "technicianId" TEXT,
    "customer" TEXT,
    "serviceOrderId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EquipmentUnit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EquipmentUnit_serialNumber_key" ON "EquipmentUnit"("serialNumber");
CREATE INDEX "EquipmentUnit_itemId_status_idx" ON "EquipmentUnit"("itemId", "status");
CREATE INDEX "EquipmentUnit_technicianId_idx" ON "EquipmentUnit"("technicianId");

ALTER TABLE "EquipmentUnit" ADD CONSTRAINT "EquipmentUnit_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EquipmentUnit" ADD CONSTRAINT "EquipmentUnit_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentUnit" ADD CONSTRAINT "EquipmentUnit_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EquipmentUnitEvent" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "type" "EquipmentUnitEventType" NOT NULL,
    "technicianId" TEXT,
    "customer" TEXT,
    "serviceOrderId" TEXT,
    "userId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EquipmentUnitEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EquipmentUnitEvent_unitId_createdAt_idx" ON "EquipmentUnitEvent"("unitId", "createdAt");

ALTER TABLE "EquipmentUnitEvent" ADD CONSTRAINT "EquipmentUnitEvent_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "EquipmentUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EquipmentUnitEvent" ADD CONSTRAINT "EquipmentUnitEvent_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentUnitEvent" ADD CONSTRAINT "EquipmentUnitEvent_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentUnitEvent" ADD CONSTRAINT "EquipmentUnitEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: cria uma unidade rastreável em estoque para cada serial já cadastrado em lote ou individualmente.
INSERT INTO "EquipmentUnit" ("id", "itemId", "serialNumber", "status", "createdAt", "updatedAt")
SELECT CAST(md5(CAST(random() AS text) || CAST(clock_timestamp() AS text) || serials.value) AS uuid), i."id", serials.value, 'EM_ESTOQUE', now(), now()
FROM "Item" AS i
CROSS JOIN LATERAL jsonb_array_elements_text(i."serialNumbers") AS serials(value)
WHERE i."serialNumbers" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "EquipmentUnit" AS existing WHERE existing."serialNumber" = serials.value);

INSERT INTO "EquipmentUnit" ("id", "itemId", "serialNumber", "status", "createdAt", "updatedAt")
SELECT CAST(md5(CAST(random() AS text) || CAST(clock_timestamp() AS text) || i."serialNumber") AS uuid), i."id", i."serialNumber", 'EM_ESTOQUE', now(), now()
FROM "Item" AS i
WHERE i."serialNumber" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "EquipmentUnit" AS existing WHERE existing."serialNumber" = i."serialNumber");
