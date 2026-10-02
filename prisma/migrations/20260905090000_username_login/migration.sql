-- Existing accounts keep their credentials while receiving a short login name.
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

UPDATE "User"
SET "username" = COALESCE(NULLIF(regexp_replace(split_part("email", '@', 1), '[^a-zA-Z0-9._-]+', '', 'g'), ''), 'usuario') || '-' || substr("id", 1, 8)
WHERE "username" IS NULL;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;