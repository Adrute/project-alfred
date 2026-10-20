import { database } from "@/lib/database";
import { studentBatchSchema, type NewStudent } from "@/domain/student-admin";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
type ConversationTurn = { role: string; content: string };

export function isContextualStudentReference(message: string) {
  const raw = message.toLocaleLowerCase("es").trim();
  const text = normalize(message).trim();
  return /(?:^|[^\p{L}])(?:él|ella|ellos|ellas)(?:$|[^\p{L}])/u.test(raw)
    || /\b(?:ese|esa|este|esta)\s+(?:alumno|alumna|estudiante)\b/.test(text)
    || /\b(?:de|sobre|con|para)\s+(?:ese|esa|este|esta|aquel|aquella)\b/.test(text)
    || /\b(?:su|sus)\s+(?:familia|tutoria|observaciones?|grupo|clase)\b/.test(text)
    || /\b(?:prepara|preparar|haz)\b.*\b(?:tutoria|reunion)\b.*\b(?:familia|familiar)\b/.test(text)
    || /^[¿?¡!\s]*y\b/.test(text)
    || /^(?:[¿?¡!\s]*(?:apunta|anota|registra)\s+que)\b/.test(text)
    || /^(?:[¿?¡!\s]*que\s+observaciones?\s+tiene|[¿?¡!\s]*en\s+que\s+(?:grupo|clase)\s+esta|[¿?¡!\s]*como\s+va|[¿?¡!\s]*que\s+tal\s+va)\b/.test(text);
}

export async function listStudents(classroomId?: string) {
  return database.student.findMany({
    where: classroomId ? { enrollments: { some: { classroomId, endDate: null } } } : undefined,
    include: {
      enrollments: {
        where: { endDate: null },
        include: { classroom: { include: { teachingAssignments: { where: { active: true }, include: { subject: true } } } } },
      },
      observations: { orderBy: { observedAt: "desc" }, take: 5 },
      teacherFeedbacks: { orderBy: { receivedAt: "desc" }, take: 10 },
      tutoringSessions: { orderBy: { createdAt: "desc" }, take: 3 },
      subjectRecords: {
        include: {
          teachingAssignment: { include: { subject: true, classroom: true } },
          grades: { orderBy: { assessedAt: "desc" } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}

function studentKey(student: NewStudent) {
  return normalize(`${student.firstName} ${student.lastName}`).replace(/\s+/g, " ").trim();
}

export async function validateStudentBatch(classroomId: string, students: NewStudent[]) {
  const input = studentBatchSchema.parse({ classroomId, students });
  const classroom = await database.classroom.findUnique({
    where: { id: input.classroomId },
    include: { enrollments: { where: { endDate: null }, include: { student: true } } },
  });
  if (!classroom) throw new Error("La clase seleccionada ya no existe.");

  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const student of input.students) {
    const key = studentKey(student);
    if (seen.has(key)) repeated.add(`${student.firstName} ${student.lastName}`);
    seen.add(key);
  }
  if (repeated.size) throw new Error(`Hay alumnos repetidos en la lista: ${[...repeated].join(", ")}.`);

  const enrolled = new Set(classroom.enrollments.map((item) => studentKey(item.student)));
  const existing = input.students.filter((student) => enrolled.has(studentKey(student)));
  if (existing.length) {
    throw new Error(`Ya constan en ${classroom.name}: ${existing.map((item) => `${item.firstName} ${item.lastName}`).join(", ")}.`);
  }
  return { classroom, students: input.students };
}

export async function createStudentsBulk(classroomId: string, students: NewStudent[]) {
  const validated = await validateStudentBatch(classroomId, students);
  const startDate = new Date();
  return database.$transaction(async (tx) => {
    const created = [];
    for (const student of validated.students) {
      created.push(await tx.student.create({ data: {
        ...student,
        enrollments: { create: { classroomId: validated.classroom.id, startDate } },
      }}));
    }
    return { classroom: validated.classroom, students: created };
  });
}

export async function resolveStudents(message: string) {
  const students = await database.student.findMany({ orderBy: { firstName: "asc" } });
  const text = normalize(message);
  return students.filter((student) => {
    const first = normalize(student.firstName);
    const full = normalize(`${student.firstName} ${student.lastName}`);
    return new RegExp(`(^|[^a-z])${first}([^a-z]|$)`, "i").test(text) || text.includes(full);
  }).sort((a, b) => text.indexOf(normalize(a.firstName)) - text.indexOf(normalize(b.firstName)));
}

export async function getStudentsByIds(studentIds: string[]) {
  if (!studentIds.length) return [];
  const students = await database.student.findMany({ where: { id: { in: studentIds } } });
  const position = new Map(studentIds.map((id, index) => [id, index]));
  return students.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
}

export async function resolveStudentsInConversation(message: string, history: ConversationTurn[]) {
  const directMatches = await resolveStudents(message);
  if (directMatches.length || !isContextualStudentReference(message)) return directMatches;

  for (const turn of history.slice().reverse()) {
    const contextualMatches = await resolveStudents(turn.content);
    if (contextualMatches.length === 1) return contextualMatches;
  }
  return [];
}

export async function getStudentProfile(studentId: string) {
  return database.student.findUnique({
    where: { id: studentId },
    include: {
      enrollments: {
        where: { endDate: null },
        include: { classroom: { include: { teachingAssignments: { where: { active: true }, include: { subject: true } } } } },
      },
      observations: { orderBy: { observedAt: "desc" } },
      teacherFeedbacks: { orderBy: { receivedAt: "desc" } },
      relationshipsAsA: { where: { active: true }, include: { studentB: true }, orderBy: { observedAt: "desc" } },
      relationshipsAsB: { where: { active: true }, include: { studentA: true }, orderBy: { observedAt: "desc" } },
      tutoringSessions: { include: { agreements: true }, orderBy: { createdAt: "desc" } },
      subjectRecords: {
        include: {
          teachingAssignment: { include: { subject: true, classroom: true } },
          grades: { orderBy: { assessedAt: "desc" } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
}

export async function getRecentObservations(days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return database.studentObservation.findMany({
    where: { observedAt: { gte: since } },
    include: { student: true }, orderBy: { observedAt: "desc" },
  });
}

export async function getFoodSafetyObservations() {
  const observations = await database.studentObservation.findMany({
    where: { confirmationStatus: "confirmed" },
    include: { student: true },
    orderBy: { observedAt: "desc" },
  });
  return observations.filter((item) =>
    item.category === "health_accommodation"
    || /alerg|intoler|cel[ií]a|gluten|lactos|frutos secos|cacahu|marisco/i.test(normalize(item.content)),
  );
}
