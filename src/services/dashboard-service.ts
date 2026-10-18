import { addDays, dateFromKey, localDateKey, mondayOfWeek } from "@/domain/planning";
import { database } from "@/lib/database";
import { generateWeekSessions } from "@/services/planning-service";

const lessonInclude = {
  teachingAssignment: { include: { classroom: true, subject: true } },
  activities: { orderBy: { sequenceOrder: "asc" as const } },
  timetableSlot: true,
} as const;

export async function getDailyDashboard(inputDate = localDateKey()) {
  const date = inputDate;
  const tomorrow = addDays(date, 1);

  // Timetable slots are the durable source of truth. Materialising the current
  // week here is idempotent and keeps Inicio useful even before Planning opens.
  const currentWeek = mondayOfWeek(date);
  const followingWeek = mondayOfWeek(tomorrow);
  await generateWeekSessions(currentWeek);
  if (followingWeek !== currentWeek) await generateWeekSessions(followingWeek);

  const dayStart = dateFromKey(date);
  const dayEnd = dateFromKey(tomorrow);
  const [lessons, nextLesson, tutorings, observations, pendingActions, dueAgreements] = await Promise.all([
    database.lessonPlan.findMany({
      where: { date: { gte: dayStart, lt: dayEnd } },
      include: lessonInclude,
      orderBy: [{ startMinute: "asc" }, { title: "asc" }],
    }),
    database.lessonPlan.findFirst({
      where: { date: { gte: dayEnd }, status: { not: "cancelled" } },
      include: lessonInclude,
      orderBy: [{ date: "asc" }, { startMinute: "asc" }],
    }),
    database.tutoringSession.findMany({
      where: { scheduledAt: { gte: dayStart, lt: dayEnd } },
      include: { student: true, agreements: true },
      orderBy: { scheduledAt: "asc" },
    }),
    database.studentObservation.findMany({
      where: { observedAt: { gte: dayStart, lt: dayEnd }, confirmationStatus: "confirmed" },
      include: { student: true },
      orderBy: { observedAt: "desc" },
      take: 5,
    }),
    database.pendingAction.findMany({
      where: { status: "pending" },
      select: { id: true, operation: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    database.tutoringAgreement.findMany({
      where: { status: "pending", dueDate: { lte: dayEnd } },
      include: { tutoringSession: { include: { student: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
  ]);

  return {
    date,
    timezone: "Europe/Madrid" as const,
    lessons,
    nextLesson,
    tutorings,
    observations,
    pendingActions,
    dueAgreements,
  };
}
