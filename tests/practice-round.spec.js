import {
  test,
  expect,
  publication,
  serveCatalog,
  updateCourse,
  enterCourse,
} from "./fixtures/catalog.js";

function practicePublication(count = 3) {
  const value = publication("practice-round");
  updateCourse(value, "python-fundamentos", (course) => {
    const code = course.topics[0].exercises[0];
    course.topics = [
      {
        ...course.topics[0],
        exercises: Array.from({ length: count }, (_, i) => ({
          ...structuredClone(code),
          id: `exercise-${i}`,
          title: `Actividad ${i + 1}`,
        })),
      },
    ];
  });
  // Same canonical IDs across another active course must collapse.
  const first = JSON.parse(value.files[value.catalog.courses[0].file]);
  updateCourse(value, "python-practica", (course) => {
    course.topics = structuredClone(first.topics);
    course.topics[0].exercises.forEach((exercise) => {
      exercise.title = `Referencia ${exercise.id}`;
    });
  });
  return value;
}

async function openPractice(page, context, value) {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await serveCatalog(context, value);
  await page.goto("/");
  await page.getByRole("button", { name: "Práctica", exact: true }).click();
}

test("draws canonical exercise IDs once and retains order and drafts across navigation", async ({
  page,
  context,
}) => {
  await openPractice(page, context, practicePublication());
  await expect(
    page.getByRole("button", { name: "Práctica", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  const rail = page.getByRole("navigation", { name: "Ejercicios de la ronda" });
  await expect(rail.getByRole("button")).toHaveCount(3);
  const order = await rail.getByRole("button").allTextContents();
  expect(order.join(" ")).not.toContain("Referencia");
  await page.getByLabel("Código Python").fill('nombre = "Borrador"');
  await rail.getByRole("button").nth(1).click();
  await rail.getByRole("button").nth(0).click();
  await expect(page.getByLabel("Código Python")).toHaveValue(
    'nombre = "Borrador"',
  );
  await expect(rail.getByRole("button").nth(0)).toContainText("En progreso");
  await page
    .getByRole("button", { name: "Cursos y rutas", exact: true })
    .click();
  await page.getByRole("button", { name: "Práctica", exact: true }).click();
  expect(await rail.getByRole("button").allTextContents()).toEqual(
    order.map((text, i) =>
      i === 0 ? text.replace("Pendiente", "En progreso") : text,
    ),
  );
  await expect(page.getByLabel("Código Python")).toHaveValue(
    'nombre = "Borrador"',
  );
  await expect(page.getByText("El tutor no está configurado.")).toBeVisible();
  await page
    .getByRole("button", { name: "Configurar tutor", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("switching exercises cancels a run and ignores its late worker result", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    window.Worker = class {
      constructor() {
        setTimeout(() => this.onmessage?.({ data: { type: "ready" } }), 0);
      }
      postMessage() {
        setTimeout(
          () =>
            this.onmessage?.({
              data: { type: "result", passed: true, output: "late" },
            }),
          300,
        );
      }
      // Deliberately deliver an already queued event after termination.
      terminate() {}
    };
  });
  await openPractice(page, context, practicePublication(2));
  const rail = page.getByRole("navigation", { name: "Ejercicios de la ronda" });
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await rail.getByRole("button").nth(1).click();
  await page.waitForTimeout(400);
  await expect(page.getByLabel("Salida del programa")).not.toHaveText("late");
  await expect(page.getByLabel("Progreso de la ronda")).toHaveAttribute(
    "value",
    "0",
  );
  await rail.getByRole("button").nth(0).click();
  await expect(page.getByLabel("Salida del programa")).not.toHaveText("late");
});

function mixedRound() {
  const value = practicePublication(2);
  updateCourse(value, "python-fundamentos", (course) => {
    const code = course.topics[0].exercises[0];
    course.topics[0].exercises[1] = {
      id: "exercise-1",
      type: "choice",
      title: "Interpretar una asignación",
      prompt: "¿Qué hace edad = 7?",
      code: "edad = 7",
      options: [
        { id: "assign", text: "Guarda 7 en edad" },
        {
          id: "compare",
          text: "Compara edad con 7",
          retry: "Busca el operador de comparación.",
        },
      ],
      answerId: "assign",
      explanation: "El signo igual asigna un valor.",
      retry: "Vuelve a intentarlo.",
      hints: ["Piensa en el signo igual."],
    };
  });
  return value;
}

test("reload restores mixed partial work, selected exercise, order and visible feedback", async ({
  page,
  context,
}) => {
  await openPractice(page, context, mixedRound());
  const rail = page.getByRole("navigation", { name: "Ejercicios de la ronda" });
  const titles = await rail.locator("strong").allTextContents();
  await page.getByRole("button", { name: "Dame una pista" }).click();
  await page.getByLabel("Compara edad con 7").check();
  await page.getByRole("button", { name: "Comprobar", exact: true }).click();
  await rail.getByRole("button").nth(1).click();
  await page.getByLabel("Código Python").fill('nombre = "Guardado"');
  // A fresh draw would select a different first exercise. Reload must restore.
  await page.addInitScript(() => {
    Math.random = () => 0.999;
  });
  await page.reload();
  await page.getByRole("button", { name: "Práctica", exact: true }).click();
  expect(await rail.locator("strong").allTextContents()).toEqual(titles);
  await expect(rail.getByRole("button").nth(1)).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(page.getByLabel("Código Python")).toHaveValue(
    'nombre = "Guardado"',
  );
  await expect(rail.getByRole("button").nth(1)).toContainText("En progreso");
  await rail.getByRole("button").nth(0).click();
  await expect(page.getByLabel("Compara edad con 7")).toBeChecked();
  await expect(page.getByRole("status").first()).toContainText(
    "Busca el operador de comparación.",
  );
  await expect(page.getByRole("region", { name: "Pistas" })).toContainText(
    "Piensa en el signo igual.",
  );
  await expect(
    page.getByText("Ronda guardada", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Guarda 7 en edad").check();
  await page.reload();
  await page.getByRole("button", { name: "Práctica", exact: true }).click();
  await expect(page.getByLabel("Guarda 7 en edad")).toBeChecked();
  await expect(page.getByRole("status").first()).toContainText(
    "Elige una opción para comprobar tu respuesta.",
  );
  await expect(page.getByLabel("Progreso de la ronda")).toHaveAttribute(
    "value",
    "0",
  );
});

for (const mobile of [false, true])
  test(`resolves both formats independently and retains completed review${mobile ? " on mobile" : " on desktop"}`, async ({
    page,
    context,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await openPractice(page, context, mixedRound());
    const rail = page.getByRole("navigation", {
      name: "Ejercicios de la ronda",
    });
    const workspace = page.getByRole("region", {
      name: "Ejercicio de la ronda",
      exact: true,
    });
    await page.getByRole("button", { name: "Dame una pista" }).click();
    await expect(page.getByRole("region", { name: "Pistas" })).toContainText(
      "Piensa en el signo igual.",
    );
    await page.getByLabel("Compara edad con 7").check();
    await page.getByRole("button", { name: "Comprobar", exact: true }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Busca el operador de comparación.",
    );
    await page.getByLabel("Guarda 7 en edad").check();
    const railBox = await rail.boundingBox();
    const workspaceBox = await workspace.boundingBox();
    if (mobile)
      expect(railBox.y).toBeGreaterThan(
        workspaceBox.y + workspaceBox.height - 1,
      );
    else expect(railBox.x + railBox.width).toBeLessThan(workspaceBox.x);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `/tmp/python-tutor-spec64/practice-${mobile ? "mobile" : "desktop"}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(mobile ? 390 : 1280);
    await page.getByRole("button", { name: "Comprobar", exact: true }).click();
    await expect(rail.getByRole("button").nth(0)).toContainText("Resuelto");
    await rail.getByRole("button").nth(1).click();
    await page
      .getByLabel("Código Python")
      .fill('nombre = "Ada"\nprint("Hola, " + nombre)');
    await expect(
      page.getByRole("button", { name: "Ejecutar", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Ronda completada", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Progreso de la ronda")).toHaveAttribute(
      "value",
      "2",
    );
    await page.reload();
    await page.getByRole("button", { name: "Práctica", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Ronda completada", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Progreso de la ronda")).toHaveAttribute(
      "value",
      "2",
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `/tmp/python-tutor-spec64/practice-completed-${mobile ? "mobile" : "desktop"}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Cursos y rutas", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Explorar Primeros pasos con Python",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("article").filter({
        has: page.getByRole("heading", {
          name: "Python Fundamentos",
          exact: true,
        }),
      }),
    ).toContainText("0 / 2 ejercicios aprobados");
    await page.getByRole("button", { name: "Práctica", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Ronda completada", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Revisar ejercicios", exact: true })
      .click();
    await expect(page.getByLabel("Salida del programa")).toHaveText(
      "Hola, Ada",
    );
    await expect(
      page.getByText("Revisión del catálogo: practice-round", { exact: false }),
    ).toBeVisible();
    await rail.getByRole("button").nth(0).click();
    await expect(page.getByLabel("Guarda 7 en edad")).toBeChecked();
    await expect(page.getByRole("status").first()).toContainText(
      "El signo igual asigna un valor.",
    );
    await page
      .getByRole("button", { name: "Nueva ronda", exact: true })
      .click();
    await expect(page.getByLabel("Progreso de la ronda")).toHaveAttribute(
      "value",
      "0",
    );
    await expect(page.getByLabel("Guarda 7 en edad")).not.toBeChecked();
    await expect(page.getByRole("region", { name: "Pistas" })).toHaveCount(0);
    await page.reload();
    await page.getByRole("button", { name: "Práctica", exact: true }).click();
    await expect(page.getByLabel("Progreso de la ronda")).toHaveAttribute(
      "value",
      "0",
    );
    await expect(page.getByLabel("Guarda 7 en edad")).not.toBeChecked();
  });

for (const count of [1, 10, 14])
  test(`draws without replacement from ${count} eligible canonical exercises`, async ({
    page,
    context,
  }) => {
    const value = practicePublication(count);
    // Unlisted course documents and final assessments are not eligible.
    const orphan = JSON.parse(value.files[value.catalog.courses[1].file]);
    orphan.topics[0].exercises[0].id = "unpublished";
    orphan.topics[0].exercises[0].title = "No publicado";
    value.files["courses/inactive.json"] = JSON.stringify(orphan);
    await openPractice(page, context, value);
    const entries = page
      .getByRole("navigation", { name: "Ejercicios de la ronda" })
      .getByRole("button");
    await expect(entries).toHaveCount(Math.min(10, count));
    const titles = await entries.locator("strong").allTextContents();
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles).toEqual(
      count === 1
        ? ["Actividad 1"]
        : count === 10
          ? [
              "Actividad 2",
              "Actividad 3",
              "Actividad 4",
              "Actividad 5",
              "Actividad 6",
              "Actividad 7",
              "Actividad 8",
              "Actividad 9",
              "Actividad 10",
              "Actividad 1",
            ]
          : [
              "Actividad 2",
              "Actividad 3",
              "Actividad 4",
              "Actividad 5",
              "Actividad 6",
              "Actividad 7",
              "Actividad 8",
              "Actividad 9",
              "Actividad 10",
              "Actividad 11",
            ],
    );
    await expect(page.getByText("No publicado", { exact: true })).toHaveCount(
      0,
    );
  });

test("different canonical IDs remain distinct even with identical displayed content", async ({
  page,
  context,
}) => {
  const value = practicePublication(2);
  updateCourse(value, "python-practica", (course) => {
    const sameContent = structuredClone(course.topics[0].exercises[0]);
    sameContent.id = "distinct-exercise";
    sameContent.title = "Actividad 1";
    course.topics[0].exercises.push(sameContent);
  });
  await openPractice(page, context, value);
  const rail = page.getByRole("navigation", { name: "Ejercicios de la ronda" });
  await expect(rail.getByRole("button")).toHaveCount(3);
  await expect(rail.locator("strong", { hasText: "Actividad 1" })).toHaveCount(
    2,
  );
});

test("new rounds honor the configured code limit and controlled random draw", async ({
  page,
  context,
}) => {
  await page.route("**/src/practiceRound.js", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        "PRACTICE_ROUND_LIMIT = 10",
        "PRACTICE_ROUND_LIMIT = 2",
      ),
    });
  });
  await openPractice(page, context, practicePublication(4));
  const entries = page
    .getByRole("navigation", { name: "Ejercicios de la ronda" })
    .getByRole("button");
  await expect(entries).toHaveCount(2);
  expect(await entries.locator("strong").allTextContents()).toEqual([
    "Actividad 2",
    "Actividad 3",
  ]);
  await page.evaluate(() => {
    Math.random = () => 0.999;
  });
  await page.getByRole("button", { name: "Nueva ronda", exact: true }).click();
  expect(await entries.locator("strong").allTextContents()).toEqual([
    "Actividad 1",
    "Actividad 2",
  ]);
});

// Valid publications currently require nonempty courses/topics/exercises. Mount
// the real public App in the browser to exercise its defensive empty state;
// this neither relaxes the catalog contract nor adds a production testing API.
test("empty practice offers Courses on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/src/main.jsx", async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    body = body.replace(
      'import CatalogBootstrap from "/src/CatalogBootstrap.jsx"',
      'import App from "/src/App.jsx"',
    );
    body = body.replace(
      "React.createElement(CatalogBootstrap, null)",
      'React.createElement(App, { publication: { catalog: { revision: "empty", courses: [], learningPaths: [] }, courses: {} } })',
    );
    await route.fulfill({ response, body });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Práctica", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Aún no hay ejercicios para practicar",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "/tmp/python-tutor-spec64/practice-empty-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Ir a Cursos", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Cursos y rutas de aprendizaje",
      exact: true,
    }),
  ).toBeVisible();
});

