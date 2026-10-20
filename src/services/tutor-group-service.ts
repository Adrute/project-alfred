import { tutorGroupInputSchema, type TutorGroupInput } from "@/domain/teaching";
import { database } from "@/lib/database";
import type { Prisma } from "@/generated/prisma/client";

const tutorClassroomInclude = {
  enrollments: {
    where: { endDate: null },
    include: {
      student: {
        include: {
          observations: { orderBy: { observedAt: "desc" as const }, take: 5 },
          teacherFeedbacks: { orderBy: { receivedAt: "desc" as const } },
          tutoringSessions: {
            include: { agreements: true, teacherFeedbacks: { orderBy: { receivedAt: "desc" as const } } },
            orderBy: { createdAt: "desc" as const },
          },
        },
      },
    },
    orderBy: [{ student: { firstName: "asc" } }, { student: { lastName: "asc" } }],
  },
} satisfies Prisma.ClassroomInclude;

export async function getTutorWorkspace() {
  const [classroom, availableClassrooms] = await Promise.all([
    database.classroom.findFirst({
      where: { isTutorGroup: true },
      include: tutorClassroomInclude,
      orderBy: { updatedAt: "desc" },
    }),
    database.classroom.findMany({
      select: { id: true, name: true, academicYear: true, educationalStage: true, isTutorGroup: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { classroom, availableClassrooms };
}

export async function setTutorGroup(input: TutorGroupInput) {
  const value = tutorGroupInputSchema.parse(input);
  const classroom = await database.classroom.findUnique({ where: { id: value.classroomId } });
  if (!classroom) throw new Error("El grupo seleccionado no existe.");
  await database.$transaction(async (transaction) => {
    await transaction.classroom.updateMany({ where: { isTutorGroup: true }, data: { isTutorGroup: false } });
    await transaction.classroom.update({
      where: { id: value.classroomId },
      data: { isTutorGroup: true, ...(value.tutorNotes !== undefined ? { tutorNotes: value.tutorNotes } : {}) },
    });
  });
  return getTutorWorkspace();
}
