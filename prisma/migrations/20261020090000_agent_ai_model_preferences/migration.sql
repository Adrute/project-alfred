-- AlterTable
ALTER TABLE "AgentRuntime" ADD COLUMN "aiModel" TEXT;

-- AlterTable
ALTER TABLE "CloudAiTrace" ADD COLUMN "agentId" TEXT;

-- CreateIndex
CREATE INDEX "CloudAiTrace_agentId_createdAt_idx" ON "CloudAiTrace"("agentId", "createdAt");
