import {
  test,
  expect,
  enterCourse,
  publication,
  serveCatalog,
  updateCourse,
} from "./fixtures/catalog.js";
import { setup } from "./fixtures/tutor.js";

function mixedPublication(revision = "choice-1", change = () => {}) {
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
        {
          id: "compara",
          text: "Compara edad con 7",
          retry: "Busca el operador que compara valores.",
        },
        { id: "imprime", text: "Muestra 7 en pantalla" },
      ],
      answerId: "asigna",
      retry: "Piensa en lo que hace el signo igual en Python.",
      explanation: "El signo = asigna el valor 7 a la variable edad.",
    });
    delete exercise.starter;
    delete exercise.check;
    delete exercise.success;
    change(exercise);
  });
  return value;
}

for (const [name, change, reason] of [
  [
    "unknown type",
    (exercise) => {
      exercise.type = "quiz";
    },
    "desconocido",
  ],
  [
    "null type",
    (exercise) => {
      exercise.type = null;
    },
    "desconocido",
  ],
  [
    "one option",
    (exercise) => {
      exercise.options.length = 1;
    },
    "dos opciones",
  ],
  [
    "duplicate option IDs",
    (exercise) => {
      exercise.options[1].id = exercise.options[0].id;
    },
    "duplicados",
  ],
  [
    "missing answer",
    (exercise) => {
      exercise.answerId = "missing";
    },
    "answerId",
  ],
  [
    "empty fragment",
    (exercise) => {
      exercise.code = "";
    },
    "exercise.code",
  ],
  [
    "retry on correct option",
    (exercise) => {
      exercise.options[0].retry = "No.";
    },
    "correcta",
  ],
  [
    "crossed code field",
    (exercise) => {
      exercise.check = "False";
    },
    "no es válido",
  ],
])
  test(`rejects the complete publication: choice ${name}`, async ({
    page,
    context,
  }) => {
    await serveCatalog(
      context,
      mixedPublication(`choice-invalid-${name.replaceAll(" ", "-")}`, change),
    );
    await page.goto("/");
    await expect(page.getByRole("alert")).toContainText(reason);
    await expect(page.getByRole("button", { name: /Explorar/ })).toHaveCount(0);
  });

