import { database } from "@/lib/database";
import { generateSeating, validateSeatingAssignments, type SeatingConstraints } from "@/domain/seating";

export async function listClassrooms() {
  return database.classroom.findMany({
    include: {
      enrollments: {
        where: { endDate: null },
        include: { student: { include: { observations: { orderBy: { observedAt: "desc" } } } } },
      },
      seatingLayouts: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { name: "asc" },
  });
}

export async function calculateClassroomLayout(classroomId: string, rows = 5, columns = 5) {
  const classroom = await database.classroom.findUnique({
    where: { id: classroomId },
    include: {
      enrollments: { where: { endDate: null }, include: { student: { include: { observations: true } } } },
    },
  });
  if (!classroom) throw new Error("No se encontró la clase.");
  const relationships = await database.studentRelationship.findMany({ where: { active: true } });
  const memberIds = new Set(classroom.enrollments.map((item) => item.studentId));
  const relevant = relationships.filter((item) => memberIds.has(item.studentAId) && memberIds.has(item.studentBId));
  const constraints = {
    rows, columns,
    frontStudentIds: classroom.enrollments.filter((item) => item.student.observations.some((observation) =>
      observation.category === "seating_need" || /cerca de la pizarra|primera fila/i.test(observation.content),
    )).map((item) => item.studentId),
    separatePairs: relevant.filter((item) => item.relationshipType === "avoid_adjacent").map((item) => [item.studentAId, item.studentBId] as [string, string]),
    togetherPairs: relevant.filter((item) => item.relationshipType === "works_well").map((item) => [item.studentAId, item.studentBId] as [string, string]),
  };
  const students = classroom.enrollments.map((item) => ({ id: item.studentId, name: `${item.student.firstName} ${item.student.lastName}` }));
  const result = generateSeating(students, constraints);
  return { classroom, students, constraints, result };
}

export async function getLatestLayout(classroomId?: string) {
  return database.seatingLayout.findFirst({
    where: classroomId ? { classroomId } : undefined,
    include: { classroom: true, assignments: { include: { student: true }, orderBy: [{ row: "asc" }, { column: "asc" }] } },
    orderBy: { createdAt: "desc" },
  });
}

export async function swapAssignments(layoutId: string, firstId: string, secondId: string) {
  return database.$transaction(async (tx) => {
    const layout = await tx.seatingLayout.findUnique({ where: { id: layoutId }, include: { assignments: true } });
    if (!layout) throw new Error("No se encontró el plano.");
    const [first, second] = await Promise.all([
      tx.seatingAssignment.findFirst({ where: { seatingLayoutId: layoutId, id: firstId } }),
      tx.seatingAssignment.findFirst({ where: { seatingLayoutId: layoutId, id: secondId } }),
    ]);
    if (!first || !second) throw new Error("No se encontraron los dos asientos.");
    const assignments = layout.assignments.map((item) => {
      if (item.id === first.id) return { studentId: item.studentId, row: second.row, column: second.column };
      if (item.id === second.id) return { studentId: item.studentId, row: first.row, column: first.column };
      return { studentId: item.studentId, row: item.row, column: item.column };
    });
    const stored = JSON.parse(layout.configuration) as { constraints?: SeatingConstraints };
    if (stored.constraints) {
      const validation = validateSeatingAssignments(assignments, stored.constraints);
      if (!validation.valid) throw new Error(validation.explanation);
    }
    const temporaryRow = 9999;
    await tx.seatingAssignment.update({ where: { id: first.id }, data: { row: temporaryRow, column: temporaryRow } });
    await tx.seatingAssignment.update({ where: { id: second.id }, data: { row: first.row, column: first.column } });
    await tx.seatingAssignment.update({ where: { id: first.id }, data: { row: second.row, column: second.column } });
    return tx.seatingLayout.findUnique({ where: { id: layoutId }, include: { assignments: { include: { student: true } } } });
  });
}
