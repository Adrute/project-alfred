import { database } from "@/lib/database";
import {
  addDays,
  dateFromKey,
  dateKey,
  hasTimeOverlap,
  lessonPlanUpdateSchema,
  minuteLabel,
  mondayOfWeek,
  timetableSlotInputSchema,
  teachingScheduleSchema,
  validateActivityDuration,
  weekDateKeys,
  type LessonPlanUpdate,
  type TimetableSlotInput,
  type TeachingSchedule,
} from "@/domain/planning";

const lessonInclude = {
  teachingAssignment: { include: { classroom: true, subject: true } },
  teachingUnit: { include: { contents: { orderBy: { sequenceOrder: "asc" as const } } } },
  activities: { include: { learningContent: true }, orderBy: { sequenceOrder: "asc" as const } },
  timetableSlot: true,
} as const;

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();

export async function validateTeachingSchedule(input: TeachingSchedule) {
  const schedule = teachingScheduleSchema.parse(input);
  const exactEntries = new Set<string>();
  for (const [index, entry] of schedule.entries.entries()) {
    const key = [entry.dayOfWeek, entry.startMinute, entry.endMinute, normalize(entry.classroomName), normalize(entry.subjectName)].join(":");
    if (exactEntries.has(key)) {
      throw new Error(`La clase ${entry.subjectName} · ${entry.classroomName} aparece repetida el día ${entry.dayOfWeek} a las ${minuteLabel(entry.startMinute)}.`);
    }
    exactEntries.add(key);
    const conflict = schedule.entries.find((candidate, candidateIndex) =>
      candidateIndex !== index
      && candidate.dayOfWeek === entry.dayOfWeek
      && hasTimeOverlap(candidate, entry)
      && !(
        candidate.startMinute === entry.startMinute
        && candidate.endMinute === entry.endMinute
        && normalize(candidate.classroomName) === normalize(entry.classroomName)
        && normalize(candidate.subjectName) === normalize(entry.subjectName)
      ),
    );
    if (conflict) {
      throw new Error(`El horario propuesto se solapa el día ${entry.dayOfWeek}: ${minuteLabel(entry.startMinute)}–${minuteLabel(entry.endMinute)} y ${minuteLabel(conflict.startMinute)}–${minuteLabel(conflict.endMinute)}.`);
    }
  }

  const existing = await database.timetableSlot.findMany({
    where: { active: true, weeklyTimetable: { active: true, academicYear: schedule.academicYear } },
    include: { teachingAssignment: { include: { classroom: true, subject: true } } },
  });
  for (const entry of schedule.entries) {
    const conflict = existing.find((slot) => slot.dayOfWeek === entry.dayOfWeek && hasTimeOverlap(slot, entry));
    if (!conflict) continue;
    const same = conflict.startMinute === entry.startMinute
      && conflict.endMinute === entry.endMinute
      && normalize(conflict.teachingAssignment.classroom.name) === normalize(entry.classroomName)
      && normalize(conflict.teachingAssignment.subject.name) === normalize(entry.subjectName);
    if (!same) {
      throw new Error(`La franja ${minuteLabel(entry.startMinute)}–${minuteLabel(entry.endMinute)} del día ${entry.dayOfWeek} se solapa con ${conflict.teachingAssignment.subject.name} · ${conflict.teachingAssignment.classroom.name}.`);
    }
  }
  return schedule;
}

export async function createTimetableSlot(input: TimetableSlotInput) {
  const value = timetableSlotInputSchema.parse(input);
  const timetable = await database.weeklyTimetable.findUnique({ where: { id: value.weeklyTimetableId } });
  const assignment = await database.teachingAssignment.findUnique({ where: { id: value.teachingAssignmentId } });
  if (!timetable || !assignment) throw new Error("No existe el horario o la asignación docente.");
  const sameDay = await database.timetableSlot.findMany({
    where: { weeklyTimetableId: value.weeklyTimetableId, dayOfWeek: value.dayOfWeek, active: true },
  });
  if (sameDay.some((slot) => hasTimeOverlap(slot, value))) {
    throw new Error("La franja se solapa con otra actividad del horario.");
  }
  const slot = await database.timetableSlot.create({ data: value });
  await database.planningChange.create({ data: {
    entityType: "TimetableSlot", entityId: slot.id, changeType: "created", afterSnapshot: JSON.stringify(slot),
  }});
  return slot;
}

export async function deleteTimetableSlot(id: string) {
  const slot = await database.timetableSlot.findUnique({ where: { id } });
  if (!slot) throw new Error("No existe la franja solicitada.");
  const updated = await database.timetableSlot.update({ where: { id }, data: { active: false } });
  await database.planningChange.create({ data: {
    entityType: "TimetableSlot", entityId: id, changeType: "deactivated",
    beforeSnapshot: JSON.stringify(slot), afterSnapshot: JSON.stringify(updated),
  }});
  return updated;
}

export async function listTimetable() {
  const [timetables, assignments] = await Promise.all([
    database.weeklyTimetable.findMany({
      where: { active: true },
      include: { slots: { where: { active: true }, include: { teachingAssignment: { include: { subject: true, classroom: true } } }, orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] } },
      orderBy: { validFrom: "desc" },
    }),
    database.teachingAssignment.findMany({
      where: { active: true }, include: { subject: true, classroom: true }, orderBy: [{ classroom: { name: "asc" } }, { subject: { name: "asc" } }],
    }),
  ]);
  return { timetables, assignments };
}

