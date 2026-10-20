import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const dbPath = path.join(os.tmpdir(), `alfred-integration-${process.pid}.db`);
let databaseModule: typeof import("@/lib/database");
let chatModule: typeof import("@/services/chat-service");
let actionModule: typeof import("@/services/action-service");
let classroomModule: typeof import("@/services/classroom-service");
let planningModule: typeof import("@/services/planning-service");
let dashboardModule: typeof import("@/services/dashboard-service");
let teachingModule: typeof import("@/services/teaching-service");
let tutorGroupModule: typeof import("@/services/tutor-group-service");
let agentAdminModule: typeof import("@/services/agent-admin-service");
let databaseAdminModule: typeof import("@/services/database-admin-service");
let alfredToolsModule: typeof import("@/agents/alfred-tools");
let internalA2AModule: typeof import("@/services/internal-a2a-service");
let alfredAgentModule: typeof import("@/services/alfred-agent-service");
let conversationContextModule: typeof import("@/services/conversation-context-service");
let cloudAiLogModule: typeof import("@/services/cloud-ai-log-service");
let agentAiSettingsModule: typeof import("@/services/agent-ai-settings-service");
let dataExportModule: typeof import("@/services/data-export-service");
let teacherFeedbackModule: typeof import("@/services/teacher-feedback-service");
let classroomId = "";

