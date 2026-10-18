-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#315746',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TeachingAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeachingAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeachingAssignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklyTimetable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Madrid',
    "validFrom" DATETIME NOT NULL,
    "validUntil" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TimetableSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weeklyTimetableId" TEXT NOT NULL,
    "teachingAssignmentId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "activityType" TEXT NOT NULL DEFAULT 'class',
    "room" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimetableSlot_weeklyTimetableId_fkey" FOREIGN KEY ("weeklyTimetableId") REFERENCES "WeeklyTimetable" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimetableSlot_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "TeachingAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanningException" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timetableSlotId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "kind" TEXT NOT NULL,
    "overrideStartMinute" INTEGER,
    "overrideEndMinute" INTEGER,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanningException_timetableSlotId_fkey" FOREIGN KEY ("timetableSlotId") REFERENCES "TimetableSlot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeachingUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teachingAssignmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "objectives" TEXT NOT NULL DEFAULT '[]',
    "sequenceOrder" INTEGER NOT NULL,
    "estimatedSessions" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "plannedStartDate" DATETIME,
    "plannedEndDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeachingUnit_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "TeachingAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LearningContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teachingUnitId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sequenceOrder" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LearningContent_teachingUnitId_fkey" FOREIGN KEY ("teachingUnitId") REFERENCES "TeachingUnit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LessonPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teachingAssignmentId" TEXT NOT NULL,
    "timetableSlotId" TEXT,
    "teachingUnitId" TEXT,
    "date" DATETIME NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "objectives" TEXT NOT NULL DEFAULT '[]',
    "materials" TEXT NOT NULL DEFAULT '[]',
    "homework" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unplanned',
    "postLessonNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LessonPlan_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "TeachingAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LessonPlan_timetableSlotId_fkey" FOREIGN KEY ("timetableSlotId") REFERENCES "TimetableSlot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LessonPlan_teachingUnitId_fkey" FOREIGN KEY ("teachingUnitId") REFERENCES "TeachingUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LessonActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonPlanId" TEXT NOT NULL,
    "learningContentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "activityType" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "executionStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LessonActivity_lessonPlanId_fkey" FOREIGN KEY ("lessonPlanId") REFERENCES "LessonPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LessonActivity_learningContentId_fkey" FOREIGN KEY ("learningContentId") REFERENCES "LearningContent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LessonExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonPlanId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "activitySnapshot" TEXT NOT NULL,
    "confirmedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LessonExecution_lessonPlanId_fkey" FOREIGN KEY ("lessonPlanId") REFERENCES "LessonPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanningChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "beforeSnapshot" TEXT,
    "afterSnapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Subject_code_key" ON "Subject"("code");

-- CreateIndex
CREATE INDEX "Subject_name_idx" ON "Subject"("name");

-- CreateIndex
CREATE INDEX "TeachingAssignment_classroomId_active_idx" ON "TeachingAssignment"("classroomId", "active");

-- CreateIndex
CREATE INDEX "TeachingAssignment_subjectId_active_idx" ON "TeachingAssignment"("subjectId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingAssignment_subjectId_classroomId_academicYear_key" ON "TeachingAssignment"("subjectId", "classroomId", "academicYear");

-- CreateIndex
CREATE INDEX "WeeklyTimetable_active_validFrom_validUntil_idx" ON "WeeklyTimetable"("active", "validFrom", "validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyTimetable_name_academicYear_key" ON "WeeklyTimetable"("name", "academicYear");

-- CreateIndex
CREATE INDEX "TimetableSlot_teachingAssignmentId_dayOfWeek_idx" ON "TimetableSlot"("teachingAssignmentId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "TimetableSlot_active_dayOfWeek_idx" ON "TimetableSlot"("active", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableSlot_weeklyTimetableId_dayOfWeek_startMinute_key" ON "TimetableSlot"("weeklyTimetableId", "dayOfWeek", "startMinute");

-- CreateIndex
CREATE INDEX "PlanningException_date_kind_idx" ON "PlanningException"("date", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningException_timetableSlotId_date_key" ON "PlanningException"("timetableSlotId", "date");

-- CreateIndex
CREATE INDEX "TeachingUnit_teachingAssignmentId_status_idx" ON "TeachingUnit"("teachingAssignmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingUnit_teachingAssignmentId_sequenceOrder_key" ON "TeachingUnit"("teachingAssignmentId", "sequenceOrder");

-- CreateIndex
CREATE INDEX "LearningContent_teachingUnitId_status_idx" ON "LearningContent"("teachingUnitId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LearningContent_teachingUnitId_sequenceOrder_key" ON "LearningContent"("teachingUnitId", "sequenceOrder");

-- CreateIndex
CREATE INDEX "LessonPlan_date_startMinute_idx" ON "LessonPlan"("date", "startMinute");

-- CreateIndex
CREATE INDEX "LessonPlan_teachingAssignmentId_date_idx" ON "LessonPlan"("teachingAssignmentId", "date");

-- CreateIndex
CREATE INDEX "LessonPlan_status_date_idx" ON "LessonPlan"("status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "LessonPlan_timetableSlotId_date_key" ON "LessonPlan"("timetableSlotId", "date");

-- CreateIndex
CREATE INDEX "LessonActivity_lessonPlanId_executionStatus_idx" ON "LessonActivity"("lessonPlanId", "executionStatus");

-- CreateIndex
CREATE INDEX "LessonActivity_learningContentId_idx" ON "LessonActivity"("learningContentId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonActivity_lessonPlanId_sequenceOrder_key" ON "LessonActivity"("lessonPlanId", "sequenceOrder");

-- CreateIndex
CREATE INDEX "LessonExecution_lessonPlanId_confirmedAt_idx" ON "LessonExecution"("lessonPlanId", "confirmedAt");

-- CreateIndex
CREATE INDEX "PlanningChange_entityType_entityId_createdAt_idx" ON "PlanningChange"("entityType", "entityId", "createdAt");
