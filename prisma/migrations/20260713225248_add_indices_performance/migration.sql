-- CreateIndex
CREATE INDEX "Candidatura_userId_idx" ON "Candidatura"("userId");

-- CreateIndex
CREATE INDEX "Equipe_userId_idx" ON "Equipe"("userId");

-- CreateIndex
CREATE INDEX "Equipe_createdAt_idx" ON "Equipe"("createdAt");

-- CreateIndex
CREATE INDEX "FreeAgent_userId_idx" ON "FreeAgent"("userId");

-- CreateIndex
CREATE INDEX "FreeAgent_createdAt_idx" ON "FreeAgent"("createdAt");