describe("observation confirmation flow", () => {
  beforeAll(async () => {
    const sqlite = new Database(dbPath);
    sqlite.exec(readFileSync(path.resolve("prisma/migrations/20261016200000_init/migration.sql"), "utf8"));
    sqlite.exec(readFileSync(path.resolve("prisma/migrations/20261016205957_intelligent_planner/migration.sql"), "utf8"));
    sqlite.exec(readFileSync(path.resolve("prisma/migrations/20261016230000_conversation_context_agent_admin/migration.sql"), "utf8"));
    sqlite.exec(readFileSync(path.resolve("prisma/migrations/20261017090000_conversation_focus_context/migration.sql"), "utf8"));
    sqlite.exec(readFileSync(path.resolve("prisma/migrations/20261018010000_internal_a2a_audit/migration.sql"), "utf8"));
    sqlite.exec(readFileSync(path.resolve("prisma/migrations/20261018152339_teacher_subject_and_tutor_workspace/migration.sql"), "utf8"));
    sqlite.exec(readFileSync(path.resolve("prisma/migrations/20261019120000_cloud_ai_request_logs/migration.sql"), "utf8"));
    sqlite.exec(readFileSync(path.resolve("prisma/migrations/20261020090000_agent_ai_model_preferences/migration.sql"), "utf8"));
    sqlite.exec(readFileSync(path.resolve("prisma/migrations/20261020140915_teacher_feedback_tutoring/migration.sql"), "utf8"));
    sqlite.close();
    process.env.DATABASE_URL = `file:${dbPath}`;
    databaseModule = await import("@/lib/database");
    chatModule = await import("@/services/chat-service");
    actionModule = await import("@/services/action-service");
    classroomModule = await import("@/services/classroom-service");
    planningModule = await import("@/services/planning-service");
    dashboardModule = await import("@/services/dashboard-service");
    teachingModule = await import("@/services/teaching-service");
    tutorGroupModule = await import("@/services/tutor-group-service");
    agentAdminModule = await import("@/services/agent-admin-service");
    databaseAdminModule = await import("@/services/database-admin-service");
    alfredToolsModule = await import("@/agents/alfred-tools");
    internalA2AModule = await import("@/services/internal-a2a-service");
    alfredAgentModule = await import("@/services/alfred-agent-service");
    conversationContextModule = await import("@/services/conversation-context-service");
    cloudAiLogModule = await import("@/services/cloud-ai-log-service");
    agentAiSettingsModule = await import("@/services/agent-ai-settings-service");
    dataExportModule = await import("@/services/data-export-service");
    teacherFeedbackModule = await import("@/services/teacher-feedback-service");
    const classroom = await databaseModule.database.classroom.create({ data: { name: "Prueba", academicYear: "2026-2027", educationalStage: "ESO" } });
    classroomId = classroom.id;
    for (const firstName of ["Lucas", "Marcos", "Elena", "Pablo"]) {
      await databaseModule.database.student.create({ data: { firstName, lastName: "Prueba", enrollments: { create: { classroomId: classroom.id, startDate: new Date() } } } });
    }
  });

  afterAll(async () => {
    await databaseModule.database.$disconnect();
    unlinkSync(dbPath);
  });

  it("persists nothing before confirmation and executes once", async () => {
    const response = await chatModule.handleChat({ message: "Lucas participa mucho en clase" });
    expect(response.pendingAction?.operation).toBe("record_observation");
    expect(await databaseModule.database.studentObservation.count()).toBe(0);
    const first = await actionModule.confirmAction(response.pendingAction!.id);
    const second = await actionModule.confirmAction(response.pendingAction!.id);
    expect(first.alreadyExecuted).toBe(false);
    expect(second.alreadyExecuted).toBe(true);
    expect(await databaseModule.database.studentObservation.count()).toBe(1);
  });

  it("keeps relationship history and feeds confirmed constraints to seating", async () => {
    for (const message of [
      "Marcos se distrae cuando está con Lucas",
      "Elena trabaja muy bien con Lucas",
      "Pablo necesita sentarse cerca de la pizarra",
    ]) {
      const response = await chatModule.handleChat({ message });
      await actionModule.confirmAction(response.pendingAction!.id);
    }
    const calculated = await classroomModule.calculateClassroomLayout(classroomId, 3, 2);
    expect(calculated.result.ok).toBe(true);
    expect(calculated.constraints.frontStudentIds).toHaveLength(1);
    expect(calculated.constraints.separatePairs).toHaveLength(1);
    expect(calculated.constraints.togetherPairs).toHaveLength(1);

    const relationshipAnswer = await chatModule.handleChat({
      message: "¿Hay algún alumno que se lleve mal con otro?",
    });
    expect(relationshipAnswer.message.agentId).toBe("memory-agent");
    expect(relationshipAnswer.message.content).toMatch(/Lucas.*Marcos|Marcos.*Lucas/);
    expect(relationshipAnswer.message.content).not.toMatch(/Okay|First|Wait|I should/);

    const update = await chatModule.handleChat({ message: "Lucas y Marcos están trabajando mejor juntos últimamente" });
    await actionModule.confirmAction(update.pendingAction!.id);
    const active = await databaseModule.database.studentRelationship.findMany({ where: { active: true } });
    expect(active.some((item) => item.relationshipType === "avoid_adjacent")).toBe(false);
    expect(active.filter((item) => item.relationshipType === "works_well")).toHaveLength(2);
    expect(await databaseModule.database.studentObservation.count()).toBeGreaterThan(4);
  });

  it("answers food-allergy questions from confirmed memory without reorganizing seats", async () => {
    const elena = await databaseModule.database.student.findFirstOrThrow({ where: { firstName: "Elena" } });
    await databaseModule.database.studentObservation.create({ data: {
      studentId: elena.id,
      content: "Tiene alergia confirmada a los frutos secos.",
      category: "health_accommodation",
      source: "teacher_statement",
      observedAt: new Date(),
      confirmationStatus: "confirmed",
    }});
    const layoutsBefore = await databaseModule.database.seatingLayout.count();
    const response = await chatModule.handleChat({
      message: "Vamos a organizar una excursión y estoy preparando los menús de la comida, ¿tengo que tener algo en cuenta sobre algún alumno?",
    });
    expect(response.message.agentId).toBe("memory-agent");
    expect(response.message.content).toContain("Elena Prueba");
    expect(response.message.content).toContain("frutos secos");
    expect(response.message.content).not.toContain("distribución 5×5");
    expect(response.pendingAction).toBeNull();
    expect(await databaseModule.database.seatingLayout.count()).toBe(layoutsBefore);

    const followUp = await chatModule.handleChat({
      conversationId: response.conversationId,
      message: "¿Y alguno más?",
    });
    expect(followUp.message.agentId).toBe("memory-agent");
    expect(followUp.message.content).toContain("Elena Prueba");
    expect(followUp.message.content).toContain("frutos secos");

    const separateConversation = await chatModule.handleChat({
      message: "¿Hay algún alumno que se lleve mal con otro?",
    });
    expect(separateConversation.conversationId).not.toBe(response.conversationId);
    const firstChat = await chatModule.getConversation(response.conversationId);
    const secondChat = await chatModule.getConversation(separateConversation.conversationId);
    expect(firstChat.conversation?.messages.some((message) => message.content === "¿Y alguno más?")).toBe(true);
    expect(secondChat.conversation?.messages.some((message) => message.content === "¿Y alguno más?")).toBe(false);
  });

  it("resolves references against the student visible on the current page", async () => {
    const elena = await databaseModule.database.student.findFirstOrThrow({ where: { firstName: "Elena" } });
    const response = await chatModule.handleChat({
      message: "¿Qué sabes de ella?",
      pageContext: {
        view: "students",
        label: "Alumnos",
        summary: "Ficha visible de Elena Prueba, del grupo Prueba.",
        studentIds: [elena.id],
        studentNames: ["Elena Prueba"],
      },
    });

    expect(response.message.agentId).toBe("memory-agent");
    expect(response.message.content).toContain("Elena Prueba");
    expect(response.message.content).not.toContain("indicarme su nombre");
  });

  it("never turns an application command into an observation for the visible student", async () => {
    const elena = await databaseModule.database.student.findFirstOrThrow({ where: { firstName: "Elena" } });
    const observationsBefore = await databaseModule.database.studentObservation.count({ where: { studentId: elena.id } });
    const request = await chatModule.handleChat({
      message: "Quiero añadir una clase nueva",
      pageContext: {
        view: "students",
        label: "Alumnos",
        summary: "Ficha visible de Elena Prueba.",
        studentIds: [elena.id],
        studentNames: ["Elena Prueba"],
      },
    });

    expect(request.message.content).toContain("Para crear la clase necesito");
    expect(request.pendingAction).toBeNull();
    expect(await databaseModule.database.studentObservation.count({ where: { studentId: elena.id } })).toBe(observationsBefore);

    const completed = await chatModule.handleChat({
      conversationId: request.conversationId,
      message: "3º ESO Z, curso 2026-2027, ESO",
      pageContext: {
        view: "students",
        label: "Alumnos",
        summary: "Ficha visible de Elena Prueba.",
        studentIds: [elena.id],
        studentNames: ["Elena Prueba"],
      },
    });
    expect(completed.pendingAction?.operation).toBe("create_classroom");
    expect(completed.message.content).toContain("3º ESO Z");
    await actionModule.confirmAction(completed.pendingAction!.id);
    expect(await databaseModule.database.classroom.findFirst({ where: { name: "3º ESO Z", academicYear: "2026-2027" } })).not.toBeNull();
  });

  it("treats a general message for families as conversation, not as a tutoring request", async () => {
    const response = await chatModule.handleChat({
      message: "Ayúdame a redactar un mensaje amable para las familias",
    });
    expect(response.message.agentId).toBe("alfred-orchestrator");
    expect(response.message.content).toContain("modo manual");
    expect(response.pendingAction).toBeNull();
  });

  it("does not invoke a cloud model without an explicit ChatGPT connection", async () => {
    const result = await alfredAgentModule.runAlfredAgent({
      message: "Lucas participa mucho en clase",
      history: [],
      state: conversationContextModule.conversationContextStateSchema.parse({}),
    });
    expect(result).toBeNull();
  });

  it("inherits student filters when the teacher asks who the counted students are", async () => {
    const count = await chatModule.handleChat({
      message: "Necesito que me digas cuántos alumnos tengo con nombres que empiecen por E",
    });
    expect(count.message.content).toContain("Hay 1 alumno que cumple los filtros");

    const names = await chatModule.handleChat({
      conversationId: count.conversationId,
      message: "Dime quiénes son",
    });
    expect(names.message.content).toContain("Elena Prueba");
    expect(names.message.content).not.toContain("Lucas Prueba");
    expect(names.message.content).not.toContain("Pablo Prueba");
  });

  it("uses the nearest single-student result for a natural follow-up", async () => {
    const conversation = await databaseModule.database.conversation.create({ data: { title: "Filtro de alumnos" } });
    await databaseModule.database.message.createMany({ data: [
      { conversationId: conversation.id, role: "user", content: "Dime los alumnos cuyo nombre empieza por E" },
      { conversationId: conversation.id, role: "assistant", content: "He encontrado 1 alumno: Elena Prueba." },
    ] });

    const response = await chatModule.handleChat({ conversationId: conversation.id, message: "¿Qué sabes de ella?" });
    expect(response.message.content).toContain("Elena Prueba");
    expect(response.message.content).not.toContain("indicarme su nombre");
  });

  it("shows agent statistics and enforces start, stop and restart controls", async () => {
    const dashboard = await agentAdminModule.getAgentDashboard();
    expect(dashboard).toHaveLength(7);
    expect(dashboard.find((agent) => agent.id === "alfred-orchestrator")?.ai.usesAi).toBe(true);
    expect(dashboard.find((agent) => agent.id === "classroom-agent")?.ai.usesAi).toBe(false);
    expect(dashboard.find((agent) => agent.id === "memory-agent")?.statistics.totalExecutions).toBeGreaterThan(0);

    await agentAdminModule.controlAgent("curriculum-agent", "stop");
    await expect(agentAdminModule.requireAgentRunning("curriculum-agent")).rejects.toThrow(/detenido/);
    await agentAdminModule.controlAgent("curriculum-agent", "start");
    await expect(agentAdminModule.requireAgentRunning("curriculum-agent")).resolves.toBeUndefined();
    const restarted = await agentAdminModule.controlAgent("curriculum-agent", "restart");
    expect(restarted.status).toBe("running");
    expect(restarted.restartCount).toBe(1);

    await expect(agentAiSettingsModule.setAgentAiModel("alfred-orchestrator", null)).resolves.toMatchObject({ aiModel: null });
    await databaseModule.database.agentRuntime.update({
      where: { agentId: "alfred-orchestrator" },
      data: { aiModel: "gpt-test-agent-model" },
    });
    await expect(agentAiSettingsModule.resolveAgentAiModel("alfred-orchestrator", "gpt-default"))
      .resolves.toBe("gpt-test-agent-model");
    await expect(agentAiSettingsModule.resolveAgentAiModel("classroom-agent", "gpt-default"))
      .resolves.toBe("gpt-default");
    await expect(agentAiSettingsModule.setAgentAiModel("classroom-agent", null)).rejects.toThrow(/no utiliza un modelo generativo/);
  });

  it("uses the AI orchestrator to choose structured student queries", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const request = JSON.parse(String(init?.body)) as { messages: Array<{ content: string }> };
      const prompt = request.messages.map((message) => message.content).join("\n");
      if (prompt.includes("Determina si el mensaje depende del historial")) {
        const currentMessage = prompt.split("Mensaje actual:")[1] ?? "";
        const topic = /familia|tutoría/i.test(currentMessage) ? "tutoring"
          : /observaciones|necesita/i.test(currentMessage) ? "observations"
            : "students";
        const resolution = {
          dependsOnHistory: topic !== "tutoring",
          referencedStudentNames: ["Elena Prueba"],
          topic,
          confidence: topic === "tutoring" ? "low" : "high",
        };
        return new Response(JSON.stringify({ model: "qwen3.5:9b", message: { role: "assistant", content: JSON.stringify(resolution) }, done: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (prompt.includes("Prepara una tutoría familiar")) {
        const draft = {
          strengths: [],
          followUp: [],
          questions: ["¿Cómo está?", "¿Qué apoyo funciona?"],
          possibleAgreements: ["Revisar apoyos."],
          nextSteps: ["Hacer seguimiento."],
        };
        return new Response(JSON.stringify({ model: "qwen3.5:9b", message: { role: "assistant", content: JSON.stringify(draft) }, done: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      const decision = prompt.includes("Dime los nombres") || prompt.includes("empiecen por la letra E")
        ? { tool: "list_students", studentQuery: "", responseStyle: "detailed" }
        : prompt.includes("Tengo alumnos")
          ? { tool: "count_students", studentQuery: "", responseStyle: "brief" }
          : prompt.includes("qué observaciones tiene")
            ? { tool: "student_observations", studentQuery: "Elena Prueba", responseStyle: "detailed" }
            : { tool: "student_profile", studentQuery: "Elena Prueba", responseStyle: "detailed" };
      return new Response(JSON.stringify({ model: "qwen3.5:9b", message: { role: "assistant", content: JSON.stringify(decision) }, done: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    try {
      const list = await chatModule.handleChat({ message: "Dime los nombres de todos los alumnos" });
      expect(list.message.agentId).toBe("student-agent");
      expect(list.message.content).toContain("Hay 4 alumnos registrados");
      expect(list.message.content).toContain("Elena Prueba");

      const count = await chatModule.handleChat({ message: "¿Tengo alumnos?" });
      expect(count.message.content).toContain("Hay 4 alumnos registrados");

      const filtered = await chatModule.handleChat({ message: "Dime los nombres de los alumnos que empiecen por la letra E" });
      expect(filtered.message.content).toContain("He encontrado 1 alumno que cumple los filtros");
      expect(filtered.message.content).toContain("Elena Prueba");
      expect(filtered.message.content).not.toContain("Lucas Prueba");

      const contextualProfile = await chatModule.handleChat({
        conversationId: filtered.conversationId,
        message: "¿Qué sabes de ella?",
      });
      expect(contextualProfile.message.agentId).toBe("memory-agent");
      expect(contextualProfile.message.content).toContain("Elena Prueba");
      expect(contextualProfile.message.content).not.toContain("indicarme su nombre");

      const contextualObservation = await chatModule.handleChat({
        conversationId: filtered.conversationId,
        message: "Necesita más tiempo para terminar las tareas",
      });
      expect(contextualObservation.message.agentId).toBe("student-agent");
      expect(contextualObservation.message.content).toContain("observación para Elena");
      expect(contextualObservation.pendingAction?.operation).toBe("record_observation");

      const contextualTutoring = await chatModule.handleChat({
        conversationId: filtered.conversationId,
        message: "Prepara una tutoría para la familia",
      });
      expect(contextualTutoring.message.agentId).toBe("tutoring-agent");
      expect(contextualTutoring.message.content).toContain("TUTORÍA · Elena Prueba");
      expect(contextualTutoring.pendingAction?.operation).toBe("save_tutoring");

      const storedConversation = await databaseModule.database.conversation.findUniqueOrThrow({ where: { id: filtered.conversationId } });
      expect(JSON.parse(storedConversation.contextJson).activeStudentIds).toEqual([expect.any(String)]);

      const unknownStudent = await chatModule.handleChat({
        conversationId: filtered.conversationId,
        message: "¿Qué sabes de Pedro?",
      });
      expect(unknownStudent.message.content).toContain("indicarme su nombre");
      expect(unknownStudent.message.content).not.toContain("Elena Prueba pertenece");

      const profile = await chatModule.handleChat({ message: "Quién es Elena" });
      expect(profile.message.agentId).toBe("memory-agent");
      expect(profile.message.content).toContain("Elena Prueba pertenece a Prueba");
      const followUp = await chatModule.handleChat({ conversationId: profile.conversationId, message: "¿Y qué observaciones tiene?" });
      expect(followUp.message.content).toContain("Observaciones confirmadas de Elena Prueba");
      expect(followUp.message.content).not.toContain("no hay datos de alumnos");
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("prepares and confirms a bulk student enrollment exactly once", async () => {
    const classroom = await databaseModule.database.classroom.findFirstOrThrow({ where: { name: "3º ESO Z" } });
    const response = await chatModule.handleChat({
      message: "Añade a Nuria Alba, Sergio Montes y Laura Vidal a 3º ESO Z",
    });
    expect(response.pendingAction?.operation, response.message.content).toBe("create_students_bulk");
    expect(response.message.content).toContain("Nuria Alba");
    expect(await databaseModule.database.studentEnrollment.count({ where: { classroomId: classroom.id } })).toBe(0);

    const first = await actionModule.confirmAction(response.pendingAction!.id);
    const second = await actionModule.confirmAction(response.pendingAction!.id);
    expect(first.alreadyExecuted).toBe(false);
    expect(second.alreadyExecuted).toBe(true);
    const enrollments = await databaseModule.database.studentEnrollment.findMany({
      where: { classroomId: classroom.id }, include: { student: true }, orderBy: { student: { firstName: "asc" } },
    });
    expect(enrollments.map((item) => `${item.student.firstName} ${item.student.lastName}`)).toEqual([
      "Laura Vidal", "Nuria Alba", "Sergio Montes",
    ]);
  });

  it("prepares a natural-language teaching schedule and creates its domain records after confirmation", async () => {
    const response = await chatModule.handleChat({
      message: "Durante 2027-2028 tengo Música con 4.º ESO A los lunes y miércoles de 8:00 a 9:00; Tecnología con 2.º ESO B los martes de 10:00 a 11:00",
    });
    expect(response.pendingAction?.operation).toBe("create_teaching_schedule");
    expect(response.message.content).toContain("3 franjas");
    expect(await databaseModule.database.timetableSlot.count()).toBe(0);

    const first = await actionModule.confirmAction(response.pendingAction!.id);
    const second = await actionModule.confirmAction(response.pendingAction!.id);
    expect(first.alreadyExecuted).toBe(false);
    expect(second.alreadyExecuted).toBe(true);
    const timetable = await databaseModule.database.weeklyTimetable.findUniqueOrThrow({
      where: { name_academicYear: { name: "Horario docente", academicYear: "2027-2028" } },
      include: { slots: { include: { teachingAssignment: { include: { classroom: true, subject: true } } }, orderBy: [{ dayOfWeek: "asc" }] } },
    });
    expect(timetable.slots).toHaveLength(3);
    expect(timetable.slots.map((slot) => `${slot.dayOfWeek}:${slot.teachingAssignment.subject.name}:${slot.teachingAssignment.classroom.name}`)).toEqual([
      "1:Música:4.º ESO A", "2:Tecnología:2.º ESO B", "3:Música:4.º ESO A",
    ]);
  });

  it("records auditable A2A requests and responses without model reasoning", async () => {
    const result = await alfredToolsModule.executeAlfredTool("list_classrooms", {}, {
      requestId: "integration-a2a-list-classrooms",
    });
    expect(result.agentId).toBe("classroom-agent");
    const history = await internalA2AModule.getInternalA2AHistory();
    const exchange = history.conversations.find((item) => item.requestId === "integration-a2a-list-classrooms");
    expect(exchange?.status).toBe("completed");
    expect(exchange?.messages.map((message) => message.kind)).toEqual(["request", "response"]);
    expect(exchange?.messages[0].fromAgentId).toBe("alfred-orchestrator");
    expect(exchange?.messages[0].toAgentId).toBe("classroom-agent");
    expect(exchange?.messages[0].protocol).toBe("1.0");
    expect(exchange?.messages[0].payload).toEqual(expect.objectContaining({
      messageId: expect.any(String),
      taskId: "integration-a2a-list-classrooms",
      role: "ROLE_USER",
      parts: expect.any(Array),
    }));
    expect(exchange?.messages[1].payload).toEqual(expect.objectContaining({
      id: "integration-a2a-list-classrooms",
      status: expect.objectContaining({ state: "TASK_STATE_COMPLETED" }),
      artifacts: expect.any(Array),
    }));
    expect(JSON.stringify(exchange)).not.toMatch(/reasoning|razonamiento|system prompt/i);
  });

  it("generates recurring lessons once and rejects timetable overlaps", async () => {
    const subject = await databaseModule.database.subject.create({ data: { name: "Inglés", code: "TEST-EN" } });
    const assignment = await databaseModule.database.teachingAssignment.create({ data: { subjectId: subject.id, classroomId, academicYear: "2026-2027" } });
    const timetable = await databaseModule.database.weeklyTimetable.create({ data: { name: "Horario de prueba", academicYear: "2026-2027", validFrom: new Date("2026-09-01T00:00:00.000Z") } });
    await planningModule.createTimetableSlot({ weeklyTimetableId: timetable.id, teachingAssignmentId: assignment.id, dayOfWeek: 1, startMinute: 540, endMinute: 595, activityType: "class", room: "Aula 1" });
    await expect(planningModule.createTimetableSlot({ weeklyTimetableId: timetable.id, teachingAssignmentId: assignment.id, dayOfWeek: 1, startMinute: 570, endMinute: 625, activityType: "class" })).rejects.toThrow(/solapa/);
    const first = await planningModule.generateWeekSessions("2026-10-19");
    const second = await planningModule.generateWeekSessions("2026-10-19");
    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect((await planningModule.getWeekPlan("2026-10-19")).lessons).toHaveLength(1);

    const proposal = await actionModule.proposeAction({ type: "plan_week", weekStart: "2026-10-19" });
    const executed = await actionModule.confirmAction(proposal.id);
    const repeated = await actionModule.confirmAction(proposal.id);
    const planned = (await planningModule.getWeekPlan("2026-10-19")).lessons[0];
    expect(executed.alreadyExecuted).toBe(false);
    expect(repeated.alreadyExecuted).toBe(true);
    expect(planned.status).toBe("planned");
    expect(planned.activities).toHaveLength(3);
    expect(planned.activities.reduce((sum, item) => sum + item.durationMinutes, 0)).toBe(55);
  });

  it("builds the daily workspace from the durable timetable", async () => {
    const freeDay = await dashboardModule.getDailyDashboard("2026-10-18");
    expect(freeDay.lessons).toHaveLength(0);
    expect(freeDay.nextLesson?.teachingAssignment.subject.name).toBe("Inglés");

    const dashboard = await dashboardModule.getDailyDashboard("2026-10-19");
    expect(dashboard.date).toBe("2026-10-19");
    expect(dashboard.timezone).toBe("Europe/Madrid");
    expect(dashboard.lessons).toHaveLength(1);
    expect(dashboard.lessons[0]).toEqual(expect.objectContaining({
      startMinute: 540,
      endMinute: 595,
      status: "planned",
    }));
    expect(dashboard.lessons[0].teachingAssignment.subject.name).toBe("Inglés");
    expect(dashboard.lessons[0].teachingAssignment.classroom.name).toBe("Prueba");
  });

  it("keeps academic records scoped to one subject and group", async () => {
    const assignment = await databaseModule.database.teachingAssignment.findFirstOrThrow({ where: { subject: { code: "TEST-EN" } } });
    const student = await databaseModule.database.student.findFirstOrThrow({ where: { firstName: "Lucas" } });
    const record = await teachingModule.saveStudentSubjectRecord({
      teachingAssignmentId: assignment.id,
      studentId: student.id,
      progressStatus: "on_track",
      participationStatus: "high",
      homeworkStatus: "up_to_date",
      teacherNotes: "Buen progreso en Inglés.",
      supportNotes: null,
    });
    await teachingModule.addAssessmentGrade({
      teachingAssignmentId: assignment.id,
      studentId: student.id,
      title: "Prueba de vocabulario",
      assessmentPeriod: "1.ª evaluación",
      score: 8.5,
      maxScore: 10,
      weight: 1,
      assessedAt: "2026-10-19",
      notes: null,
    });
    const portfolio = await teachingModule.getTeachingPortfolio();
    const stored = portfolio.find((item) => item.id === assignment.id)?.studentRecords.find((item) => item.id === record.id);
    expect(stored?.grades).toHaveLength(1);
    expect(stored?.grades[0].score).toBe(8.5);
  });

  it("separates the tutor group from teaching assignments", async () => {
    const workspace = await tutorGroupModule.setTutorGroup({ classroomId });
    expect(workspace.classroom?.name).toBe("Prueba");
    expect(workspace.classroom?.enrollments).toHaveLength(4);
    expect((await teachingModule.getTeachingPortfolio())[0]).toHaveProperty("subject");
  });

  it("keeps the original teacher comment and saves only the reviewed version for the next tutoring", async () => {
    const student = await databaseModule.database.student.findFirstOrThrow({ where: { firstName: "Lucas" } });
    const created = await teacherFeedbackModule.createTeacherFeedback({
      studentId: student.id,
      teacherName: "Profesora de Matemáticas",
      subject: "Matemáticas",
      originalComment: "Trabaja bien pero se precipita al resolver problemas.",
      receivedAt: "2026-10-20",
    });
    expect(created.originalComment).toContain("se precipita");
    expect(created.familyVersionStatus).toBe("proposed");
    expect(created.tutoringSessionId).toBeNull();

    const confirmed = await teacherFeedbackModule.confirmTeacherFeedback({
      feedbackId: created.id,
      familyVersion: "Trabaja con constancia; estamos reforzando que revise cada problema antes de darlo por terminado.",
    });
    expect(confirmed.feedback.familyVersionStatus).toBe("confirmed");
    expect(confirmed.feedback.tutoringSessionId).toBe(confirmed.tutoringSession.id);

    const workspace = await tutorGroupModule.getTutorWorkspace();
    const tutorStudent = workspace.classroom?.enrollments.find((item) => item.student.id === student.id)?.student;
    expect(tutorStudent?.teacherFeedbacks[0]).toEqual(expect.objectContaining({
      originalComment: "Trabaja bien pero se precipita al resolver problemas.",
      familyVersionStatus: "confirmed",
    }));
    expect(tutorStudent?.tutoringSessions.find((item) => item.id === confirmed.tutoringSession.id)?.teacherFeedbacks).toHaveLength(1);

    const preparation = await actionModule.proposeAction({
      type: "save_tutoring",
      studentId: student.id,
      preparation: "Preparación revisada de la próxima tutoría.",
    });
    const savedPreparation = await actionModule.confirmAction(preparation.id);
    expect(savedPreparation.entityId).toBe(confirmed.tutoringSession.id);
    expect(await databaseModule.database.tutoringSession.findUnique({ where: { id: confirmed.tutoringSession.id } })).toEqual(expect.objectContaining({
      status: "prepared",
      preparation: "Preparación revisada de la próxima tutoría.",
    }));
  });

  it("stores searchable pseudonymized ChatGPT request logs and their observable response", async () => {
    const conversation = await databaseModule.database.conversation.create({ data: { title: "Auditoría" } });
    const startedAt = new Date();
    const traceId = await cloudAiLogModule.cloudAiTraceSink.start({
      context: { conversationId: conversation.id, operation: "alfred_chat", agentId: "alfred-orchestrator" },
      provider: "openai-chatgpt",
      endpoint: "https://api.openai.com/v1/responses",
      model: "gpt-test",
      requestBody: { model: "gpt-test", input: [{ role: "user", content: "Háblame de ALUMNO_ABCDEF1234" }], store: false },
      startedAt,
    });
    await cloudAiLogModule.cloudAiTraceSink.complete(traceId, {
      responseBody: { id: "resp_test", status: "completed", output: [{ type: "message", content: "ALUMNO_ABCDEF1234" }] },
      responseId: "resp_test",
      requestId: "req_test",
      inputTokens: 11,
      outputTokens: 4,
      totalTokens: 15,
      durationMs: 120,
      finishedAt: new Date(),
    });
    const dashboard = await cloudAiLogModule.getCloudAiLogDashboard({ query: "ABCDEF1234", status: "all", model: "all", operation: "all", range: "all", limit: 100 });
    expect(dashboard.summary.total).toBe(1);
    expect(dashboard.logs[0]).toEqual(expect.objectContaining({ status: "completed", requestId: "req_test", agentId: "alfred-orchestrator", totalTokens: 15, studentAliasCount: 1 }));
    expect(JSON.stringify(dashboard.logs[0])).toContain("ALUMNO_ABCDEF1234");
    expect(JSON.stringify(dashboard.logs[0])).not.toMatch(/Lucas|Elena|Marcos|Pablo/);

    const alfred = (await agentAdminModule.getAgentDashboard()).find((agent) => agent.id === "alfred-orchestrator");
    expect(alfred?.ai.tokenUsage).toEqual(expect.objectContaining({
      requests: 1,
      measuredRequests: 1,
      inputTokens: 11,
      outputTokens: 4,
      totalTokens: 15,
      averageTokensPerRequest: 15,
    }));

    const exported = await dataExportModule.createDataExport({ datasets: ["cloudAiUsage"], format: "xlsx" }, new Date("2026-10-20T12:00:00Z"));
    expect(exported.filename).toBe("alfred-cloudAiUsage-2026-10-20.xlsx");
    expect(exported.contentType).toContain("spreadsheetml");
    expect(exported.content[0]).toBe(0x50);
    expect(exported.content[1]).toBe(0x4b);
  });

  it("browses allowlisted tables and requires exact confirmation before deleting", async () => {
    const overview = await databaseAdminModule.getDatabaseOverview("students");
    expect(overview.tables).toHaveLength(31);
    expect(overview.selected.label).toBe("Alumnos");
    expect(overview.selected.rows.length).toBeGreaterThan(0);

    const disposable = await databaseModule.database.student.create({ data: { firstName: "Temporal", lastName: "Borrable" } });
    await expect(databaseAdminModule.removeManagedRecord("students", disposable.id, "BORRAR")).rejects.toThrow(/confirmación/);
    expect(await databaseModule.database.student.findUnique({ where: { id: disposable.id } })).not.toBeNull();
    await databaseAdminModule.removeManagedRecord("students", disposable.id, `BORRAR ${disposable.id}`);
    expect(await databaseModule.database.student.findUnique({ where: { id: disposable.id } })).toBeNull();

    await expect(databaseAdminModule.clearManagedData("conversations", "BORRAR TODO")).rejects.toThrow(/confirmación/);
    await databaseAdminModule.clearManagedData("conversations", "BORRAR CONVERSATIONS");
    expect(await databaseModule.database.conversation.count()).toBe(0);
    expect(await databaseModule.database.pendingAction.count()).toBe(0);
    expect(await databaseModule.database.agentConversation.count()).toBe(0);
  });
});