test("keeps the previous complete backup when a mixed update is invalid", async ({
  page,
  context,
}) => {
  await serveCatalog(context, mixedPublication("choice-backup-1"));
  await page.goto("/");
  await enterCourse(page);
  await expect(
    page.getByRole("button", { name: /2\. Interpretar una asignación/ }),
  ).toBeVisible();

  await serveCatalog(
    context,
    mixedPublication("choice-backup-2", (exercise) => {
      exercise.options.length = 1;
    }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("dos opciones");
  await expect(
    page.getByRole("button", { name: /Explorar Primeros pasos con Python/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /2\. Interpretar una asignación/ }),
  ).toHaveCount(0);
});

test("loads a mixed publication and presents a choice exercise", async ({
  page,
  context,
}) => {
  await serveCatalog(context, mixedPublication());
  await page.goto("/");
  await enterCourse(page);

  const practice = page.getByLabel("Espacio de práctica");
  await practice
    .getByRole("button", { name: /2\. Interpretar una asignación/ })
    .click();

  await expect(
    practice.getByRole("heading", {
      name: "Interpretar una asignación",
      exact: true,
    }),
  ).toBeVisible();
  await expect(practice.getByRole("radio")).toHaveCount(3);
  await expect(
    practice.getByRole("button", { name: "Comprobar", exact: true }),
  ).toBeDisabled();
  await expect(practice.getByLabel("Código Python")).toHaveCount(0);
  await expect(practice.getByText("edad = 7", { exact: true })).toBeVisible();
});

test("choice controls support keyboard navigation and announce an accessible result", async ({
  page,
  context,
}) => {
  await serveCatalog(context, mixedPublication("choice-accessibility"));
  await page.goto("/");
  await enterCourse(page);

  const lessonTab = page.getByRole("tab", { name: "Lección", exact: true });
  const tutorTab = page.getByRole("tab", { name: "Tutor", exact: true });
  await lessonTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(tutorTab).toBeFocused();
  await expect(tutorTab).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(lessonTab).toBeFocused();
  await expect(lessonTab).toHaveAttribute("aria-selected", "true");

  const practice = page.getByLabel("Espacio de práctica");
  await practice
    .getByRole("button", { name: /2\. Interpretar una asignación/ })
    .click();
  const choices = practice.getByRole("radio");
  await expect(
    practice.getByRole("group", { name: "Elige una opción" }),
  ).toBeVisible();
  await expect(choices.nth(0)).toHaveAccessibleName("Guarda 7 en edad");
  await expect(choices.nth(1)).toHaveAccessibleName("Compara edad con 7");

  await choices.nth(0).focus();
  await expect(choices.nth(0)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(choices.nth(1)).toBeChecked();
  await expect(choices.nth(1)).toBeFocused();

  const check = practice.getByRole("button", {
    name: "Comprobar",
    exact: true,
  });
  await page.keyboard.press("Tab");
  await expect(check).toBeFocused();
  await page.keyboard.press("Enter");

  const feedback = practice.locator(".choice-feedback");
  await expect(feedback).toHaveAttribute("role", "status");
  await expect(feedback).toHaveAttribute("aria-live", "polite");
  await expect(feedback).toHaveAttribute("aria-atomic", "true");
  await expect(feedback).toContainText(
    "Busca el operador que compara valores.",
  );
});

test("checks one choice at a time and keeps approval separate from feedback", async ({
  page,
  context,
}) => {
  await serveCatalog(context, mixedPublication("choice-feedback"));
  await page.goto("/");
  await enterCourse(page);
  const practice = page.getByLabel("Espacio de práctica");
  await practice
    .getByRole("button", { name: /2\. Interpretar una asignación/ })
    .click();

  await practice.getByLabel("Compara edad con 7").check();
  await practice
    .getByRole("button", { name: "Comprobar", exact: true })
    .click();
  await expect(practice.locator(".choice-feedback")).toContainText(
    "Busca el operador que compara valores.",
  );
  await expect(practice.locator(".choice-feedback")).not.toContainText(
    "El signo = asigna el valor 7",
  );

  await practice.getByLabel("Guarda 7 en edad").check();
  await expect(practice.locator(".choice-feedback")).toContainText(
    "Elige una opción para comprobar tu respuesta.",
  );
  await practice
    .getByRole("button", { name: "Comprobar", exact: true })
    .click();
  await expect(practice.locator(".choice-feedback")).toContainText(
    "El signo = asigna el valor 7 a la variable edad.",
  );
  await expect(practice).toContainText("Ejercicio aprobado");
  await expect(practice).toContainText("1 de 2 ejercicios completados");

  await practice.getByLabel("Compara edad con 7").check();
  await practice
    .getByRole("button", { name: "Comprobar", exact: true })
    .click();
  await expect(practice.locator(".choice-feedback")).toContainText(
    "Busca el operador que compara valores.",
  );
  await expect(practice).toContainText("Ejercicio aprobado");

  await page.reload();
  await enterCourse(page);
  const reloadedPractice = page.getByLabel("Espacio de práctica");
  await reloadedPractice
    .getByRole("button", { name: /2\. Interpretar una asignación/ })
    .click();
  await expect(reloadedPractice.getByRole("radio")).toHaveCount(3);
  await expect(reloadedPractice.getByRole("radio").nth(0)).not.toBeChecked();
  await expect(
    reloadedPractice.getByRole("button", { name: "Comprobar", exact: true }),
  ).toBeDisabled();
  await expect(reloadedPractice.locator(".choice-feedback")).toContainText(
    "Elige una opción para comprobar tu respuesta.",
  );
  await expect(reloadedPractice).toContainText("Ejercicio aprobado");
});

test("choice practice remains usable on a narrow screen without Python controls", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    class FailedWorker {
      constructor() {
        setTimeout(() => this.onerror?.(), 0);
      }
      terminate() {}
      postMessage() {}
    }
    window.Worker = FailedWorker;
  });
  await serveCatalog(context, mixedPublication("choice-mobile"));
  await page.goto("/");
  await enterCourse(page);
  const practice = page.getByLabel("Espacio de práctica");
  await practice
    .getByRole("button", { name: /2\. Interpretar una asignación/ })
    .click();
  await practice.getByLabel("Guarda 7 en edad").check();
  await expect(
    practice.getByRole("button", { name: "Comprobar", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await expect(practice.locator("legend")).toHaveText("Elige una opción");
});

test("sends an allowlisted choice capture for checked and pending attempts", async ({
  page,
  context,
}) => {
  await serveCatalog(context, mixedPublication("choice-capture"));
  const requests = await setup(page);
  await page.getByRole("tab", { name: "Lección", exact: true }).click();
  const practice = page.getByLabel("Espacio de práctica");
  await practice
    .getByRole("button", { name: /2\. Interpretar una asignación/ })
    .click();
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();

  await practice.getByLabel("Compara edad con 7").check();
  await practice
    .getByRole("button", { name: "Comprobar", exact: true })
    .click();
  await page.getByLabel("Mensaje al tutor").fill("No entiendo");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText("Respuesta completa", { exact: true }),
  ).toHaveCount(1);
  const checked = JSON.parse(requests[0].messages.at(-1).content);
  expect(checked.capture).toMatchObject({
    exercise: {
      id: "cumpleanos",
      type: "choice",
      code: "edad = 7",
      options: [
        { id: "asigna", text: "Guarda 7 en edad" },
        { id: "compara", text: "Compara edad con 7" },
        { id: "imprime", text: "Muestra 7 en pantalla" },
      ],
    },
    selectedOptionId: "compara",
    selectionStatus: "checked",
    lastResult: { optionId: "compara", correct: false },
    feedback: "Busca el operador que compara valores.",
  });
  expect(JSON.stringify(checked.capture.exercise)).not.toContain("answerId");
  expect(JSON.stringify(checked.capture.exercise)).not.toContain("retry");
  expect(JSON.stringify(checked.capture.exercise)).not.toContain("explanation");
  expect(checked.capture.draft).toBeUndefined();

  await practice.getByLabel("Muestra 7 en pantalla").check();
  await expect(practice.locator(".choice-feedback")).toContainText(
    "Elige una opción para comprobar tu respuesta.",
  );
  await page.getByLabel("Mensaje al tutor").fill("Dame una pista");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText("Respuesta completa", { exact: true }),
  ).toHaveCount(2);
  const pending = JSON.parse(requests[1].messages.at(-1).content);
  expect(pending.capture).toMatchObject({
    selectedOptionId: "imprime",
    selectionStatus: "pending",
    lastResult: { optionId: "compara", correct: false },
    feedback: null,
  });
  expect(JSON.stringify(pending.capture)).not.toContain("answerId");
});

test("choice hints and fallback feedback work without a tutor while course drafts stay temporary", async ({
  page,
  context,
}) => {
  await serveCatalog(
    context,
    mixedPublication("choice-hints", (exercise) => {
      delete exercise.code;
      exercise.hints = [
        "Recuerda la asignación.",
        "El signo igual guarda valores.",
      ];
    }),
  );
  await page.goto("/");
  await enterCourse(page);
  const practice = page.getByLabel("Espacio de práctica");
  await practice
    .getByLabel("Código Python")
    .fill('nombre = "Borrador temporal"');
  await practice
    .getByRole("button", { name: /2\. Interpretar una asignación/ })
    .click();
  await expect(
    practice.getByLabel("Fragmento de código de solo lectura"),
  ).toHaveCount(0);
  await practice.getByRole("button", { name: "Dame una pista" }).click();
  await expect(practice.getByRole("region", { name: "Pistas" })).toContainText(
    "Recuerda la asignación.",
  );
  await practice.getByRole("button", { name: "Otra pista" }).click();
  await expect(practice.getByRole("region", { name: "Pistas" })).toContainText(
    "El signo igual guarda valores.",
  );
  await practice.getByLabel("Muestra 7 en pantalla").check();
  await practice
    .getByRole("button", { name: "Comprobar", exact: true })
    .click();
  await expect(practice.getByRole("status")).toContainText(
    "Piensa en lo que hace el signo igual en Python.",
  );
  await expect(practice).toContainText("0 de 2 ejercicios completados");
  await practice
    .getByRole("button", { name: /1\. Tu primera variable/ })
    .click();
  await expect(practice.getByLabel("Código Python")).not.toHaveValue(
    /Borrador temporal/,
  );
  await practice
    .getByLabel("Código Python")
    .fill('nombre = "Ada"\nprint("Hola, " + nombre)');
  await practice.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(practice.getByLabel("Salida del programa")).toHaveText(
    "Hola, Ada",
  );
  await expect(practice.getByRole("status")).toContainText("¡Correcto!");
  await page.reload();
  await enterCourse(page);
  await expect(practice.getByLabel("Código Python")).not.toHaveValue(
    'nombre = "Ada"\nprint("Hola, " + nombre)',
  );
  await expect(practice).toContainText("1 de 2 ejercicios completados");
});
