UPDATE "ServiceOrder"
SET "status" = 'REAGENDADA'
WHERE "status" = 'PENDENTE'
  AND "notes" LIKE '%[VISITA REAGENDADA]%';