import "dotenv/config";
import { database } from "../src/lib/database";
import { calculateClassroomLayout } from "../src/services/classroom-service";
import { confirmAction, proposeAction } from "../src/services/action-service";

const classroom = await database.classroom.findUnique({
  where: { name_academicYear: { name: "2.º ESO C", academicYear: "2026-2027" } },
});
if (!classroom) throw new Error("Ejecuta primero npm run db:seed.");

const existing = await database.seatingLayout.findUnique({
  where: { classroomId_name: { classroomId: classroom.id, name: "Plano de demostración" } },
});
if (!existing) {
  const calculated = await calculateClassroomLayout(classroom.id, 5, 5);
  if (!calculated.result.ok) throw new Error(calculated.result.explanation);
  const action = await proposeAction({
    type: "save_layout", classroomId: classroom.id, name: "Plano de demostración", rows: 5, columns: 5,
    configuration: JSON.stringify({ constraints: calculated.constraints, score: calculated.result.score, explanation: calculated.result.explanation }),
    assignments: calculated.result.assignments,
  });
  await confirmAction(action.id);
}
console.info("Demostración preparada: datos ficticios y plano 5×5 disponibles.");
await database.$disconnect();
