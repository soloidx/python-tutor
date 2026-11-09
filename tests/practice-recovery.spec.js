import {
  test,
  expect,
  publication,
  updateCourse,
  serveCatalog,
} from "./fixtures/catalog.js";

const key = "python-tutor:practice:v1";
function single(revision, id = "original") {
  const value = publication(revision);
  for (const courseId of ["python-fundamentos", "python-practica"]) {
    updateCourse(value, courseId, (course) => {
      course.topics = [course.topics[0]];
      course.topics[0].exercises = [
        {
          id,
          type: "choice",
          title: `Pregunta ${id}`,
          prompt: "Elige siete.",
          code: "edad = 7",
          options: [
            { id: "seven", text: "Siete" },
            { id: "eight", text: "Ocho" },
          ],
          answerId: "seven",
          explanation: "Siete es el valor.",
          retry: "Intenta de nuevo.",
          hints: ["Lee el número."],
        },
      ];
    });
  }
  return value;
}
async function open(page, context, value) {
  await serveCatalog(context, value);
  await page.goto("/");
  await page.getByRole("button", { name: "Práctica", exact: true }).click();
}
async function activate(page, context, value) {
  await serveCatalog(context, value);
  await page.reload();
  await page
    .getByRole("button", { name: "Recargar para actualizar", exact: true })
    .click();
  await page.getByRole("button", { name: "Práctica", exact: true }).click();
}

