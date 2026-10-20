-- CreateTable
CREATE TABLE "CloudAiTrace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'openai-chatgpt',
    "endpoint" TEXT NOT NULL DEFAULT 'https://api.openai.com/v1/responses',
    "operation" TEXT NOT NULL DEFAULT 'llm_request',
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "requestBodyJson" TEXT NOT NULL,
    "responseBodyJson" TEXT,
    "responseId" TEXT,
    "requestId" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "durationMs" INTEGER,
    "studentAliasCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "CloudAiTrace_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CloudAiTrace_createdAt_idx" ON "CloudAiTrace"("createdAt");
CREATE INDEX "CloudAiTrace_status_createdAt_idx" ON "CloudAiTrace"("status", "createdAt");
CREATE INDEX "CloudAiTrace_model_createdAt_idx" ON "CloudAiTrace"("model", "createdAt");
CREATE INDEX "CloudAiTrace_operation_createdAt_idx" ON "CloudAiTrace"("operation", "createdAt");
CREATE INDEX "CloudAiTrace_conversationId_createdAt_idx" ON "CloudAiTrace"("conversationId", "createdAt");
