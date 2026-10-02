CREATE TYPE "MaterialControlType" AS ENUM ('CONVENCIONAL', 'CABEAMENTO');

ALTER TABLE "Item"
  ADD COLUMN "materialControlType" "MaterialControlType" NOT NULL DEFAULT 'CONVENCIONAL',
  ADD COLUMN "metersPerUnit" DECIMAL(14,3),
  ADD COLUMN "availableMeters" DECIMAL(14,3);

ALTER TABLE "StockBalance"
  ADD COLUMN "availableMeters" DECIMAL(14,3);

ALTER TABLE "Movement"
  ADD COLUMN "meters" DECIMAL(14,3);