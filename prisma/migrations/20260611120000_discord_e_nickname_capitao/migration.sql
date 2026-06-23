-- FreeAgent: contato (WhatsApp) -> discord (usuário do Discord)
ALTER TABLE "FreeAgent" RENAME COLUMN "contato" TO "discord";

-- Equipe: remove a lane do capitão (não é mais necessária)
ALTER TABLE "Equipe" DROP COLUMN "laneCapitao";

-- Equipe: contatoCapitao (WhatsApp) -> discord (usuário do Discord)
ALTER TABLE "Equipe" RENAME COLUMN "contatoCapitao" TO "discord";

-- Equipe: novo nickname do capitão (formato Nome#TAG, clicável para o League of Graphs)
ALTER TABLE "Equipe" ADD COLUMN "nicknameCapitao" TEXT NOT NULL DEFAULT '';
