-- User: vínculo real do Discord (OAuth). O contato passa a ser o discordId vinculado.
ALTER TABLE "User" ADD COLUMN "discordId" TEXT;
ALTER TABLE "User" ADD COLUMN "discordUsername" TEXT;
ALTER TABLE "User" ADD COLUMN "discordAccessToken" TEXT;
ALTER TABLE "User" ADD COLUMN "discordRefreshToken" TEXT;
ALTER TABLE "User" ADD COLUMN "discordTokenExpires" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- Os campos de texto livre do Discord saem; a verdade agora é User.discordId/discordUsername.
ALTER TABLE "FreeAgent" DROP COLUMN "discord";
ALTER TABLE "Equipe" DROP COLUMN "discord";
