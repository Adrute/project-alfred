import { test, expect } from "@playwright/test";

test("complete teacher demonstration", async ({ page }) => {
  await page.goto("/");
  const aiStatus = await page.request.get("/api/auth/chatgpt");
  expect(aiStatus.ok()).toBe(true);
  expect(await aiStatus.json()).toMatchObject({ connected: false, planEnabled: false });
  await expect(page.getByRole("heading", { name: "Tu día" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continuar con ChatGPT" })).toBeVisible();
  await expect(page.locator(".sidebar-brand-avatar img")).toHaveAttribute("src", /alfred-avatar/);
  await expect(page.locator(".hero-avatar img")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Agenda de hoy", exact: true })).toBeVisible();
  await expect(page.getByText("Clases de hoy", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pendientes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir Alfred" })).toBeVisible();

  await page.getByRole("button", { name: /Mis asignaturas/ }).click();
  await expect(page.locator(".assignment-strip > button")).toHaveCount(3);
  await page.locator(".assignment-strip > button", { hasText: "Inglés" }).filter({ hasText: "2.º ESO C" }).click();
  await page.locator(".subject-student-list > button", { hasText: "Lucas Serrano" }).click();
  await expect(page.getByRole("heading", { name: "Lucas Serrano" })).toBeVisible();
  await expect(page.locator(".grade-list")).toContainText("Present Perfect");
  await page.locator(".grade-form input").nth(0).fill("Expresión oral");
  await page.locator(".grade-form input").nth(2).fill("8.4");
  await page.locator(".grade-form").getByRole("button", { name: /Añadir/ }).click();
  await expect(page.locator(".grade-list")).toContainText("Expresión oral");
  await page.getByRole("button", { name: "Ver ficha general →" }).click();
  await expect(page.getByText("Ficha general del alumno")).toBeVisible();
  await expect(page.locator(".subject-context-card", { hasText: "Inglés" })).toContainText("solo esta asignatura");
  await expect(page.locator(".tutor-context-card")).toContainText("Seguimiento tutorial");
  await page.locator(".subject-context-card", { hasText: "Inglés" }).click();
  await expect(page.getByText("Ficha académica · Inglés")).toBeVisible();
  await page.getByRole("button", { name: "Ver ficha general →" }).click();
  await page.locator(".tutor-context-card").click();

  await expect(page.locator(".tutor-hero")).toContainText("2.º ESO C");
  await expect(page.locator(".tutor-roster > button")).toHaveCount(25);
  await expect(page.getByRole("heading", { name: "Lucas Serrano" })).toBeVisible();

  await page.getByRole("button", { name: /Grupos/ }).click();
  await page.locator(".class-card", { hasText: "2.º ESO C" }).click();
  await expect(page.getByRole("heading", { name: "2.º ESO C" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Añadir varios alumnos" })).toBeVisible();
  await expect(page.locator(".roster-grid article")).toHaveCount(25);
  await page.getByRole("button", { name: "Abrir ficha de Teo Pastor" }).click();
  await expect(page.getByText("Ficha general del alumno")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Teo Pastor" })).toBeVisible();
  await expect(page.locator(".subject-context-card").first()).toBeVisible();

  await page.getByRole("button", { name: "Abrir Alfred" }).click();
  const floatingAlfred = page.getByRole("region", { name: "Alfred, asistente contextual" });
  await expect(floatingAlfred.getByRole("button", { name: /Viendo Alumnos/ })).toBeVisible();
  await floatingAlfred.getByRole("button", { name: "Nueva conversación" }).click();
  const floatingComposer = floatingAlfred.getByRole("textbox", { name: "Mensaje para Alfred" });
  await floatingComposer.fill("¿Qué sabes de él?");
  await floatingComposer.press("Enter");
  await expect(floatingAlfred.locator(".floating-message.assistant").last()).toContainText("Teo Pastor", { timeout: 45_000 });
  await floatingAlfred.getByRole("button", { name: "Nueva conversación" }).click();
  await floatingComposer.fill("Quiero añadir una clase nueva");
  await floatingComposer.press("Enter");
  await expect(floatingAlfred.locator(".floating-message.assistant").last()).toContainText(/Para crear (?:una nueva|la) clase necesito/, { timeout: 45_000 });
  await expect(floatingAlfred.locator(".confirmation-card")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Alumnos" })).toBeVisible();
  await floatingAlfred.getByRole("button", { name: "Cerrar Alfred" }).click();

  await page.getByRole("button", { name: /Planificación/ }).click();
  await expect(page.getByRole("heading", { name: "Planificación" })).toBeVisible();
  await expect(page.locator(".lesson-card").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Configurar horario" })).toBeVisible();

  await page.getByRole("button", { name: /Chat con Alfred/ }).click();
  const composer = page.getByPlaceholder("Escribe a Alfred…");
  await composer.fill("Lucas participa mucho en clase");
  await composer.press("Enter");
  const confirmation = page.locator(".confirmation-card").last();
  await expect(confirmation).toContainText("Pendiente de confirmación", { timeout: 150_000 });
  await confirmation.getByRole("button", { name: "Confirmar y guardar" }).click();
  await expect(confirmation).toContainText("Guardado");

  await page.reload();
  await page.getByRole("button", { name: /Chat con Alfred/ }).click();
  await composer.fill("¿Qué sabes de Lucas?");
  await composer.press("Enter");
  await expect(page.locator(".chat-bubble").last()).toContainText("Lucas Serrano");
  await expect(page.locator(".chat-bubble").last()).toContainText(/particip/i);
  await expect(page.locator(".chat-row.assistant .mini-avatar img").last()).toBeVisible();
  await expect(page.locator(".chat-row.assistant .agent-label").last()).toHaveText("Alfred");
  await expect(page.locator(".chat-row.assistant .agent-label").filter({ hasText: /Agente de alumnos|Agente de memoria|Agente de tutorías|Agente de aula/i })).toHaveCount(0);

  await composer.fill("Prepárame una tutoría con la familia de Lucas");
  await composer.press("Enter");
  const tutoringConfirmation = page.locator(".confirmation-card").last();
  await expect(tutoringConfirmation).toContainText("save tutoring", { timeout: 150_000 });
  await tutoringConfirmation.getByRole("button", { name: "Confirmar y guardar" }).click();
  await expect(tutoringConfirmation).toContainText("Guardado");
  await expect(composer).toBeEnabled();

  await composer.fill("Organiza los 25 alumnos en cinco filas de cinco");
  await composer.press("Enter");
  const layoutConfirmation = page.locator(".confirmation-card").last();
  await expect(layoutConfirmation).toContainText("save layout");
  await layoutConfirmation.getByRole("button", { name: "Confirmar y guardar" }).click();

  await page.getByRole("button", { name: /Organización del aula/ }).click();
  await expect(page.getByText("PIZARRA", { exact: true })).toBeVisible();
  await expect(page.locator(".seat-grid button")).toHaveCount(25);
  await page.locator(".seat-grid button", { hasText: "Carla" }).click();
  await page.locator(".seat-grid button", { hasText: "Daniel" }).click();
  await expect(page.getByText(/Selecciona dos pupitres/)).toBeVisible();

  await page.getByRole("button", { name: /Chat con Alfred/ }).click();
  const chatsBefore = await page.locator(".chat-history > button:not(.new-chat)").count();
  await page.getByRole("button", { name: /Nueva conversación/ }).click();
  await composer.fill("¿Hay algún alumno que se lleve mal con otro?");
  await composer.press("Enter");
  await expect(page.locator(".chat-bubble").last()).toContainText("Lucas");
  await expect(page.locator(".chat-bubble").last()).toContainText("Marcos");
  await expect(page.locator(".chat-history > button:not(.new-chat)")).toHaveCount(Math.min(chatsBefore + 1, 50));

  await page.getByRole("button", { name: /Nueva conversación/ }).click();
  await expect(page.locator(".chat-bubble")).toHaveCount(0);
  await page.locator(".chat-history > button:not(.new-chat)").first().click();
  await expect(page.locator(".chat-bubble").last()).toContainText("Lucas");
  await expect(page.locator(".chat-bubble").last()).toContainText("Marcos");

  await page.getByRole("button", { name: /Nueva conversación/ }).click();
  await composer.fill("Cuántos estudiantes tengo registrados");
  await composer.press("Enter");
  await expect(page.locator(".chat-bubble").last()).toContainText(/25 (?:alumnos|estudiantes)/i, { timeout: 45_000 });
  await composer.fill("Dime los nombres de todos los alumnos que empiecen por la letra A");
  await composer.press("Enter");
  await expect(page.locator(".chat-bubble").last()).toContainText("Alicia Ríos", { timeout: 45_000 });
  await expect(page.locator(".chat-bubble").last()).toContainText("Ana Robles");
  await expect(page.locator(".chat-bubble").last()).not.toContainText("Bruno Soler");

  await page.getByRole("button", { name: /Nueva conversación/ }).click();
  await composer.fill("Necesito que me digas cuántos alumnos tengo con nombres que empiecen por E");
  await composer.press("Enter");
  await expect(page.locator(".chat-bubble").last()).toContainText(/2 (?:alumnos|estudiantes)/i, { timeout: 45_000 });
  await composer.fill("Dime quiénes son");
  await composer.press("Enter");
  await expect(page.locator(".chat-bubble").last()).toContainText("Elena Campos", { timeout: 45_000 });
  await expect(page.locator(".chat-bubble").last()).toContainText("Eva Galán");
  await expect(page.locator(".chat-bubble").last()).not.toContainText("Alicia Ríos");

  await composer.fill("Dime los nombres de los alumnos que empiecen por la letra T");
  await composer.press("Enter");
  await expect(page.locator(".chat-bubble").last()).toContainText("Teo Pastor", { timeout: 45_000 });
  await composer.fill("¿Qué sabes de él?");
  await composer.press("Enter");
  await expect(page.locator(".chat-bubble").last()).toContainText("Teo Pastor", { timeout: 45_000 });
  await expect(page.locator(".chat-bubble").last()).not.toContainText("indicarme su nombre");
  await composer.fill("¿En qué grupo está?");
  await composer.press("Enter");
  await expect(page.locator(".chat-bubble").last()).toContainText("Teo Pastor", { timeout: 45_000 });
  await expect(page.locator(".chat-bubble").last()).toContainText("2.º ESO C");

  await composer.fill("Dime los nombres de todos los alumnos");
  await composer.press("Enter");
  await expect(page.locator(".chat-bubble").last()).toContainText("Óscar Ferrer", { timeout: 45_000 });
  const scroll = await page.locator(".conversation").evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  }));
  expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
  expect(scroll.scrollTop + scroll.clientHeight).toBeGreaterThanOrEqual(scroll.scrollHeight - 12);
  await expect(composer).toBeVisible();

  await page.getByRole("button", { name: /Administración/ }).click();
  await expect(page.locator(".agent-list > button")).toHaveCount(7);
  await expect(page.getByLabel("Modelo de IA de Alfred")).toBeVisible();
  await expect(page.getByLabel("Modelo de IA de Alfred")).toBeDisabled();
  await page.locator(".agent-list > button", { hasText: "CurriculumAgent" }).click();
  await expect(page.getByLabel("Modelo de IA de CurriculumAgent")).toHaveCount(0);
  await page.getByRole("button", { name: /Detener/ }).click();
  await expect(page.locator(".runtime-badge")).toContainText("Detenido");
  await page.getByRole("button", { name: /Iniciar/ }).click();
  await expect(page.locator(".runtime-badge")).toContainText("Activo");

  await page.getByRole("tab", { name: "Logs" }).click();
  await expect(page.getByRole("heading", { name: "Peticiones a ChatGPT" })).toBeVisible();
  await expect(page.getByLabel("Buscar en logs")).toBeVisible();
  await expect(page.getByText("No hay logs para estos filtros")).toBeVisible();

  await page.getByRole("tab", { name: "Conversaciones A2A" }).click();
  await expect(page.getByRole("heading", { name: "Intercambios" })).toBeVisible();
  await expect(page.locator(".a2a-thread-list > button").first()).toBeVisible();
  await expect(page.locator(".a2a-message").first()).toContainText("Alfred");

  await page.getByRole("tab", { name: "Base de datos" }).click();
  await expect(page.getByRole("heading", { name: "Tablas" })).toBeVisible();
  await expect(page.locator(".database-table-list > button")).toHaveCount(30);
  await expect(page.getByRole("heading", { name: "Alumnos" })).toBeVisible();
  const conversationDeletion = page.locator(".deletion-grid article", { hasText: "Conversaciones y acciones pendientes" });
  await conversationDeletion.getByRole("button", { name: "Borrar área" }).click();
  const deleteDialog = page.getByRole("dialog");
  await expect(deleteDialog).toContainText("BORRAR CONVERSATIONS");
  await expect(deleteDialog.getByRole("button", { name: "Borrar definitivamente" })).toBeDisabled();
  await deleteDialog.getByRole("textbox").fill("BORRAR");
  await expect(deleteDialog.getByRole("button", { name: "Borrar definitivamente" })).toBeDisabled();
  await deleteDialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(deleteDialog).toBeHidden();
});
