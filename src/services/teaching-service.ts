import { dateFromKey } from "@/domain/planning";
import {
  assessmentGradeInputSchema,
  studentSubjectRecordInputSchema,
  type AssessmentGradeInput,
  type StudentSubjectRecordInput,
} from "@/domain/teaching";
import { database } from "@/lib/database";

const recordInclude = { grades: { orderBy: { assessedAt: "desc" as const } } } as const;

export async function getTeachingPortfolio() {
  return database.teachingAssignment.findMany({
    where: { active: true },
    include: {
      subject: true,
      classroom: {
        include: {
          enrollments: {
            where: { endDate: null },
            include: { student: true },
            orderBy: [{ student: { firstName: "asc" } }, { student: { lastName: "asc" } }],
          },
        },
      },
      studentRecords: { include: recordInclude },
      timetableSlots: { where: { active: true }, orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] },
      teachingUnits: { orderBy: { sequenceOrder: "asc" } },
    },
    orderBy: [{ subject: { name: "asc" } }, { classroom: { name: "asc" } }],
  });
}

async function assertStudentBelongsToAssignment(teachingAssignmentId: string, studentId: string) {
  const assignment = await database.teachingAssignment.findUnique({
    where: { id: teachingAssignmentId },
    include: { classroom: { include: { enrollments: { where: { studentId, endDate: null }, take: 1 } } } },
  });
  if (!assignment?.active) throw new Error("La asignatura seleccionada no está activa.");
  if (!assignment.classroom.enrollments.length) throw new Error("El alumno no pertenece al grupo de esta asignatura.");
}

export async function saveStudentSubjectRecord(input: StudentSubjectRecordInput) {
  const value = studentSubjectRecordInputSchema.parse(input);
  await assertStudentBelongsToAssignment(value.teachingAssignmentId, value.studentId);
  return database.studentSubjectRecord.upsert({
    where: { teachingAssignmentId_studentId: { teachingAssignmentId: value.teachingAssignmentId, studentId: value.studentId } },
    update: {
      progressStatus: value.progressStatus,
      participationStatus: value.participationStatus,
      homeworkStatus: value.homeworkStatus,
      teacherNotes: value.teacherNotes,
      supportNotes: value.supportNotes,
    },
    create: value,
    include: recordInclude,
  });
}

export async function addAssessmentGrade(input: AssessmentGradeInput) {
  const value = assessmentGradeInputSchema.parse(input);
  await assertStudentBelongsToAssignment(value.teachingAssignmentId, value.studentId);
  return database.$transaction(async (transaction) => {
    const record = await transaction.studentSubjectRecord.upsert({
      where: { teachingAssignmentId_studentId: { teachingAssignmentId: value.teachingAssignmentId, studentId: value.studentId } },
      update: {},
      create: { teachingAssignmentId: value.teachingAssignmentId, studentId: value.studentId },
    });
    return transaction.assessmentGrade.create({ data: {
      studentRecordId: record.id,
      title: value.title,
      assessmentPeriod: value.assessmentPeriod,
      score: value.score,
      maxScore: value.maxScore,
      weight: value.weight,
      assessedAt: dateFromKey(value.assessedAt),
      notes: value.notes,
    }});
  });
}