// localStorage is the external persistence boundary: inspect only what the app
// writes, never inject or call the internal serializer to manufacture the result.
test("practice saves visible work without authored answers or making course drafts persistent", async ({
  page,
  context,
}) => {
  await openPractice(page, context, mixedRound());
  await page.getByRole("button", { name: "Dame una pista" }).click();
  await page.getByLabel("Compara edad con 7").check();
  await page.getByRole("button", { name: "Comprobar", exact: true }).click();
  const record = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("python-tutor:practice:v1")),
  );
  const serialized = JSON.stringify(record);
  for (const secret of [
    '"answerId"',
    '"check"',
    '"hints"',
    '"retry"',
    '"success"',
    "Piensa en el signo igual.",
    "El signo igual asigna un valor.",
  ])
    expect(serialized).not.toContain(secret);
  expect(record.entries[0].snapshot.exercise).not.toHaveProperty("explanation");
  expect(record.entries[0].snapshot.topic.explanation).toHaveLength(3);
  expect(record.entries[0].snapshot.exercise.options).toEqual([
    { id: "assign", text: "Guarda 7 en edad" },
    { id: "compare", text: "Compara edad con 7" },
  ]);
  expect(record.entries[0].work.selectionFeedback).toBe(
    "Busca el operador de comparación.",
  );
  await page
    .getByRole("button", { name: "Cursos y rutas", exact: true })
    .click();
  await enterCourse(page);
  await page.getByLabel("Código Python").fill('nombre = "Solo curso"');
  await page.reload();
  await enterCourse(page);
  await expect(page.getByLabel("Código Python")).not.toHaveValue(
    'nombre = "Solo curso"',
  );
  await page.getByRole("button", { name: "Práctica", exact: true }).click();
  await expect(page.getByLabel("Compara edad con 7")).toBeChecked();
  await expect(page.getByLabel("Progreso de la ronda")).toHaveAttribute(
    "value",
    "0",
  );
});
