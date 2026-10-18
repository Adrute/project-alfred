import { database } from "@/lib/database";
import { listClassrooms, getLatestLayout } from "./classroom-service";
import { listStudents } from "./student-service";
import { getDailyDashboard } from "./dashboard-service";

export async function getBootstrapData() {
  const [classrooms, students, tutorings, layout, recentExecutions, today] = await Promise.all([
    listClassrooms(),
    listStudents(),
    database.tutoringSession.findMany({ include: { student: true, agreements: true }, orderBy: { createdAt: "desc" } }),
    getLatestLayout(),
    database.agentExecution.findMany({ orderBy: { startedAt: "desc" }, take: 8 }),
    getDailyDashboard(),
  ]);
  return { classrooms, students, tutorings, layout, recentExecutions, today };
}
