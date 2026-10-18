-- CreateTable
CREATE TABLE "Classroom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "educationalStage" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StudentEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    CONSTRAINT "StudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentEnrollment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "observedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "confirmationStatus" TEXT NOT NULL DEFAULT 'confirmed',
    CONSTRAINT "StudentObservation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentRelationship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentAId" TEXT NOT NULL,
    "studentBId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "observedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "StudentRelationship_studentAId_fkey" FOREIGN KEY ("studentAId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentRelationship_studentBId_fkey" FOREIGN KEY ("studentBId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TutoringSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "scheduledAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "preparation" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TutoringSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TutoringAgreement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tutoringSessionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TutoringAgreement_tutoringSessionId_fkey" FOREIGN KEY ("tutoringSessionId") REFERENCES "TutoringSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SeatingLayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classroomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rows" INTEGER NOT NULL,
    "columns" INTEGER NOT NULL,
    "configuration" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SeatingLayout_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SeatingAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seatingLayoutId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "column" INTEGER NOT NULL,
    CONSTRAINT "SeatingAssignment_seatingLayoutId_fkey" FOREIGN KEY ("seatingLayoutId") REFERENCES "SeatingLayout" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeatingAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "error" TEXT
);

-- CreateTable
CREATE TABLE "PendingAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operation" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" DATETIME,
    "executedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "Classroom_academicYear_idx" ON "Classroom"("academicYear");
CREATE UNIQUE INDEX "Classroom_name_academicYear_key" ON "Classroom"("name", "academicYear");
CREATE INDEX "Student_firstName_lastName_idx" ON "Student"("firstName", "lastName");
CREATE INDEX "StudentEnrollment_classroomId_endDate_idx" ON "StudentEnrollment"("classroomId", "endDate");
CREATE INDEX "StudentEnrollment_studentId_endDate_idx" ON "StudentEnrollment"("studentId", "endDate");
CREATE UNIQUE INDEX "StudentEnrollment_studentId_classroomId_startDate_key" ON "StudentEnrollment"("studentId", "classroomId", "startDate");
CREATE INDEX "StudentObservation_studentId_observedAt_idx" ON "StudentObservation"("studentId", "observedAt");
CREATE INDEX "StudentObservation_category_observedAt_idx" ON "StudentObservation"("category", "observedAt");
CREATE INDEX "StudentObservation_confirmationStatus_idx" ON "StudentObservation"("confirmationStatus");
CREATE INDEX "StudentRelationship_studentAId_active_idx" ON "StudentRelationship"("studentAId", "active");
CREATE INDEX "StudentRelationship_studentBId_active_idx" ON "StudentRelationship"("studentBId", "active");
CREATE INDEX "StudentRelationship_relationshipType_active_idx" ON "StudentRelationship"("relationshipType", "active");
CREATE INDEX "TutoringSession_studentId_scheduledAt_idx" ON "TutoringSession"("studentId", "scheduledAt");
CREATE INDEX "TutoringSession_status_scheduledAt_idx" ON "TutoringSession"("status", "scheduledAt");
CREATE INDEX "TutoringAgreement_tutoringSessionId_status_idx" ON "TutoringAgreement"("tutoringSessionId", "status");
CREATE INDEX "TutoringAgreement_dueDate_idx" ON "TutoringAgreement"("dueDate");
CREATE INDEX "Conversation_updatedAt_idx" ON "Conversation"("updatedAt");
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX "SeatingLayout_classroomId_updatedAt_idx" ON "SeatingLayout"("classroomId", "updatedAt");
CREATE UNIQUE INDEX "SeatingLayout_classroomId_name_key" ON "SeatingLayout"("classroomId", "name");
CREATE INDEX "SeatingAssignment_studentId_idx" ON "SeatingAssignment"("studentId");
CREATE UNIQUE INDEX "SeatingAssignment_seatingLayoutId_studentId_key" ON "SeatingAssignment"("seatingLayoutId", "studentId");
CREATE UNIQUE INDEX "SeatingAssignment_seatingLayoutId_row_column_key" ON "SeatingAssignment"("seatingLayoutId", "row", "column");
CREATE INDEX "AgentExecution_agentId_startedAt_idx" ON "AgentExecution"("agentId", "startedAt");
CREATE INDEX "AgentExecution_status_startedAt_idx" ON "AgentExecution"("status", "startedAt");
CREATE UNIQUE INDEX "PendingAction_idempotencyKey_key" ON "PendingAction"("idempotencyKey");
CREATE INDEX "PendingAction_status_createdAt_idx" ON "PendingAction"("status", "createdAt");
