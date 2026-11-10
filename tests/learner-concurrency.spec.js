import { test, expect, enterCourse } from "./fixtures/catalog.js";

test("a second tab does not erase recently completed learning", async ({ page, context }) => {
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/");
  await enterCourse(page);
  await enterCourse(other);

  await page.getByLabel("Código Python").fill('nombre = "Ada"\nprint("Hola, " + nombre, end="")');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await other.getByRole("button", { name: /02 Expresiones y salida/ }).click();
  await expect(other.getByRole("alert")).toContainText("otra pestaña");
  await other.reload();
  await enterCourse(other);
  await expect(other.getByText("1 / 12 ejercicios", { exact: true })).toBeVisible();
});

test("practice detects a round changed by another tab", async ({ page, context }) => {
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/");
  await page.getByRole("button", { name: "Práctica", exact: true }).click();
  await expect(page.getByText("Ronda guardada", { exact: false })).toBeVisible();
  await other.getByRole("button", { name: "Práctica", exact: true }).click();
  await expect(other.getByRole("alert")).toContainText("otra pestaña");
});

test("a stale tab cannot overwrite a newer tutor conversation", async ({ page, context }) => {
  const { setup } = await import("./fixtures/tutor.js");
  await setup(page);
  const other = await context.newPage();
  await setup(other);
  await page.getByLabel("Mensaje al tutor").fill("Primera pregunta");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Respuesta completa", { exact: true })).toBeVisible();
  await other.getByLabel("Mensaje al tutor").fill("Segunda pregunta");
  await other.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(other.getByRole("alert")).toContainText("otra pestaña");
  await expect(other.getByLabel("Mensaje al tutor")).toHaveValue("Segunda pregunta");
  await other.reload();
  await enterCourse(other);
  await other.getByRole("tab", { name: "Tutor", exact: true }).click();
  await expect(other.getByText("Primera pregunta", { exact: true })).toBeVisible();
});

test("a stale reset does not erase progress from another tab", async ({ page, context }) => {
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/");
  await enterCourse(page);
  await enterCourse(other);
  await page.getByLabel("Código Python").fill('nombre = "Ada"\nprint("Hola, " + nombre, end="")');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await other.getByRole("button", { name: "Reiniciar este curso", exact: true }).click();
  await other.getByRole("button", { name: "Sí, reiniciar", exact: true }).click();
  await expect(other.getByRole("alert")).toContainText("otra pestaña");
  await other.reload();
  await enterCourse(other);
  await expect(other.getByText("1 / 12 ejercicios", { exact: true })).toBeVisible();
});

test("a failed reset leaves the last durable learning intact", async ({ page }) => {
  const { setup } = await import("./fixtures/tutor.js");
  await setup(page);
  await page.getByLabel("Mensaje al tutor").fill("Conversación conservada");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Respuesta completa", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Lección", exact: true }).click();
  await page.getByLabel("Código Python").fill('nombre = "Ada"\nprint("Hola, " + nombre, end="")');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "python-tutor:learner-store:v1") throw new DOMException("Full", "QuotaExceededError");
      return set.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Reiniciar este curso", exact: true }).click();
  await page.getByRole("button", { name: "Sí, reiniciar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("No se pudo guardar el reinicio");
  await page.reload();
  await enterCourse(page);
  await expect(page.getByText("1 / 12 ejercicios", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await expect(page.getByText("Conversación conservada", { exact: true })).toBeVisible();
});

test("an unreadable learner store remains intact and original courses remain usable", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("python-tutor:learner-store:v1", "damaged"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Cursos y rutas de aprendizaje" })).toBeVisible();
  await enterCourse(page);
  await expect(page.getByRole("alert")).toContainText(/no se pudo recuperar/i);
  await page.getByRole("button", { name: /02 Expresiones y salida/ }).click();
  expect(await page.evaluate(() => localStorage.getItem("python-tutor:learner-store:v1"))).toBe("damaged");
});

test("legacy progress survives migration and reload", async ({ page }) => {
  await page.addInitScript(() => {
    const key = "python-tutor:course-progress:v1:" + encodeURIComponent("python-fundamentos");
    if (!localStorage.getItem("python-tutor:learner-store:v1"))
      localStorage.setItem(key, JSON.stringify({ topicId: "valores-variables", completed: ["saludo"], assessmentResult: null }));
  });
  await page.goto("/");
  await enterCourse(page);
  await expect(page.getByText("1 / 12 ejercicios", { exact: true })).toBeVisible();
  await page.reload();
  await enterCourse(page);
  await expect(page.getByText("1 / 12 ejercicios", { exact: true })).toBeVisible();
});
