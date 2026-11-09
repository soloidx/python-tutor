import {
  test,
  expect,
  enterCourse,
  publication,
  updateCourse,
  serveCatalog,
  sourceBase,
} from "./fixtures/catalog.js";

test.use({ actionTimeout: 8000 });

const progressKey = "python-tutor:course-progress:v1:python-fundamentos";
const backupPrefix = "python-tutor:recovery:v1:python-fundamentos:";

test("partial learner recovery keeps approvals, position and valid assessment answers with an exact raw copy", async ({
  page,
  context,
}) => {
  const value = publication("recovery");
  updateCourse(value, "python-fundamentos", (course) => {
    course.assessment = {
      questions: [
        {
          id: "valor",
          prompt: "¿Cuánto vale?",
          options: [
            { id: "dos", text: "Dos" },
            { id: "tres", text: "Tres" },
          ],
          answerId: "dos",
          explanation: "Vale dos.",
        },
      ],
    };
  });
  await serveCatalog(context, value);
  await page.goto("/");
  await enterCourse(page);
  await page
    .getByLabel("Código Python")
    .fill('nombre = "Ada"\nprint("Hola, " + nombre)');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await page
    .getByRole("button", { name: "Siguiente tema", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Expresiones y salida", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Volver a temas", exact: true })
    .first()
    .click();
  const raw = await page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key));
    saved.completed.push(null, "ejercicio-retirado");
    saved.assessmentResult = {
      answers: { valor: "dos", retirada: "opcion-a", rota: 7 },
      score: "incorrecto",
    };
    const raw = JSON.stringify(saved);
    localStorage.setItem(key, raw);
    return raw;
  }, progressKey);
  await page.reload();
  await expect(
    page.getByRole("alert").filter({ hasText: /recuperación parcial/i }),
  ).toBeVisible();
  await enterCourse(page);
  await expect(
    page.getByText("1 / 12 ejercicios", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Expresiones y salida", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Volver a temas", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Ver evaluación final", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tu resultado: 1 de 1", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (prefix) =>
        Object.keys(localStorage)
          .filter((key) => key.startsWith(prefix))
          .map((key) => localStorage.getItem(key)),
      backupPrefix,
    ),
  ).toContain(raw);
  await page.reload();
  await enterCourse(page);
  await expect(
    page.getByText("1 / 12 ejercicios", { exact: true }),
  ).toBeVisible();
});

test("history recovery preserves valid exchanges and attempts, interrupts saved generation and isolates other courses", async ({
  page,
}) => {
  const { setup } = await import("./fixtures/tutor.js");
  const requests = await setup(page);
  await page.getByLabel("Mensaje al tutor").fill("Pregunta conservada");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText("Respuesta completa", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Todas las rutas", exact: true })
    .click();
  await enterCourse(page, { course: "Python Práctica" });
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await page.getByLabel("Mensaje al tutor").fill("Pregunta de otro curso");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText("Respuesta completa", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Todas las rutas", exact: true })
    .click();
  const raw = await page.evaluate(() => {
    const key = "python-tutor:course-conversations:v1:python-fundamentos";
    const saved = JSON.parse(localStorage.getItem(key));
    saved[0].attempts.push(
      {
        id: "bad-error",
        text: "Texto de intento dañado",
        status: "incomplete",
        error: { invalid: true },
      },
      {
        id: "partial",
        text: "Parcial conservado",
        status: "generating",
      },
    );
    saved.push({ id: "invalid" });
    const raw = JSON.stringify(saved);
    localStorage.setItem(key, raw);
    return raw;
  });
  await page.reload();
  await expect(
    page.getByRole("alert").filter({ hasText: /recuperación parcial/i }),
  ).toBeVisible();
  await enterCourse(page);
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await expect(
    page.getByText("Pregunta conservada", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Respuesta completa", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Parcial conservado", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Respuesta interrumpida al recargar/),
  ).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(
    await page.evaluate(
      (prefix) =>
        Object.keys(localStorage)
          .filter((key) => key.startsWith(prefix))
          .map((key) => localStorage.getItem(key)),
      backupPrefix,
    ),
  ).toContain(raw);
  await page
    .getByRole("button", { name: "Todas las rutas", exact: true })
    .click();
  await enterCourse(page, { course: "Python Práctica" });
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await expect(
    page.getByText("Pregunta de otro curso", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await enterCourse(page);
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await expect(
    page.getByText("Parcial conservado", { exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(2);
});

test("failed recovery copies protect original learner data through visits and new approvals", async ({
  page,
}) => {
  await page.goto("/");
  await enterCourse(page);
  await page
    .getByLabel("Código Python")
    .fill('nombre = "Ada"\nprint("Hola, " + nombre)');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await page
    .getByRole("button", { name: "Volver a temas", exact: true })
    .first()
    .click();
  const raw = await page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key));
    saved.topicId = 7;
    const raw = JSON.stringify(saved);
    localStorage.setItem(key, raw);
    return raw;
  }, progressKey);
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("python-tutor:recovery:v1:"))
        throw new DOMException("Full", "QuotaExceededError");
      return set.call(this, key, value);
    };
  });
  await page.reload();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: /no se pudo guardar una copia/i }),
  ).toBeVisible();
  await enterCourse(page);
  await expect(
    page.getByText("1 / 12 ejercicios", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /2\. Un valor que cambia/ }).click();
  await page
    .getByLabel("Código Python")
    .fill("edad = 20\nedad = edad + 1\nprint(edad)");
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await expect(
    page.getByText("2 / 12 ejercicios", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), progressKey),
  ).toBe(raw);
  expect(
    await page.evaluate(
      (prefix) =>
        Object.keys(localStorage).filter((key) => key.startsWith(prefix)),
      backupPrefix,
    ),
  ).toHaveLength(0);
  await page.reload();
  await enterCourse(page);
  await expect(
    page.getByText("1 / 12 ejercicios", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: /no se pudo guardar una copia/i }),
  ).toBeVisible();
});

