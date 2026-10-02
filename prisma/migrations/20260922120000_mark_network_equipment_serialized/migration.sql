UPDATE "Item"
SET "serialized" = true
WHERE "name" ILIKE '%roteador%'
   OR "name" ILIKE '%onu%'
   OR "name" ILIKE '%bridge%';