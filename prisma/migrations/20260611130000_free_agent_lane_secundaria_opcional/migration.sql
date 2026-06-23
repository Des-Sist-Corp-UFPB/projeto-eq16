-- FreeAgent: lane secundária passa a ser opcional.
-- Quem escolhe FILL como lane principal não precisa de secundária.
ALTER TABLE "FreeAgent" ALTER COLUMN "laneSecundaria" DROP NOT NULL;
