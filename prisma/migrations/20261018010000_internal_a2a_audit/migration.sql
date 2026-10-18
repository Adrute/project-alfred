-- CreateTable
CREATE TABLE "AgentConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "userConversationId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "AgentConversation_userConversationId_fkey" FOREIGN KEY ("userConversationId") REFERENCES "Conversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentConversationId" TEXT NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT '1.0',
    "messageId" TEXT NOT NULL,
    "fromAgentId" TEXT NOT NULL,
    "toAgentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentMessage_agentConversationId_fkey" FOREIGN KEY ("agentConversationId") REFERENCES "AgentConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentConversation_requestId_key" ON "AgentConversation"("requestId");
CREATE INDEX "AgentConversation_userConversationId_createdAt_idx" ON "AgentConversation"("userConversationId", "createdAt");
CREATE INDEX "AgentConversation_status_createdAt_idx" ON "AgentConversation"("status", "createdAt");
CREATE UNIQUE INDEX "AgentMessage_messageId_key" ON "AgentMessage"("messageId");
CREATE INDEX "AgentMessage_agentConversationId_createdAt_idx" ON "AgentMessage"("agentConversationId", "createdAt");
CREATE INDEX "AgentMessage_fromAgentId_toAgentId_createdAt_idx" ON "AgentMessage"("fromAgentId", "toAgentId", "createdAt");
CREATE INDEX "AgentMessage_capability_createdAt_idx" ON "AgentMessage"("capability", "createdAt");