test("a damaged latest attempt never turns an older completed answer into a confirmed antecedent", async ({
  page,
}) => {
  const { setup } = await import("./fixtures/tutor.js");
  const requests = await setup(page);
  await page
    .getByLabel("Mensaje al tutor")
    .fill("Pregunta con reintento dañado");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText("Respuesta completa", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Todas las rutas", exact: true })
    .click();
  await page.evaluate(() => {
    const key = "python-tutor:course-conversations:v1:python-fundamentos";
    const saved = JSON.parse(localStorage.getItem(key));
    saved[0].attempts.push({ id: "bad-latest", text: 42, status: "complete" });
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload();
  await enterCourse(page);
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await expect(
    page.getByText("Pregunta con reintento dañado", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Mensaje al tutor").fill("Nueva pregunta");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Nueva pregunta", { exact: true })).toBeVisible();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].messages).toHaveLength(2);
});

test("failed conversation backup keeps the original through a new answer and reload", async ({
  page,
}) => {
  const { setup } = await import("./fixtures/tutor.js");
  const requests = await setup(page);
  await page.getByLabel("Mensaje al tutor").fill("Pregunta válida guardada");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText("Respuesta completa", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Todas las rutas", exact: true })
    .click();
  const raw = await page.evaluate(() => {
    const key = "python-tutor:course-conversations:v1:python-fundamentos";
    const saved = JSON.parse(localStorage.getItem(key));
    saved.push(null);
    const raw = JSON.stringify(saved);
    localStorage.setItem(key, raw);
    return raw;
  });
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("python-tutor:recovery:v1:"))
        throw new DOMException("Blocked", "QuotaExceededError");
      return set.call(this, key, value);
    };
  });
  await page.reload();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: /no se pudo guardar una copia/i }),
  ).toBeVisible();
  await enterCourse(page);
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await expect(
    page.getByText("Pregunta válida guardada", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Mensaje al tutor").fill("Pregunta solo de sesión");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText("Respuesta completa", { exact: true }),
  ).toHaveCount(2);
  expect(
    await page.evaluate(() =>
      localStorage.getItem(
        "python-tutor:course-conversations:v1:python-fundamentos",
      ),
    ),
  ).toBe(raw);
  await page.reload();
  await enterCourse(page);
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await expect(
    page.getByText("Pregunta válida guardada", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Pregunta solo de sesión", { exact: true }),
  ).toHaveCount(0);
  expect(requests).toHaveLength(2);
});

test("an unavailable catalog preserves learner data and never creates recovery copies", async ({
  page,
  context,
}) => {
  const { setup } = await import("./fixtures/tutor.js");
  const requests = await setup(page);
  await page
    .getByLabel("Código Python")
    .fill('nombre = "Ada"\nprint("Hola, " + nombre)');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await page
    .getByLabel("Mensaje al tutor")
    .fill("Conversación antes de desconectar");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText("Respuesta completa", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Todas las rutas", exact: true })
    .click();
  await page.evaluate(() => localStorage.removeItem("python-tutor:catalog:v1"));
  await context.route(
    `${sourceBase}**`,
    (route) => route.abort(),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "No se pudo cargar el catálogo",
  );
  await serveCatalog(context);
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await enterCourse(page);
  await expect(
    page.getByText("1 / 12 ejercicios", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await expect(
    page.getByText("Conversación antes de desconectar", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        key.startsWith("python-tutor:recovery:v1:"),
      ),
    ),
  ).toHaveLength(0);
  expect(requests).toHaveLength(1);
});
