import { database } from "../src/lib/database";
import { addDays, localDateKey, mondayOfWeek } from "../src/domain/planning";
import { generateWeekSessions, replaceLessonActivities } from "../src/services/planning-service";

const students = [
  ["Lucas", "Serrano"], ["Marcos", "Vidal"], ["Elena", "Campos"], ["Pablo", "Molina"],
  ["Alicia", "Ríos"], ["Bruno", "Soler"], ["Carla", "Nieto"], ["Daniel", "Prieto"],
  ["Eva", "Galán"], ["Hugo", "Lozano"], ["Inés", "Rey"], ["Javier", "Cano"],
  ["Leire", "Pardo"], ["Mateo", "Vega"], ["Nora", "Blasco"], ["Óscar", "Ferrer"],
  ["Paula", "Luna"], ["Raúl", "Crespo"], ["Sara", "Méndez"], ["Teo", "Pastor"],
  ["Vera", "Iglesias"], ["Yago", "Fuentes"], ["Ana", "Robles"], ["Diego", "Cabello"],
  ["Marta", "Salas"],
] as const;

async function seed(): Promise<void> {
  const classroom = await database.classroom.upsert({
    where: { name_academicYear: { name: "2.º ESO C", academicYear: "2026-2027" } },
    update: { educationalStage: "Educación Secundaria Obligatoria", isTutorGroup: true },
    create: {
      id: "classroom_demo_2eso_c",
      name: "2.º ESO C",
      academicYear: "2026-2027",
      educationalStage: "Educación Secundaria Obligatoria",
      isTutorGroup: true,
    },
  });

  const startDate = new Date("2026-09-01T00:00:00.000Z");
  for (const [index, [firstName, lastName]] of students.entries()) {
    const studentId = `student_demo_${String(index + 1).padStart(2, "0")}`;
    await database.student.upsert({
      where: { id: studentId },
      update: { firstName, lastName },
      create: { id: studentId, firstName, lastName },
    });
    await database.studentEnrollment.upsert({
      where: {
        studentId_classroomId_startDate: {
          studentId,
          classroomId: classroom.id,
          startDate,
        },
      },
      update: { endDate: null },
      create: { studentId, classroomId: classroom.id, startDate },
    });
  }

  const observedAt = new Date("2026-10-13T09:00:00.000Z");
  const observations = [
    ["observation_demo_lucas", "student_demo_01", "Lucas participa mucho en clase.", "participation"],
    ["observation_demo_marcos", "student_demo_02", "Marcos se distrae cuando está con Lucas.", "classroom_behavior"],
    ["observation_demo_elena", "student_demo_03", "Elena trabaja muy bien con Lucas.", "classroom_dynamics"],
    ["observation_demo_pablo", "student_demo_04", "Pablo necesita sentarse cerca de la pizarra.", "seating_need"],
  ] as const;
  for (const [id, studentId, content, category] of observations) {
    await database.studentObservation.upsert({
      where: { id }, update: { content, category },
      create: { id, studentId, content, category, source: "demo_seed", observedAt, confirmationStatus: "confirmed" },
    });
  }
  await database.studentRelationship.upsert({
    where: { id: "relationship_demo_lucas_marcos" }, update: {},
    create: {
      id: "relationship_demo_lucas_marcos", studentAId: "student_demo_01", studentBId: "student_demo_02",
      relationshipType: "avoid_adjacent", description: "Marcos se distrae cuando está con Lucas.",
      source: "demo_seed", observedAt, active: true,
    },
  });
  await database.studentRelationship.upsert({
    where: { id: "relationship_demo_elena_lucas" }, update: {},
    create: {
      id: "relationship_demo_elena_lucas", studentAId: "student_demo_03", studentBId: "student_demo_01",
      relationshipType: "works_well", description: "Elena trabaja muy bien con Lucas.",
      source: "demo_seed", observedAt, active: true,
    },
  });

  const firstEso = await database.classroom.upsert({
    where: { name_academicYear: { name: "1.º ESO A", academicYear: "2026-2027" } },
    update: { educationalStage: "Educación Secundaria Obligatoria" },
    create: { id: "classroom_demo_1eso_a", name: "1.º ESO A", academicYear: "2026-2027", educationalStage: "Educación Secundaria Obligatoria" },
  });
  const thirdEso = await database.classroom.upsert({
    where: { name_academicYear: { name: "3.º ESO B", academicYear: "2026-2027" } },
    update: { educationalStage: "Educación Secundaria Obligatoria" },
    create: { id: "classroom_demo_3eso_b", name: "3.º ESO B", academicYear: "2026-2027", educationalStage: "Educación Secundaria Obligatoria" },
  });
  const english = await database.subject.upsert({
    where: { code: "EN" }, update: { name: "Inglés", color: "#5576a3" },
    create: { id: "subject_demo_english", code: "EN", name: "Inglés", color: "#5576a3" },
  });
  const german = await database.subject.upsert({
    where: { code: "DE" }, update: { name: "Alemán", color: "#a66d45" },
    create: { id: "subject_demo_german", code: "DE", name: "Alemán", color: "#a66d45" },
  });
  const assignments = [
    ["assignment_demo_2eso_english", english.id, classroom.id],
    ["assignment_demo_1eso_german", german.id, firstEso.id],
    ["assignment_demo_3eso_english", english.id, thirdEso.id],
  ] as const;
  for (const [id, subjectId, classroomId] of assignments) {
    await database.teachingAssignment.upsert({
      where: { subjectId_classroomId_academicYear: { subjectId, classroomId, academicYear: "2026-2027" } },
      update: { active: true }, create: { id, subjectId, classroomId, academicYear: "2026-2027" },
    });
  }
  const subjectRecords = [
    ["subject_record_lucas_english", "assignment_demo_2eso_english", "student_demo_01", "advanced", "high", "up_to_date", "Participa con seguridad en las actividades orales."],
    ["subject_record_marcos_english", "assignment_demo_2eso_english", "student_demo_02", "developing", "variable", "irregular", "Necesita mantener la atención durante el trabajo autónomo."],
    ["subject_record_elena_english", "assignment_demo_2eso_english", "student_demo_03", "on_track", "consistent", "up_to_date", "Evolución constante y buen trabajo cooperativo."],
  ] as const;
  for (const [id, teachingAssignmentId, studentId, progressStatus, participationStatus, homeworkStatus, teacherNotes] of subjectRecords) {
    await database.studentSubjectRecord.upsert({
      where: { teachingAssignmentId_studentId: { teachingAssignmentId, studentId } },
      update: { progressStatus, participationStatus, homeworkStatus, teacherNotes },
      create: { id, teachingAssignmentId, studentId, progressStatus, participationStatus, homeworkStatus, teacherNotes },
    });
  }
  const demoGrades = [
    ["grade_demo_lucas_1", "subject_record_lucas_english", "Comprensión oral", 8.7],
    ["grade_demo_lucas_2", "subject_record_lucas_english", "Present Perfect", 9.2],
    ["grade_demo_marcos_1", "subject_record_marcos_english", "Comprensión oral", 6.1],
    ["grade_demo_elena_1", "subject_record_elena_english", "Comprensión oral", 7.8],
  ] as const;
  for (const [id, studentRecordId, title, score] of demoGrades) {
    await database.assessmentGrade.upsert({
      where: { id },
      update: { title, score },
      create: { id, studentRecordId, title, assessmentPeriod: "1.ª evaluación", score, maxScore: 10, weight: 1, assessedAt: new Date("2026-10-14T00:00:00.000Z") },
    });
  }
  const timetable = await database.weeklyTimetable.upsert({
    where: { name_academicYear: { name: "Horario docente", academicYear: "2026-2027" } },
    update: { active: true },
    create: { id: "timetable_demo_2026", name: "Horario docente", academicYear: "2026-2027", timezone: "Europe/Madrid", validFrom: new Date("2026-09-01T00:00:00.000Z") },
  });
  const slots = [
    ["slot_demo_mon_0900", "assignment_demo_2eso_english", 1, 540, 595, "Aula 12"],
    ["slot_demo_mon_1000", "assignment_demo_1eso_german", 1, 600, 655, "Aula 8"],
    ["slot_demo_tue_0900", "assignment_demo_3eso_english", 2, 540, 595, "Aula 14"],
    ["slot_demo_tue_1100", "assignment_demo_2eso_english", 2, 660, 715, "Aula 12"],
    ["slot_demo_wed_1000", "assignment_demo_1eso_german", 3, 600, 655, "Aula 8"],
    ["slot_demo_wed_1200", "assignment_demo_2eso_english", 3, 720, 775, "Aula 12"],
    ["slot_demo_thu_0900", "assignment_demo_2eso_english", 4, 540, 595, "Aula 12"],
    ["slot_demo_thu_1000", "assignment_demo_3eso_english", 4, 600, 655, "Aula 14"],
    ["slot_demo_fri_1000", "assignment_demo_1eso_german", 5, 600, 655, "Aula 8"],
  ] as const;
  for (const [id, teachingAssignmentId, dayOfWeek, startMinute, endMinute, room] of slots) {
    await database.timetableSlot.upsert({
      where: { id }, update: { active: true, teachingAssignmentId, dayOfWeek, startMinute, endMinute, room },
      create: { id, weeklyTimetableId: timetable.id, teachingAssignmentId, dayOfWeek, startMinute, endMinute, room, activityType: "class" },
    });
  }

  const presentPerfect = await database.teachingUnit.upsert({
    where: { teachingAssignmentId_sequenceOrder: { teachingAssignmentId: "assignment_demo_2eso_english", sequenceOrder: 1 } },
    update: { title: "Present Perfect", status: "in_progress" },
    create: { id: "unit_demo_present_perfect", teachingAssignmentId: "assignment_demo_2eso_english", title: "Present Perfect", description: "Experiencias y acciones conectadas con el presente.", objectives: JSON.stringify(["Hablar de experiencias", "Usar ever, never, already y yet"]), sequenceOrder: 1, estimatedSessions: 6, status: "in_progress" },
  });
  const dasHaus = await database.teachingUnit.upsert({
    where: { teachingAssignmentId_sequenceOrder: { teachingAssignmentId: "assignment_demo_1eso_german", sequenceOrder: 1 } },
    update: { title: "Das Haus", status: "in_progress" },
    create: { id: "unit_demo_das_haus", teachingAssignmentId: "assignment_demo_1eso_german", title: "Das Haus", description: "Vocabulario y descripción de la casa.", objectives: JSON.stringify(["Nombrar habitaciones y muebles", "Describir una habitación"]), sequenceOrder: 1, estimatedSessions: 5, status: "in_progress" },
  });
  await database.teachingUnit.upsert({
    where: { teachingAssignmentId_sequenceOrder: { teachingAssignmentId: "assignment_demo_3eso_english", sequenceOrder: 1 } },
    update: { title: "Travel stories", status: "in_progress" },
    create: { id: "unit_demo_travel_stories", teachingAssignmentId: "assignment_demo_3eso_english", title: "Travel stories", objectives: JSON.stringify(["Narrar experiencias pasadas"]), sequenceOrder: 1, estimatedSessions: 4, status: "in_progress" },
  });
  const contents = [
    ["content_demo_pp_1", presentPerfect.id, "Forma y uso del present perfect", 1, 15],
    ["content_demo_pp_2", presentPerfect.id, "Experiencias con ever y never", 2, 20],
    ["content_demo_pp_3", presentPerfect.id, "Already, yet y just", 3, 20],
    ["content_demo_house_1", dasHaus.id, "Habitaciones de la casa", 1, 15],
    ["content_demo_house_2", dasHaus.id, "Muebles", 2, 15],
    ["content_demo_house_3", dasHaus.id, "Preposiciones de lugar", 3, 20],
    ["content_demo_house_4", dasHaus.id, "Descripción de habitaciones", 4, 25],
  ] as const;
  for (const [id, teachingUnitId, title, sequenceOrder, estimatedMinutes] of contents) {
    await database.learningContent.upsert({
      where: { id }, update: { title, sequenceOrder, estimatedMinutes },
      create: { id, teachingUnitId, title, sequenceOrder, estimatedMinutes },
    });
  }

  const currentWeek = mondayOfWeek(localDateKey());
  await generateWeekSessions(currentWeek);
  await generateWeekSessions(addDays(currentWeek, 7));
  const demoLesson = await database.lessonPlan.findFirst({
    where: { teachingAssignmentId: "assignment_demo_2eso_english", date: { gte: new Date(`${addDays(currentWeek, 7)}T00:00:00.000Z`) } },
    include: { activities: true }, orderBy: [{ date: "asc" }, { startMinute: "asc" }],
  });
  if (demoLesson && demoLesson.activities.length === 0) {
    await replaceLessonActivities(demoLesson.id, [
      { name: "Repaso inicial", durationMinutes: 5, activityType: "review" },
      { name: "Explicación y ejemplos", durationMinutes: 10, activityType: "explanation", learningContentId: "content_demo_pp_1" },
      { name: "Ejercicios guiados", durationMinutes: 15, activityType: "exercises", learningContentId: "content_demo_pp_1" },
      { name: "Actividad por parejas", durationMinutes: 15, activityType: "cooperative", learningContentId: "content_demo_pp_2" },
      { name: "Corrección y cierre", durationMinutes: 10, activityType: "review" },
    ]);
  }

  console.info(`Datos de demostración listos: 3 grupos, 2 asignaturas, horario semanal, unidades y ${students.length} alumnos ficticios.`);
}

seed()
  .catch((error) => {
    console.error("No se pudieron crear los datos de demostración.", error);
    process.exitCode = 1;
  })
  .finally(async () => database.$disconnect());