export async function generateWeekSessions(inputWeekStart: string) {
  const weekStart = mondayOfWeek(inputWeekStart);
  const dates = weekDateKeys(weekStart);
  const dateObjects = dates.map(dateFromKey);
  const slots = await database.timetableSlot.findMany({
    where: {
      active: true,
      weeklyTimetable: {
        active: true,
        validFrom: { lte: dateObjects[6] },
        OR: [{ validUntil: null }, { validUntil: { gte: dateObjects[0] } }],
      },
    },
    include: {
      teachingAssignment: { include: { subject: true, classroom: true, teachingUnits: { where: { status: "in_progress" }, take: 1, orderBy: { sequenceOrder: "asc" } } } },
      exceptions: { where: { date: { gte: dateObjects[0], lte: dateObjects[6] } } },
    },
  });

  let created = 0;
  for (const slot of slots) {
    const targetDate = dateObjects[slot.dayOfWeek - 1];
    const exception = slot.exceptions.find((item) => dateKey(item.date) === dateKey(targetDate));
    if (exception?.kind === "cancelled") continue;
    const existing = await database.lessonPlan.findUnique({
      where: { timetableSlotId_date: { timetableSlotId: slot.id, date: targetDate } },
    });
    if (existing) continue;
    const unit = slot.teachingAssignment.teachingUnits[0];
    await database.lessonPlan.create({ data: {
      teachingAssignmentId: slot.teachingAssignmentId,
      timetableSlotId: slot.id,
      teachingUnitId: unit?.id,
      date: targetDate,
      startMinute: exception?.overrideStartMinute ?? slot.startMinute,
      endMinute: exception?.overrideEndMinute ?? slot.endMinute,
      title: unit?.title ?? `${slot.teachingAssignment.subject.name} · ${slot.teachingAssignment.classroom.name}`,
      status: "unplanned",
    }});
    created += 1;
  }
  return { weekStart, created };
}

export async function getWeekPlan(inputWeekStart: string) {
  const weekStart = mondayOfWeek(inputWeekStart);
  const weekEnd = addDays(weekStart, 6);
  const [lessons, tutorings] = await Promise.all([
    database.lessonPlan.findMany({
      where: { date: { gte: dateFromKey(weekStart), lte: dateFromKey(weekEnd) } },
      include: lessonInclude,
      orderBy: [{ date: "asc" }, { startMinute: "asc" }],
    }),
    database.tutoringSession.findMany({
      where: { scheduledAt: { gte: dateFromKey(weekStart), lt: dateFromKey(addDays(weekEnd, 1)) } },
      include: { student: true }, orderBy: { scheduledAt: "asc" },
    }),
  ]);
  return { weekStart, weekEnd, days: weekDateKeys(weekStart).slice(0, 5), lessons, tutorings };
}

export async function getLessonPlan(id: string) {
  return database.lessonPlan.findUnique({ where: { id }, include: lessonInclude });
}

export async function updateLessonPlan(id: string, input: LessonPlanUpdate) {
  const value = lessonPlanUpdateSchema.parse(input);
  const before = await database.lessonPlan.findUnique({ where: { id }, include: { activities: true } });
  if (!before) throw new Error("No existe la sesión solicitada.");
  const updated = await database.lessonPlan.update({ where: { id }, data: {
    ...value,
    objectives: value.objectives ? JSON.stringify(value.objectives) : undefined,
    materials: value.materials ? JSON.stringify(value.materials) : undefined,
  }, include: lessonInclude });
  await database.planningChange.create({ data: {
    entityType: "LessonPlan", entityId: id, changeType: "updated",
    beforeSnapshot: JSON.stringify(before), afterSnapshot: JSON.stringify(updated),
  }});
  return updated;
}

export async function replaceLessonActivities(
  lessonPlanId: string,
  activities: Array<{ name: string; description?: string | null; durationMinutes: number; activityType: string; learningContentId?: string | null }>,
) {
  const lesson = await database.lessonPlan.findUnique({ where: { id: lessonPlanId }, include: { activities: true } });
  if (!lesson) throw new Error("No existe la sesión solicitada.");
  const duration = validateActivityDuration(lesson.startMinute, lesson.endMinute, activities);
  if (!duration.valid) throw new Error(`Las actividades suman ${duration.plannedMinutes} minutos y la sesión solo dispone de ${duration.availableMinutes}.`);
  return database.$transaction(async (tx) => {
    await tx.lessonActivity.deleteMany({ where: { lessonPlanId } });
    for (const [index, activity] of activities.entries()) {
      await tx.lessonActivity.create({ data: { ...activity, lessonPlanId, sequenceOrder: index + 1 } });
    }
    const updated = await tx.lessonPlan.update({ where: { id: lessonPlanId }, data: { status: "planned" }, include: lessonInclude });
    await tx.planningChange.create({ data: {
      entityType: "LessonPlan", entityId: lessonPlanId, changeType: "activities_replaced",
      beforeSnapshot: JSON.stringify(lesson), afterSnapshot: JSON.stringify(updated),
    }});
    return updated;
  });
}

export async function getCurriculumOverview() {
  return database.teachingAssignment.findMany({
    where: { active: true },
    include: {
      subject: true,
      classroom: true,
      teachingUnits: { include: { contents: { orderBy: { sequenceOrder: "asc" } } }, orderBy: { sequenceOrder: "asc" } },
    },
    orderBy: [{ classroom: { name: "asc" } }, { subject: { name: "asc" } }],
  });
}
