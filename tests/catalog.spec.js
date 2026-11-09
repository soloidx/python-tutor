import { createHash } from "node:crypto";
import {
  test,
  expect,
  publication,
  serveCatalog,
  updateCourse,
} from "./fixtures/catalog.js";

test("loads complete remote publication and freely navigates paths, courses and topics", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Cursos y rutas de aprendizaje" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Explorar Camino a la automatización" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Python Práctica", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Ver temas de Python Fundamentos" })
    .click();
  await page
    .getByRole("button", { name: "03 Condicionales", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Condicionales", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Contexto de aprendizaje" }),
  ).toContainText("Camino a la automatización");
  await page.getByRole("button", { name: "Siguiente tema" }).click();
  await expect(
    page.getByRole("heading", { name: "Bucles", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Condicionales", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Cursos y rutas de aprendizaje" }),
  ).toBeVisible();
});

test("shows initial loading until every course is valid and retry recovers a failed download", async ({
  page,
  context,
}) => {
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const value = publication();
  await context.route("**/courses/python-practica.*.json", async (route) => {
    await held;
    await route.fulfill({ status: 503 });
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Cargando catálogo…");
  await expect(page.getByRole("button", { name: /Explorar/ })).toHaveCount(0);
  release();
  await expect(page.getByRole("alert")).toContainText("HTTP 503");
  await context.unroute("**/courses/python-practica.*.json");
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(
    page.getByRole("button", { name: "Explorar Primeros pasos con Python" }),
  ).toBeVisible();
});

const invalidCatalogs = [
  [
    "unknown catalog version",
    (value) => (value.catalog.schemaVersion = 2),
    "schemaVersion",
  ],
  ["missing revision", (value) => delete value.catalog.revision, "revision"],
  [
    "empty paths",
    (value) => (value.catalog.learningPaths = []),
    "learningPaths",
  ],
  ["empty course registry", (value) => (value.catalog.courses = []), "courses"],
  [
    "duplicate paths",
    (value) => value.catalog.learningPaths.push(value.catalog.learningPaths[0]),
    "duplicados",
  ],
  [
    "duplicate course registry",
    (value) => value.catalog.courses.push(value.catalog.courses[0]),
    "duplicados",
  ],
  [
    "duplicate course reference",
    (value) =>
      value.catalog.learningPaths[0].courseIds.push("python-fundamentos"),
    "duplicados",
  ],
  [
    "missing course reference",
    (value) => value.catalog.learningPaths[0].courseIds.push("missing"),
    "inexistente",
  ],
  [
    "unassigned course",
    (value) => value.catalog.learningPaths[0].courseIds.pop(),
    "pertenecer",
  ],
  [
    "invalid path slug",
    (value) => (value.catalog.learningPaths[0].id = "Ruta nueva"),
    "slug ASCII",
  ],
  [
    "non-string description",
    (value) => (value.catalog.learningPaths[0].description = 42),
    "description",
  ],
  [
    "wrong digest",
    (value) => (value.catalog.courses[0].sha256 = "0".repeat(64)),
    "SHA-256 incorrecta",
  ],
  [
    "truncated JSON",
    (value) => (value.files[value.catalog.courses[0].file] = "{"),
    "SHA-256 incorrecta",
  ],
];
for (const file of [
  "/absolute.json",
  "../escape.json",
  "courses/../escape.json",
  "https://evil.test/course.json",
  "//evil.test/course.json",
  "courses/%2e%2e/escape.json",
  "courses/%252e%252e/escape.json",
  "courses/x.json?other",
  "courses/x.json#part",
  "courses/\\escape.json",
  "./course.json",
]) {
  invalidCatalogs.push([
    `unsafe file ${file}`,
    (value) => (value.catalog.courses[0].file = file),
    "relativo",
  ]);
}
const invalidCourses = [
  [
    "unknown course version",
    (course) => (course.schemaVersion = 3),
    "schemaVersion",
  ],
  [
    "mismatched course identity",
    (course) => (course.id = "different"),
    "no coincide",
  ],
  ["empty topics", (course) => (course.topics = []), "topics"],
  [
    "empty exercises",
    (course) => (course.topics[0].exercises = []),
    "exercises",
  ],
  [
    "duplicate topic ids",
    (course) => course.topics.push(course.topics[0]),
    "duplicados",
  ],
  [
    "duplicate exercises across topics",
    (course) =>
      (course.topics[1].exercises[0].id = course.topics[0].exercises[0].id),
    "duplicados",
  ],
  [
    "invalid exercise slug",
    (course) => (course.topics[0].exercises[0].id = "Saludo"),
    "slug ASCII",
  ],
  [
    "missing Python check",
    (course) => delete course.topics[0].exercises[0].check,
    "check",
  ],
  [
    "invalid explanation type",
    (course) => (course.topics[0].explanation = "paragraph"),
    "explanation",
  ],
  [
    "invalid optional duration",
    (course) => (course.topics[0].duration = 4),
    "duration",
  ],
  [
    "invalid hint type",
    (course) => (course.topics[0].exercises[0].hints = [null]),
    "hints",
  ],
  [
    "empty assessment",
    (course) => (course.assessment.questions = []),
    "questions",
  ],
  [
    "duplicate question ids",
    (course) =>
      course.assessment.questions.push(course.assessment.questions[0]),
    "duplicados",
  ],
  [
    "one assessment option",
    (course) => (course.assessment.questions[0].options.length = 1),
    "dos opciones",
  ],
  [
    "duplicate option ids",
    (course) =>
      (course.assessment.questions[0].options[1].id =
        course.assessment.questions[0].options[0].id),
    "duplicados",
  ],
  [
    "missing answer reference",
    (course) => (course.assessment.questions[0].answerId = "missing"),
    "answerId",
  ],
  [
    "invalid optional question code",
    (course) => (course.assessment.questions[0].code = false),
    "code",
  ],
];
for (const [name, change, reason] of invalidCourses)
  invalidCatalogs.push([
    name,
    (value) => updateCourse(value, "python-fundamentos", change),
    reason,
  ]);
for (const [name, change, reason] of invalidCatalogs)
  test(`rejects entire publication: ${name}`, async ({ page, context }) => {
    const value = publication();
    change(value);
    await serveCatalog(context, value);
    await page.goto("/");
    await expect(page.getByRole("alert")).toContainText(reason);
    await expect(
      page.getByRole("button", { name: "Reintentar" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Explorar/ })).toHaveCount(0);
  });

test("renders declarative strings as text and optional assessment only when supplied", async ({
  page,
  context,
}) => {
  const value = publication();
  updateCourse(value, "python-fundamentos", (course) => {
    course.topics[0].summary = '<img src=x onerror="window.injected=true">';
  });
  await serveCatalog(context, value);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explorar Primeros pasos con Python" })
    .click();
  await page
    .getByRole("button", { name: "Ver temas de Python Práctica" })
    .click();
  await expect(
    page.getByRole("button", { name: /evaluación final/ }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Primeros pasos con Python", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ver temas de Python Fundamentos" })
    .click();
  await expect(
    page.getByText('<img src=x onerror="window.injected=true">'),
  ).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await page.getByRole("button", { name: "Comenzar evaluación final" }).click();
  await expect(
    page.getByRole("heading", { name: "Evaluación final", exact: true }),
  ).toBeVisible();
});

test("rejects malformed course JSON even when the exact byte digest matches", async ({
  page,
  context,
}) => {
  const value = publication();
  const record = value.catalog.courses[1];
  value.files[record.file] = '{"schemaVersion": 1,';
  record.sha256 = createHash("sha256")
    .update(value.files[record.file])
    .digest("hex");
  await serveCatalog(context, value);
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("JSON inválido");
  await expect(page.getByRole("button", { name: /Explorar/ })).toHaveCount(0);
});

test("network failure exposes retry without activating a partial publication", async ({
  page,
  context,
}) => {
  await context.route("**/catalog.json", (route) => route.abort("failed"));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "No se pudo cargar el catálogo",
  );
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Explorar/ })).toHaveCount(0);
  await context.unroute("**/catalog.json");
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(
    page.getByRole("button", { name: "Explorar Primeros pasos con Python" }),
  ).toBeVisible();
});
