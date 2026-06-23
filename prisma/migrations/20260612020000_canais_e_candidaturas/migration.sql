-- Enums novos
CREATE TYPE "StatusEquipe" AS ENUM ('ABERTA', 'COMPLETA');
CREATE TYPE "StatusCandidatura" AS ENUM ('PENDENTE', 'ACEITA', 'RECUSADA');

-- Equipe: canal privado do Discord + status
ALTER TABLE "Equipe" ADD COLUMN "discordChannelId" TEXT;
ALTER TABLE "Equipe" ADD COLUMN "status" "StatusEquipe" NOT NULL DEFAULT 'ABERTA';

-- Candidatura: rastreia quem solicitou cada vaga
CREATE TABLE "Candidatura" (
  "id" TEXT NOT NULL,
  "lane" "Lane" NOT NULL,
  "status" "StatusCandidatura" NOT NULL DEFAULT 'PENDENTE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "equipeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "Candidatura_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Candidatura_equipeId_userId_lane_key" ON "Candidatura"("equipeId", "userId", "lane");

ALTER TABLE "Candidatura" ADD CONSTRAINT "Candidatura_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "Equipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Candidatura" ADD CONSTRAINT "Candidatura_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
