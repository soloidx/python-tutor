import {
  test,
  expect,
  enterCourse,
  publication,
  serveCatalog,
  updateCourse,
} from "./fixtures/catalog.js";
import { model, setup, frame } from "./fixtures/tutor.js";

test.use({ actionTimeout: 8000, ignoreHTTPSErrors: true });

const historyKey =
  "python-tutor:course-conversations:v1:python-fundamentos";
const legacyCapture = {
  course: { id: "python-fundamentos", title: "Python Fundamentos" },
  topic: {
    id: "valores-variables",
    title: "Valores y variables",
    summary: "Dale un nombre a tus primeras ideas.",
    explanation: ["Una variable guarda un valor."],
    example: "edad = 7",
    takeaway: "El signo = asigna un valor.",
  },
  exercise: {
    id: "ejercicio-retirado",
    title: "Ejercicio retirado",
    prompt: "¿Qué hacía este ejercicio?",
  },
  draft: "# captura histórica",
  lastResult: null,
};
const historicalChoiceCapture = {
  course: legacyCapture.course,
  topic: legacyCapture.topic,
  exercise: {
    id: "choice-retirado-valido",
    title: "Selección histórica",
    prompt: "¿Qué opción era correcta?",
    type: "choice",
    options: [
      { id: "a", text: "La opción A" },
      { id: "b", text: "La opción B" },
    ],
  },
  selectedOptionId: null,
  selectionStatus: "none",
  lastResult: null,
  feedback: null,
};

function mixedPublication(revision = "choice-history") {
  const value = publication(revision);
  updateCourse(value, "python-fundamentos", (course) => {
    const exercise = course.topics[0].exercises[1];
    Object.assign(exercise, {
      type: "choice",
      title: "Interpretar una asignación",
      prompt: "¿Qué hace edad = 7?",
      code: "edad = 7",
      options: [
        { id: "asigna", text: "Guarda 7 en edad" },
        { id: "compara", text: "Compara edad con 7" },
      ],
      answerId: "asigna",
      retry: "Piensa en lo que hace el signo igual.",
      explanation: "El signo = asigna el valor 7 a edad.",
    });
    delete exercise.starter;
    delete exercise.check;
    delete exercise.success;
  });
  return value;
}

function oversizedChoicePublication() {
  const value = mixedPublication("choice-budget");
  updateCourse(value, "python-fundamentos", (course) => {
    const exercise = course.topics[0].exercises[1];
    exercise.code = "x = 1\n" + "# fragmento ".repeat(300);
    exercise.options = [
      { id: "asigna", text: "Guarda un valor " + "a".repeat(3000) },
      { id: "compara", text: "Compara valores " + "b".repeat(3000) },
    ];
  });
  return value;
}

