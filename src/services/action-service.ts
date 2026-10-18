import { createHash, randomUUID } from "node:crypto";
import { database } from "@/lib/database";
import { pendingActionPayloadSchema, type PendingActionPayload } from "@/domain/actions";
import { agentDefinitions } from "@/agents/definitions";
import { addDays, dateFromKey, hasTimeOverlap, minuteLabel } from "@/domain/planning";
import { generateWeekSessions } from "./planning-service";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/\s+/g, " ").trim();

function subjectCodeBase(name: string) {
  const code = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase();
  return (code || "ASIGNATURA").slice(0, 24);
}

export async function proposeAction(payload: PendingActionPayload) {
  const validated = pendingActionPayloadSchema.parse(payload);
  const serialized = JSON.stringify(validated);
  const idempotencyKey = createHash("sha256")
    .update(`${serialized}:${randomUUID()}`)
    .digest("hex");
  return database.pendingAction.create({
    data: { operation: validated.type, payload: serialized, idempotencyKey },
  });
}

export async function confirmAction(actionId: string) {
  const proposal = await database.pendingAction.findUnique({ where: { id: actionId } });
  if (!proposal) throw new Error("No existe la propuesta solicitada.");
  const proposedPayload = pendingActionPayloadSchema.parse(JSON.parse(proposal.payload));
  if (proposedPayload.type === "plan_week" && proposal.status === "pending") {
    await generateWeekSessions(proposedPayload.weekStart);
  }
  return database.$transaction(async (tx) => {
    const action = await tx.pendingAction.findUnique({ where: { id: actionId } });
    if (!action) throw new Error("No existe la propuesta solicitada.");
    if (action.status === "executed") return { action, alreadyExecuted: true };
    if (action.status !== "pending") throw new Error("La propuesta ya no se puede confirmar.");
    const payload = pendingActionPayloadSchema.parse(JSON.parse(action.payload));
    let entityId = "";

    if (payload.type === "record_observation") {
      for (const studentId of payload.studentIds) {
        const observation = await tx.studentObservation.create({ data: {
          studentId, content: payload.content, category: payload.category,
          source: "teacher_statement", observedAt: new Date(payload.observedAt),
          confirmationStatus: "confirmed",
        }});
        entityId ||= observation.id;
      }
      if (payload.relationship) {
        const relation = payload.relationship;
        if (relation.deactivateTypes.length) {
          await tx.studentRelationship.updateMany({
            where: {
              OR: [
                { studentAId: relation.studentAId, studentBId: relation.studentBId },
                { studentAId: relation.studentBId, studentBId: relation.studentAId },
              ],
              relationshipType: { in: relation.deactivateTypes }, active: true,
            }, data: { active: false },
          });
        }
        await tx.studentRelationship.create({ data: {
          studentAId: relation.studentAId, studentBId: relation.studentBId,
          relationshipType: relation.relationshipType, description: relation.description,
          source: "teacher_statement", observedAt: new Date(payload.observedAt), active: true,
        }});
      }
    } else if (payload.type === "save_tutoring") {
      const tutoring = await tx.tutoringSession.create({ data: {
        studentId: payload.studentId, status: "prepared", preparation: payload.preparation,
      }});
      entityId = tutoring.id;
    } else if (payload.type === "save_layout") {
      const layout = await tx.seatingLayout.create({ data: {
        classroomId: payload.classroomId, name: payload.name, rows: payload.rows,
        columns: payload.columns, configuration: payload.configuration,
        assignments: { create: payload.assignments },
      }});
      entityId = layout.id;
    } else if (payload.type === "plan_week") {
      const lessons = await tx.lessonPlan.findMany({
        where: {
          date: { gte: dateFromKey(payload.weekStart), lte: dateFromKey(addDays(payload.weekStart, 6)) },
          status: "unplanned",
        },
        include: { teachingUnit: { include: { contents: { where: { status: { not: "completed" } }, orderBy: { sequenceOrder: "asc" } } } } },
        orderBy: [{ date: "asc" }, { startMinute: "asc" }],
      });
      for (const lesson of lessons) {
        const duration = lesson.endMinute - lesson.startMinute;
        const content = lesson.teachingUnit?.contents[0];
        const middle = Math.max(10, duration - 20);
        const activities = [
          { name: "Activación y repaso", durationMinutes: 5, activityType: "review" },
          { name: content ? content.title : "Desarrollo del contenido", durationMinutes: middle, activityType: "explanation", learningContentId: content?.id },
          { name: "Práctica y cierre", durationMinutes: duration - middle - 5, activityType: "exercises", learningContentId: content?.id },
        ];
        for (const [index, activity] of activities.entries()) {
          await tx.lessonActivity.create({ data: { ...activity, lessonPlanId: lesson.id, sequenceOrder: index + 1 } });
        }
        await tx.lessonPlan.update({ where: { id: lesson.id }, data: {
          status: "planned",
          objectives: lesson.teachingUnit?.objectives ?? "[]",
          materials: JSON.stringify(["Pizarra", "Material de aula"]),
        }});
        entityId ||= lesson.id;
      }
      await tx.planningChange.create({ data: {
        entityType: "WeekPlan", entityId: payload.weekStart, changeType: "planned",
        afterSnapshot: JSON.stringify({ weekStart: payload.weekStart, lessonIds: lessons.map((item) => item.id) }),
      }});
    } else if (payload.type === "create_classroom") {
      const classroom = await tx.classroom.create({ data: {
        name: payload.name,
        academicYear: payload.academicYear,
        educationalStage: payload.educationalStage,
      }});
      entityId = classroom.id;
    } else if (payload.type === "create_student") {
      const classroom = await tx.classroom.findUnique({ where: { id: payload.classroomId } });
      if (!classroom) throw new Error("La clase seleccionada ya no existe.");
      const student = await tx.student.create({ data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        enrollments: { create: { classroomId: classroom.id, startDate: new Date() } },
      }});
      entityId = student.id;
    } else if (payload.type === "create_students_bulk") {
      const classroom = await tx.classroom.findUnique({
        where: { id: payload.classroomId },
        include: { enrollments: { where: { endDate: null }, include: { student: true } } },
      });
      if (!classroom) throw new Error("La clase seleccionada ya no existe.");
      const enrolled = new Set(classroom.enrollments.map((item) => normalize(`${item.student.firstName} ${item.student.lastName}`)));
      const incoming = new Set<string>();
      for (const student of payload.students) {
        const key = normalize(`${student.firstName} ${student.lastName}`);
        if (incoming.has(key)) throw new Error(`El alumno ${student.firstName} ${student.lastName} aparece repetido en la propuesta.`);
        if (enrolled.has(key)) throw new Error(`${student.firstName} ${student.lastName} ya consta en ${classroom.name}.`);
        incoming.add(key);
      }
      const startDate = new Date();
      for (const student of payload.students) {
        const created = await tx.student.create({ data: {
          ...student,
          enrollments: { create: { classroomId: classroom.id, startDate } },
        }});
        entityId ||= created.id;
      }
    } else if (payload.type === "create_teaching_schedule") {
      const timetableName = "Horario docente";
      const startYear = payload.academicYear.slice(0, 4);
      const timetable = await tx.weeklyTimetable.upsert({
        where: { name_academicYear: { name: timetableName, academicYear: payload.academicYear } },
        update: { active: true, timezone: payload.timezone },
        create: {
          name: timetableName,
          academicYear: payload.academicYear,
          timezone: payload.timezone,
          validFrom: new Date(`${startYear}-09-01T00:00:00.000Z`),
        },
      });
      const occupied = await tx.timetableSlot.findMany({
        where: { weeklyTimetableId: timetable.id, active: true },
        include: { teachingAssignment: { include: { classroom: true, subject: true } } },
      });
      let createdSlots = 0;
      for (const entry of payload.entries) {
        const overlap = occupied.find((slot) => slot.dayOfWeek === entry.dayOfWeek && hasTimeOverlap(slot, entry));
        const same = overlap
          && overlap.startMinute === entry.startMinute
          && overlap.endMinute === entry.endMinute
          && normalize(overlap.teachingAssignment.classroom.name) === normalize(entry.classroomName)
          && normalize(overlap.teachingAssignment.subject.name) === normalize(entry.subjectName);
        if (overlap && !same) {
          throw new Error(`La franja ${minuteLabel(entry.startMinute)}–${minuteLabel(entry.endMinute)} del día ${entry.dayOfWeek} se solapa con ${overlap.teachingAssignment.subject.name} · ${overlap.teachingAssignment.classroom.name}.`);
        }
        if (same) continue;

        const classroom = await tx.classroom.upsert({
          where: { name_academicYear: { name: entry.classroomName, academicYear: payload.academicYear } },
          update: { educationalStage: entry.educationalStage },
          create: { name: entry.classroomName, academicYear: payload.academicYear, educationalStage: entry.educationalStage },
        });
        const subjects = await tx.subject.findMany();
        let subject = subjects.find((item) => normalize(item.name) === normalize(entry.subjectName));
        if (!subject) {
          const base = subjectCodeBase(entry.subjectName);
          let code = base;
          let suffix = 2;
          while (subjects.some((item) => item.code === code)) code = `${base.slice(0, 20)}-${suffix++}`;
          subject = await tx.subject.create({ data: { name: entry.subjectName, code } });
        }
        const assignment = await tx.teachingAssignment.upsert({
          where: { subjectId_classroomId_academicYear: { subjectId: subject.id, classroomId: classroom.id, academicYear: payload.academicYear } },
          update: { active: true },
          create: { subjectId: subject.id, classroomId: classroom.id, academicYear: payload.academicYear },
        });
        const slot = await tx.timetableSlot.create({ data: {
          weeklyTimetableId: timetable.id,
          teachingAssignmentId: assignment.id,
          dayOfWeek: entry.dayOfWeek,
          startMinute: entry.startMinute,
          endMinute: entry.endMinute,
          activityType: "class",
          room: entry.room ?? null,
        }});
        occupied.push({ ...slot, teachingAssignment: { ...assignment, classroom, subject } });
        createdSlots += 1;
      }
      await tx.planningChange.create({ data: {
        entityType: "WeeklyTimetable",
        entityId: timetable.id,
        changeType: "schedule_imported",
        afterSnapshot: JSON.stringify({ academicYear: payload.academicYear, entries: payload.entries, createdSlots }),
      }});
      entityId = timetable.id;
    } else if (payload.type === "control_agent") {
      if (!agentDefinitions.some((agent) => agent.id === payload.agentId)) throw new Error("No existe el agente solicitado.");
      const now = new Date();
      const current = await tx.agentRuntime.findUnique({ where: { agentId: payload.agentId } });
      const runtimeData = payload.action === "stop"
        ? { status: "stopped", stoppedAt: now }
        : payload.action === "restart"
          ? { status: "running", startedAt: now, restartedAt: now, stoppedAt: null, restartCount: (current?.restartCount ?? 0) + 1 }
          : { status: "running", startedAt: now, stoppedAt: null };
      await tx.agentRuntime.upsert({
        where: { agentId: payload.agentId },
        update: runtimeData,
        create: { agentId: payload.agentId, ...runtimeData },
      });
      entityId = payload.agentId;
    }

    const executed = await tx.pendingAction.update({ where: { id: action.id }, data: {
      status: "executed", confirmedAt: new Date(), executedAt: new Date(),
    }});
    return { action: executed, entityId, alreadyExecuted: false };
  });
}
