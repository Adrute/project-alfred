-- CreateTable
CREATE TABLE "StudentSubjectRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teachingAssignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "progressStatus" TEXT NOT NULL DEFAULT 'not_assessed',
    "participationStatus" TEXT NOT NULL DEFAULT 'not_assessed',
    "homeworkStatus" TEXT NOT NULL DEFAULT 'not_assessed',
    "teacherNotes" TEXT,
    "supportNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentSubjectRecord_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "TeachingAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentSubjectRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentGrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentRecordId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assessmentPeriod" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "maxScore" REAL NOT NULL DEFAULT 10,
    "weight" REAL NOT NULL DEFAULT 1,
    "assessedAt" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssessmentGrade_studentRecordId_fkey" FOREIGN KEY ("studentRecordId") REFERENCES "StudentSubjectRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Classroom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "educationalStage" TEXT NOT NULL,
    "isTutorGroup" BOOLEAN NOT NULL DEFAULT false,
    "tutorNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Classroom" ("academicYear", "createdAt", "educationalStage", "id", "name", "updatedAt") SELECT "academicYear", "createdAt", "educationalStage", "id", "name", "updatedAt" FROM "Classroom";
DROP TABLE "Classroom";
ALTER TABLE "new_Classroom" RENAME TO "Classroom";
CREATE INDEX "Classroom_academicYear_idx" ON "Classroom"("academicYear");
CREATE UNIQUE INDEX "Classroom_name_academicYear_key" ON "Classroom"("name", "academicYear");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StudentSubjectRecord_studentId_updatedAt_idx" ON "StudentSubjectRecord"("studentId", "updatedAt");

-- CreateIndex
CREATE INDEX "StudentSubjectRecord_teachingAssignmentId_progressStatus_idx" ON "StudentSubjectRecord"("teachingAssignmentId", "progressStatus");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSubjectRecord_teachingAssignmentId_studentId_key" ON "StudentSubjectRecord"("teachingAssignmentId", "studentId");

-- CreateIndex
CREATE INDEX "AssessmentGrade_studentRecordId_assessmentPeriod_idx" ON "AssessmentGrade"("studentRecordId", "assessmentPeriod");

-- CreateIndex
CREATE INDEX "AssessmentGrade_assessedAt_idx" ON "AssessmentGrade"("assessedAt");
