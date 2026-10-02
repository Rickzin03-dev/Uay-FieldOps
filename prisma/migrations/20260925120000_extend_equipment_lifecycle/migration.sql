ALTER TYPE "EquipmentUnitStatus" ADD VALUE 'EM_CONFERENCIA';
ALTER TYPE "EquipmentUnitStatus" ADD VALUE 'RESERVADO';
ALTER TYPE "EquipmentUnitStatus" ADD VALUE 'DANIFICADO';
ALTER TYPE "EquipmentUnitStatus" ADD VALUE 'DESCARTADO';

ALTER TYPE "EquipmentUnitEventType" ADD VALUE 'CONFERENCIA';

ALTER TABLE "ServiceOrder" ADD COLUMN "contractId" TEXT;
ALTER TABLE "EquipmentUnit" ADD COLUMN "contractId" TEXT;
ALTER TABLE "EquipmentUnitEvent" ADD COLUMN "contractId" TEXT;