ALTER TABLE "Item" ADD COLUMN "serialized" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Item" SET "serialized" = true WHERE "type" = 'EQUIPAMENTO';