test("new publication replaces the entire incomplete round and explains recovery", async ({
  page,
  context,
}) => {
  await open(page, context, single("recovery-one"));
  await page.getByLabel("Ocho", { exact: true }).check();
  await page.getByRole("button", { name: "Comprobar", exact: true }).click();
  await activate(page, context, single("recovery-two", "new"));
  await expect(page.getByRole("alert")).toContainText("El catálogo cambió");
  await expect(
    page.getByRole("heading", { name: "Pregunta new", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Ocho", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("Progreso de la ronda")).toHaveAttribute(
    "value",
    "0",
  );
});

for (const mobile of [false, true])
  test(`completed round keeps original revision and safe review after removal ${mobile ? "mobile" : "desktop"}`, async ({
    page,
    context,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await open(page, context, single("archive-one"));
    await page.getByLabel("Siete", { exact: true }).check();
    await page.getByRole("button", { name: "Comprobar", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Ronda completada", exact: true }),
    ).toBeVisible();
    await activate(page, context, single("archive-two", "replacement"));
    await expect(
      page.getByRole("heading", { name: "Ronda completada", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Revisar ejercicios", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Pregunta original", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Revisión del catálogo: archive-one", { exact: false }),
    ).toBeVisible();
    await expect(page.getByLabel("Siete", { exact: true })).toBeChecked();
    await expect(page.getByLabel("Siete", { exact: true })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Comprobar", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Siete es el valor.", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `/tmp/python-tutor-spec64/practice-archived-${mobile ? "mobile" : "desktop"}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(mobile ? 390 : 1280);
    await page.reload();
    await page.getByRole("button", { name: "Práctica", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Pregunta original", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Nueva ronda", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Pregunta replacement", exact: true }),
    ).toBeVisible();
  });

for (const damage of [
  "json",
  "duplicate",
  "snapshot",
  "reviewing",
  "selection",
])
  test(`damaged ${damage} record recovers as a fresh round with a persistent warning`, async ({
    page,
    context,
  }) => {
    await open(page, context, single("damaged"));
    await page.getByLabel("Ocho", { exact: true }).check();
    await page.evaluate(
      ({ key, damage }) => {
        const record = JSON.parse(localStorage.getItem(key));
        if (damage === "json") localStorage.setItem(key, "{broken");
        else {
          if (damage === "duplicate") record.entries.push(record.entries[0]);
          if (damage === "snapshot")
            record.entries[0].snapshot.topic.explanation = [8];
          if (damage === "reviewing") record.reviewing = true;
          if (damage === "selection")
            record.entries[0].work.selectedOptionId = "missing";
          localStorage.setItem(key, JSON.stringify(record));
        }
      },
      { key, damage },
    );
    await page.reload();
    await page.getByRole("button", { name: "Práctica", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("registro está dañado");
    await expect(page.getByLabel("Ocho", { exact: true })).not.toBeChecked();
    await page.getByLabel("Siete", { exact: true }).check();
    await page.getByRole("button", { name: "Comprobar", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Ronda completada", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("registro está dañado");
  });

for (const failure of ["read", "blocked", "quota", "unavailable"])
  test(`storage ${failure} failure keeps session usable and warns honestly`, async ({
    page,
    context,
  }) => {
    const mobile = failure !== "blocked";
    await page.setViewportSize(
      mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    );
    await page.addInitScript(
      ({ key, failure }) => {
        const get = Storage.prototype.getItem;
        const set = Storage.prototype.setItem;
        if (failure === "unavailable")
          Object.defineProperty(window, "localStorage", {
            get() {
              throw new DOMException("Blocked", "SecurityError");
            },
          });
        else {
          Storage.prototype.getItem = function (k) {
            if (k === key && failure === "read")
              throw new DOMException("Blocked", "SecurityError");
            return get.call(this, k);
          };
          Storage.prototype.setItem = function (k, v) {
            if (k === key && failure !== "read")
              throw new DOMException(
                "Blocked",
                failure === "quota" ? "QuotaExceededError" : "SecurityError",
              );
            return set.call(this, k, v);
          };
        }
      },
      { key, failure },
    );
    await open(page, context, single("storage-fault"));
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "No se puede guardar la ronda" }),
    ).toContainText("no sobrevivirá a una recarga");
    await expect(
      page.getByText("Ronda guardada", { exact: false }),
    ).toHaveCount(0);
    await page.getByLabel("Siete", { exact: true }).check();
    await page.getByRole("button", { name: "Comprobar", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Ronda completada", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Revisar ejercicios", exact: true })
      .click();
    await expect(page.getByLabel("Siete", { exact: true })).toBeChecked();
    await page
      .getByRole("button", { name: "Cursos y rutas", exact: true })
      .click();
    await page.getByRole("button", { name: "Práctica", exact: true }).click();
    await expect(page.getByLabel("Siete", { exact: true })).toBeChecked();
    await page
      .getByRole("button", { name: "Nueva ronda", exact: true })
      .click();
    await expect(page.getByLabel("Siete", { exact: true })).not.toBeChecked();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "No se puede guardar la ronda" }),
    ).toBeVisible();
    await page.screenshot({
      path: `/tmp/python-tutor-spec64/practice-warning-${failure}-${mobile ? "mobile" : "desktop"}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(mobile ? 390 : 1280);
  });

test("archived code remains readable after its entire course is removed", async ({
  page,
  context,
}) => {
  const value = publication("code-archive");
  for (const id of ["python-fundamentos", "python-practica"])
    updateCourse(value, id, (course) => {
      course.topics = [course.topics[0]];
      course.topics[0].exercises = [course.topics[0].exercises[0]];
    });
  await open(page, context, value);
  await page
    .getByLabel("Código Python")
    .fill('nombre = "Ada"\nprint("Hola, " + nombre)');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ronda completada", exact: true }),
  ).toBeVisible();
  const next = single("code-replaced", "other");
  next.catalog.courses = next.catalog.courses.filter(
    (course) => course.id !== "python-fundamentos",
  );
  next.catalog.learningPaths.forEach((path) => {
    path.courseIds = ["python-practica"];
  });
  await activate(page, context, next);
  await page
    .getByRole("button", { name: "Revisar ejercicios", exact: true })
    .click();
  await expect(page.getByLabel("Código Python")).toHaveValue(
    'nombre = "Ada"\nprint("Hola, " + nombre)',
  );
  await expect(page.getByLabel("Código Python")).toHaveAttribute(
    "readonly",
    "",
  );
  await expect(page.getByLabel("Salida del programa")).toHaveText("Hola, Ada");
  await expect(
    page.getByRole("button", { name: "Ejecutar", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Dame una pista", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Python Fundamentos", { exact: true }),
  ).toBeVisible();
});

test("corrupt record still explains recovery when the current pool is empty", async ({
  page,
}) => {
  await page.addInitScript((key) => localStorage.setItem(key, "broken"), key);
  await page.route("**/src/main.jsx", async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(
        'import CatalogBootstrap from "/src/CatalogBootstrap.jsx"',
        'import App from "/src/App.jsx"',
      )
      .replace(
        "React.createElement(CatalogBootstrap, null)",
        'React.createElement(App, { publication: { catalog: { revision: "empty", courses: [], learningPaths: [] }, courses: {} } })',
      );
    await route.fulfill({ response, body });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Práctica", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("registro está dañado");
  await expect(
    page.getByRole("heading", {
      name: "Aún no hay ejercicios para practicar",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ir a Cursos", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Cursos y rutas de aprendizaje",
      exact: true,
    }),
  ).toBeVisible();
});

test("archived review keeps the feedback from a later failed attempt on an approved exercise", async ({
  page,
  context,
}) => {
  const value = single("review-feedback");
  for (const id of ["python-fundamentos", "python-practica"])
    updateCourse(value, id, (course) => {
      course.topics[0].exercises.push({
        ...structuredClone(course.topics[0].exercises[0]),
        id: "second",
        title: "Pregunta segunda",
      });
    });
  await page.addInitScript(() => {
    Math.random = () => 0.999;
  });
  await open(page, context, value);
  await page.getByLabel("Siete", { exact: true }).check();
  await page.getByRole("button", { name: "Comprobar", exact: true }).click();
  await page.getByLabel("Ocho", { exact: true }).check();
  await page.getByRole("button", { name: "Comprobar", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Ejercicios de la ronda" })
    .getByRole("button")
    .nth(1)
    .click();
  await page.getByLabel("Siete", { exact: true }).check();
  await page.getByRole("button", { name: "Comprobar", exact: true }).click();
  await activate(page, context, single("review-feedback-new", "replacement"));
  await page
    .getByRole("button", { name: "Revisar ejercicios", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Ejercicios de la ronda" })
    .getByRole("button")
    .nth(0)
    .click();
  await expect(page.getByLabel("Ocho", { exact: true })).toBeChecked();
  await expect(
    page.getByRole("status").filter({ hasText: "Intenta de nuevo." }),
  ).toHaveClass(/retry/);
  await expect(page.getByLabel("Progreso de la ronda")).toHaveAttribute(
    "value",
    "2",
  );
});
