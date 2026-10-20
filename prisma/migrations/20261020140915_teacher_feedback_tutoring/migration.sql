-- CreateTable
CREATE TABLE "TeacherFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "tutoringSessionId" TEXT,
    "teacherName" TEXT,
    "subject" TEXT,
    "originalComment" TEXT NOT NULL,
    "familyVersion" TEXT,
    "familyVersionSource" TEXT,
    "familyVersionStatus" TEXT NOT NULL DEFAULT 'proposed',
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeacherFeedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeacherFeedback_tutoringSessionId_fkey" FOREIGN KEY ("tutoringSessionId") REFERENCES "TutoringSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TeacherFeedback_studentId_receivedAt_idx" ON "TeacherFeedback"("studentId", "receivedAt");

-- CreateIndex
CREATE INDEX "TeacherFeedback_tutoringSessionId_idx" ON "TeacherFeedback"("tutoringSessionId");

-- CreateIndex
CREATE INDEX "TeacherFeedback_familyVersionStatus_receivedAt_idx" ON "TeacherFeedback"("familyVersionStatus", "receivedAt");
