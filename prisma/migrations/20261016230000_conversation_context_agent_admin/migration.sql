-- AlterTable
ALTER TABLE "Message" ADD COLUMN "agentId" TEXT;

-- CreateTable
CREATE TABLE "AgentRuntime" (
    "agentId" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" DATETIME,
    "stoppedAt" DATETIME,
    "restartedAt" DATETIME,
    "restartCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "AgentRuntime_status_updatedAt_idx" ON "AgentRuntime"("status", "updatedAt");
