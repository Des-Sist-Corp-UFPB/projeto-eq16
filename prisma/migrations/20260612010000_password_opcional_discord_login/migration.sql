-- Contas criadas via login do Discord não têm senha local.
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;
