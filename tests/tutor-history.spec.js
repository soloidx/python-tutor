import { test, expect, enterCourse } from "./fixtures/catalog.js";
import { setup, model, frame } from "./fixtures/tutor.js";
import { streamingOpenRouter } from "./fixtures/openrouter.js";

test.use({ actionTimeout: 8000, ignoreHTTPSErrors: true });
async function send(page, message, count) {
  await page.getByLabel("Mensaje al tutor").fill(message);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText("Respuesta completa", { exact: true }),
  ).toHaveCount(count);
}
async function tutor(page) {
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Enviar", exact: true }),
  ).toBeEnabled();
}

test("recovers a topic conversation and original exercise captures after reload without persisting practice", async ({
  page,
}) => {
  const requests = await setup(page);
  await page.getByLabel("Código Python").fill("# captura original");
  await send(page, "Pregunta original", 1);
  await page.getByRole("tab", { name: "Lección", exact: true }).click();
  await page.getByRole("button", { name: /2\. Un valor que cambia/ }).click();
  await tutor(page);
  await page.getByLabel("Código Python").fill("# otro ejercicio");
  await send(page, "Segunda pregunta", 2);
  await page.reload();
  await enterCourse(page);
  await tutor(page);
  await expect(
    page.getByText("Pregunta original", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Segunda pregunta", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Código Python")).not.toHaveValue(
    "# otro ejercicio",
  );
  expect(requests).toHaveLength(2);
  await send(page, "Después de recargar", 3);
  expect(requests[2].messages.map((m) => m.role)).toEqual([
    "system",
    "user",
    "assistant",
    "user",
    "assistant",
    "user",
  ]);
  expect(JSON.parse(requests[2].messages[1].content).capture).toMatchObject({
    draft: "# captura original",
    exercise: { id: "saludo" },
  });
  expect(JSON.parse(requests[2].messages[3].content).capture).toMatchObject({
    draft: "# otro ejercicio",
    exercise: { id: "cumpleanos" },
  });
  await page.getByRole("button", { name: /02 Expresiones y salida/ }).click();
  await tutor(page);
  await expect(
    page.getByText("Pregunta original", { exact: true }),
  ).toHaveCount(0);
  await send(page, "Tema independiente", 1);
  expect(requests[3].messages).toHaveLength(2);
  await page.getByRole("button", { name: /01 Valores y variables/ }).click();
  await tutor(page);
  await expect(
    page.getByText("Pregunta original", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Tema independiente", { exact: true }),
  ).toHaveCount(0);
});

test("retains fifty exchanges, removes the oldest with notice, and sends only ten complete original pairs", async ({
  page,
}) => {
  test.setTimeout(120000);
  const requests = await setup(page, model, "Respuesta breve");
  await page.getByLabel("Código Python").fill("");
  await page.route("https://openrouter.ai/api/v1/chat/completions", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({
      contentType: "text/event-stream",
      body:
        frame("Respuesta breve", requests.length === 1 ? "length" : "stop") +
        "data: [DONE]\n\n",
    });
  });
  await page.getByLabel("Mensaje al tutor").fill("Pregunta 1");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText("Respuesta breve", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviar", exact: true }),
  ).toBeEnabled();
  for (let index = 2; index <= 50; index++)
    await send(page, `Pregunta ${index}`, index - 1);
  await expect(page.getByText("Pregunta 1", { exact: true })).toBeVisible();
  await send(page, "Pregunta 51", 50);
  await expect(page.getByRole("alert")).toContainText(
    "Se eliminó el intercambio más antiguo",
  );
  await expect(page.getByRole("alert")).toContainText(
    "diez intercambios completos",
  );
  await expect(page.getByText("Pregunta 1", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Pregunta 2", { exact: true })).toBeVisible();
  const users = requests[50].messages
    .filter((item) => item.role === "user")
    .map((item) => JSON.parse(item.content).message);
  expect(users).toEqual([
    "Pregunta 41",
    "Pregunta 42",
    "Pregunta 43",
    "Pregunta 44",
    "Pregunta 45",
    "Pregunta 46",
    "Pregunta 47",
    "Pregunta 48",
    "Pregunta 49",
    "Pregunta 50",
    "Pregunta 51",
  ]);
  await expect(page.getByLabel("Mensaje al tutor")).toHaveValue("");
  await page.reload();
  await enterCourse(page);
  await tutor(page);
  await expect(
    page.getByText("Respuesta completa", { exact: true }),
  ).toHaveCount(50);
  await expect(page.getByText("Pregunta 1", { exact: true })).toHaveCount(0);
  expect(requests).toHaveLength(51);
});

test("recovers streamed partials as interrupted and excludes incomplete pairs from future requests", async ({
  page,
}) => {
  const requests = await setup(page, model, "Respuesta completa anterior");
  await send(page, "Pregunta completa", 1);
  const fixture = await streamingOpenRouter(page);
  try {
    await page.getByLabel("Mensaje al tutor").fill("Pregunta interrumpida");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(() => fixture.responses.length).toBe(1);
    fixture.responses[0].write(frame("Parcial guardado"));
    await expect(
      page.getByText("Parcial guardado", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await enterCourse(page);
    await tutor(page);
    await expect(
      page.getByText("Pregunta interrumpida", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Parcial guardado", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/Respuesta interrumpida al recargar/),
    ).toBeVisible();
    await expect(
      page.getByText("Respuesta completa", { exact: true }),
    ).toHaveCount(1);
    expect(fixture.requests).toHaveLength(1);
    await page.getByLabel("Mensaje al tutor").fill("Pregunta posterior");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(() => fixture.responses.length).toBe(2);
    expect(fixture.requests[1].messages.map((item) => item.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
    expect(fixture.requests[1].messages[1].content).toContain(
      "Pregunta completa",
    );
    expect(JSON.stringify(fixture.requests[1])).not.toContain(
      "Pregunta interrumpida",
    );
    fixture.responses[1].end(frame("Listo", "stop") + "data: [DONE]\n\n");
    await expect(
      page.getByText("Respuesta completa", { exact: true }),
    ).toHaveCount(2);
    expect(requests).toHaveLength(1);
  } finally {
    await fixture.close();
  }
});

for (const finish of ["length", null, "error"])
  test(`keeps ${finish || "unconfirmed"} answers visible locally but excludes the whole pair`, async ({
    page,
  }) => {
    const requests = await setup(page, model, "Parcial de prueba", finish);
    if (finish === "error")
      await page.route(
        "https://openrouter.ai/api/v1/chat/completions",
        (route) => {
          requests.push(route.request().postDataJSON());
          return route.fulfill({
            contentType: "text/event-stream",
            body:
              frame("Parcial de prueba") +
              'data: {"error":{"code":503,"message":"Unavailable"}}\n\ndata: [DONE]\n\n',
          });
        },
      );
    await page.getByLabel("Mensaje al tutor").fill("Pregunta incompleta");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(
      page.getByText("Parcial de prueba", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Enviar", exact: true }),
    ).toBeEnabled();
    await page.reload();
    await enterCourse(page);
    await tutor(page);
    await expect(
      page.getByText("Parcial de prueba", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Mensaje al tutor").fill("Otra pregunta");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1].messages).toHaveLength(2);
    expect(JSON.stringify(requests[1])).not.toContain("Pregunta incompleta");
  });

test("omits oldest complete captures to fit capacity while preserving current and recent content", async ({
  page,
}) => {
  const requests = await setup(
    page,
    { ...model, context_length: 8192 },
    "Respuesta breve",
  );
  await page.getByLabel("Código Python").fill("# original " + "a".repeat(3000));
  await send(page, "Pregunta antigua", 1);
  await page.getByLabel("Código Python").fill("# reciente");
  await send(page, "Pregunta reciente", 2);
  await page.getByLabel("Código Python").fill("# actual");
  await send(page, "Pregunta actual", 3);
  await expect(page.getByRole("alert")).toContainText(
    "por capacidad del modelo",
  );
  expect(requests[2].messages).toHaveLength(4);
  expect(requests[2].messages[1].content).toContain("# reciente");
  expect(requests[2].messages.at(-1).content).toContain("# actual");
  expect(JSON.stringify(requests[2])).not.toContain("Pregunta antigua");
  await expect(
    page.getByText("Pregunta antigua", { exact: true }),
  ).toBeVisible();
});

test("continues with a truthful history warning when real browser storage is full", async ({
  page,
}) => {
  const requests = await setup(page, model, "Respuesta temporal");
  await page.evaluate(() => {
    let filled = "";
    for (let size = 1000000; size >= 1; size = Math.floor(size / 10)) {
      while (true) {
        try {
          localStorage.setItem(
            "unrelated-storage-pressure",
            filled + "x".repeat(size),
          );
          filled += "x".repeat(size);
        } catch {
          break;
        }
      }
    }
  });
  await send(page, "Pregunta sin guardar", 1);
  await expect(page.getByRole("alert")).toContainText(
    "los mensajes no guardados se perderán al recargar",
  );
  await expect(
    page.getByText(
      "Solo en esta sesión. La configuración se perderá al recargar.",
      { exact: true },
    ),
  ).toHaveCount(0);
  await page.reload();
  await enterCourse(page);
  await tutor(page);
  await expect(
    page.getByText("Pregunta sin guardar", { exact: true }),
  ).toHaveCount(0);
  expect(requests).toHaveLength(1);
});

test("migrates existing original learning and conversations while retaining source records", async ({ page }) => {
  await setup(page);
  await send(page, "Mensaje anterior a la migración", 1);
  const legacy = await page.evaluate(() => {
    const id = JSON.stringify(["original", "python-fundamentos"]);
    const prefix = "python-tutor:course-conversations:v1:";
    const key = prefix + encodeURIComponent(id);
    const exchanges = JSON.parse(window.__learnerTest.getItem(key));
    for (const exchange of exchanges) {
      exchange.courseId = "python-fundamentos";
      exchange.capture.course.id = "python-fundamentos";
    }
    const raw = JSON.stringify(exchanges);
    localStorage.removeItem("python-tutor:learner-store:v1");
    localStorage.setItem(prefix + "python-fundamentos", raw);
    localStorage.removeItem(key);
    localStorage.removeItem("python-tutor:course-progress:v1:" + encodeURIComponent(id));
    localStorage.setItem("python-tutor:course-progress:v1:python-fundamentos", JSON.stringify({ topicId: "valores-variables", completed: ["saludo"], assessmentResult: null }));
    return raw;
  });
  await page.reload();
  await enterCourse(page, { path: "Camino a la automatización" });
  await expect(page.getByText("1 / 12 ejercicios", { exact: true })).toBeVisible();
  await tutor(page);
  await expect(page.getByText("Mensaje anterior a la migración", { exact: true })).toBeVisible();
  await send(page, "Continuación compartida", 2);
  await page.reload();
  await enterCourse(page);
  await tutor(page);
  await expect(page.getByText("Continuación compartida", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("python-tutor:course-conversations:v1:python-fundamentos"))).toBe(legacy);
});

test("a temporary legacy conversation read failure cannot mask prior messages", async ({ page }) => {
  await setup(page);
  await send(page, "Conversación anterior", 1);
  await page.evaluate(() => {
    const prefix = "python-tutor:course-conversations:v1:";
    const internal = JSON.stringify(["original", "python-fundamentos"]);
    const key = prefix + encodeURIComponent(internal);
    const saved = JSON.parse(window.__learnerTest.getItem(key));
    for (const item of saved) {
      item.courseId = "python-fundamentos";
      item.capture.course.id = "python-fundamentos";
    }
    localStorage.removeItem("python-tutor:learner-store:v1");
    localStorage.setItem(prefix + "python-fundamentos", JSON.stringify(saved));
    localStorage.removeItem(key);
  });
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key === "python-tutor:course-conversations:v1:python-fundamentos" && !get.call(sessionStorage, "history-read-restored"))
        throw new DOMException("Blocked", "SecurityError");
      return get.call(this, key);
    };
  });
  await page.reload();
  await enterCourse(page);
  await tutor(page);
  await send(page, "Solo en esta sesión", 1);
  await expect(page.getByText(/No se pudo guardar o recuperar el historial/).first()).toBeVisible();
  await page.evaluate(() => sessionStorage.setItem("history-read-restored", "yes"));
  await page.reload();
  await enterCourse(page);
  await tutor(page);
  await expect(page.getByText("Conversación anterior", { exact: true })).toBeVisible();
  await expect(page.getByText("Solo en esta sesión", { exact: true })).toHaveCount(0);
});

test("study and tutor stay separate for original and personal courses with equal local IDs", async ({ page }) => {
  // Model composition at its browser boundary until personal content is available.
  await page.route(/\/src\/CatalogBootstrap\.jsx(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const original = await response.text();
    const marker = "setPublication(composed);";
    expect(original).toContain(marker);
    const source = original.replace(marker, `setPublication(((publication) => {
      const originalId = JSON.stringify(["original", "python-fundamentos"]);
      const personalId = JSON.stringify(["personal", "python-fundamentos"]);
      const course = structuredClone(publication.courses[originalId]);
      course.id = personalId;
      course.title = "Curso personal";
      publication.courses[personalId] = course;
      publication.catalog.courses.push({ ...publication.catalog.courses[0], id: personalId });
      for (const path of publication.catalog.learningPaths) path.courseIds.push(personalId);
      return publication;
    })(composed));`);
    await route.fulfill({ response, body: source });
  });

  const requests = await setup(page);
  await send(page, "Pregunta del original", 1);
  await page.getByRole("tab", { name: "Lección", exact: true }).click();
  await page.getByLabel("Código Python").fill('nombre = "Ada"\nprint("Hola, " + nombre)');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByText("1 / 12 ejercicios", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Todas las rutas", exact: true }).click();
  await enterCourse(page, { course: "Curso personal" });
  await expect(page.getByText("0 / 12 ejercicios", { exact: true })).toBeVisible();
  await tutor(page);
  await expect(page.getByText("Pregunta del original", { exact: true })).toHaveCount(0);
  await send(page, "Pregunta del personal", 1);
  expect(requests[1].messages).toHaveLength(2);

  await page.reload();
  await enterCourse(page, { path: "Camino a la automatización", course: "Curso personal" });
  await expect(page.getByText("0 / 12 ejercicios", { exact: true })).toBeVisible();
  await tutor(page);
  await expect(page.getByText("Pregunta del personal", { exact: true })).toBeVisible();
  await expect(page.getByText("Pregunta del original", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Todas las rutas", exact: true }).click();
  await enterCourse(page, { path: "Camino a la automatización" });
  await expect(page.getByText("1 / 12 ejercicios", { exact: true })).toBeVisible();
  await tutor(page);
  await expect(page.getByText("Pregunta del original", { exact: true })).toBeVisible();
  await expect(page.getByText("Pregunta del personal", { exact: true })).toHaveCount(0);
});
