import {
  test,
  expect,
  enterCourse,
  publication,
  serveCatalog,
  updateCourse,
} from "./fixtures/catalog.js";

test("keeps exercise navigation and prompt in the practice workspace", async ({
  page,
}) => {
  await page.goto("/");
  await enterCourse(page);

  const practice = page.getByLabel("Espacio de práctica");
  const lesson = page.locator("#lesson-panel");
  const prompt =
    'Crea una variable llamada nombre con el texto "Ada". Muestra Hola, Ada usando esa variable.';

  await expect(
    practice.getByRole("heading", { name: "Tu primera variable", exact: true }),
  ).toBeVisible();
  await expect(practice.getByText(prompt, { exact: true })).toBeVisible();
  await expect(
    practice.getByRole("button", { name: /1\. Tu primera variable/ }),
  ).toBeVisible();
  await expect(lesson.getByRole("heading", { name: "Tu primera variable" })).toHaveCount(0);
  await expect(lesson.getByText(prompt, { exact: true })).toHaveCount(0);

  await practice
    .getByRole("button", { name: /2\. Un valor que cambia/ })
    .click();
  await expect(
    practice.getByRole("heading", { name: "Un valor que cambia", exact: true }),
  ).toBeVisible();
  await practice.getByRole("button", { name: "Dame una pista" }).click();
  await expect(practice.getByText("Pista 1 de 2")).toBeVisible();

  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await page.getByRole("tab", { name: "Lección", exact: true }).click();
  await expect(
    practice.getByRole("heading", { name: "Un valor que cambia", exact: true }),
  ).toBeVisible();
  await expect(practice.getByText("Pista 1 de 2")).toBeVisible();
});

test("does not show an empty hint control", async ({ page, context }) => {
  const value = publication("no-hints");
  updateCourse(value, "python-fundamentos", (course) => {
    course.topics[0].exercises[0].hints = [];
  });
  await serveCatalog(context, value);

  await page.goto("/");
  await enterCourse(page);

  const practice = page.getByLabel("Espacio de práctica");
  await expect(practice.getByRole("heading", { name: "Tu primera variable" })).toBeVisible();
  await expect(practice.getByRole("button", { name: /pista/i })).toHaveCount(0);
});