test("recovers legacy code and quarantines an invalid mixed choice capture", async ({
  page,
}) => {
  const original = JSON.stringify([
    {
      id: "legacy-valid",
      courseId: "python-fundamentos",
      topicId: "valores-variables",
      message: "Pregunta histórica válida",
      capture: legacyCapture,
      attempts: [{ id: "legacy-answer", text: "Respuesta histórica", status: "complete" }],
    },
    {
      id: "invalid-choice",
      courseId: "python-fundamentos",
      topicId: "valores-variables",
      message: "Pregunta inválida",
      capture: {
        ...legacyCapture,
        exercise: {
          id: "choice-retirado",
          title: "Selección inválida",
          prompt: "¿Cuál opción?",
          type: "choice",
          options: [
            { id: "a", text: "A" },
            { id: "b", text: "B" },
          ],
          answerId: "a",
        },
        draft: "debería estar prohibido",
        selectedOptionId: "missing",
        selectionStatus: "checked",
        lastResult: { optionId: "missing", correct: true },
        feedback: "Respuesta oculta",
      },
      attempts: [{ id: "invalid-answer", text: "No enviar", status: "complete" }],
    },
    {
      id: "historical-choice",
      courseId: "python-fundamentos",
      topicId: "valores-variables",
      message: "Pregunta histórica de selección",
      capture: historicalChoiceCapture,
      attempts: [{ id: "choice-answer", text: "Respuesta de selección", status: "complete" }],
    },
  ]);
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: historyKey, value: original },
  );

  const requests = await setup(page);
  await expect(page.getByRole("alert")).toContainText(/recuperación parcial/i);
  await expect(page.getByText("Pregunta histórica válida", { exact: true })).toBeVisible();
  await expect(page.getByText("Pregunta histórica de selección", { exact: true })).toBeVisible();
  await expect(page.getByText("Pregunta inválida", { exact: true })).toHaveCount(0);

  await page.getByLabel("Mensaje al tutor").fill("Usa el historial válido");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Respuesta completa", { exact: true })).toHaveCount(3);

  expect(requests[0].messages.map((item) => item.role)).toEqual([
    "system",
    "user",
    "assistant",
    "user",
    "assistant",
    "user",
  ]);
  expect(requests[0].messages[1].content).toContain("Pregunta histórica válida");
  expect(requests[0].messages[3].content).toContain("Pregunta histórica de selección");
  expect(JSON.stringify(requests[0])).not.toContain("Pregunta inválida");
  expect(
    await page.evaluate((prefix) =>
      Object.keys(localStorage)
        .filter((key) => key.startsWith(prefix))
        .map((key) => localStorage.getItem(key)),
      "python-tutor:recovery:v1:python-fundamentos:",
    ),
  ).toContain(original);
});

test("retries an immutable choice capture after changing the attempt and reloading", async ({
  page,
  context,
}) => {
  await serveCatalog(context, mixedPublication());
  const requests = await setup(page, model, "Respuesta parcial", "length");
  await page.getByRole("tab", { name: "Lección", exact: true }).click();
  const practice = page.getByLabel("Espacio de práctica");
  await practice
    .getByRole("button", { name: /2\. Interpretar una asignación/ })
    .click();
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();

  await practice.getByLabel("Compara edad con 7").check();
  await practice.getByRole("button", { name: "Comprobar", exact: true }).click();
  await page.getByLabel("Mensaje al tutor").fill("Ayúdame con esta selección");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText(/límite de salida/)).toBeVisible();
  const originalRequest = structuredClone(requests[0]);
  expect(JSON.parse(originalRequest.messages.at(-1).content).capture).toMatchObject({
    selectedOptionId: "compara",
    selectionStatus: "checked",
    lastResult: { optionId: "compara", correct: false },
  });

  await practice.getByLabel("Guarda 7 en edad").check();
  await page.reload();
  await enterCourse(page);
  await page.getByRole("tab", { name: "Lección", exact: true }).click();
  await page
    .getByRole("button", { name: /2\. Interpretar una asignación/ })
    .click();
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await page.route("https://openrouter.ai/api/v1/chat/completions", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({
      contentType: "text/event-stream",
      body: frame("Respuesta recuperada") + frame("", "stop") + "data: [DONE]\n\n",
    });
  });
  await page.getByRole("button", { name: "Reintentar respuesta", exact: true }).click();
  await expect(page.getByText("Respuesta recuperada", { exact: true })).toBeVisible();
  expect(requests[1]).toEqual(originalRequest);
  await expect(page.getByText("Respuesta parcial", { exact: true })).toBeVisible();
});

test("blocks a choice capture whose fixed serialized content exceeds the model", async ({
  page,
  context,
}) => {
  await serveCatalog(context, oversizedChoicePublication());
  const requests = await setup(page, { ...model, context_length: 3000 });
  await page.getByRole("tab", { name: "Lección", exact: true }).click();
  await page
    .getByLabel("Espacio de práctica")
    .getByRole("button", { name: /2\. Interpretar una asignación/ })
    .click();
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await page.getByLabel("Mensaje al tutor").fill("Ayuda");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/contenido fijo/);
  await expect(page.getByRole("alert")).not.toContainText(/borrador/);
  expect(requests).toHaveLength(0);
});
