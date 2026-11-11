import { readFile } from "node:fs/promises";
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
  await expect(other.getByText(/Cambio pendiente en/)).toBeVisible();
  await other.getByRole("button", { name: "Aplicar cambio revisado" }).click();
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
  await other.getByRole("button", { name: "Revisar cambios de esta sesión" }).click();
  await expect(other.getByText("Estás revisando cambios de esta sesión que aún no están guardados.")).toBeVisible();
  await other.getByLabel("Código Python").fill("# cambio revisado");
  await page.getByLabel("Código Python").fill("# cambio más reciente");
  await expect(page.getByText("Ronda guardada", { exact: false })).toBeVisible();
  await other.getByRole("button", { name: "Aplicar cambios revisados" }).click();
  await other.getByRole("button", { name: "Revisar cambios de esta sesión" }).click();
  await expect(other.getByLabel("Código Python")).toHaveValue("# cambio revisado");
  await other.getByRole("button", { name: "Aplicar cambios revisados" }).click();
  await expect(other.getByText("Ronda guardada", { exact: false })).toBeVisible();
  await expect(other.getByRole("button", { name: "Revisar cambios de esta sesión" })).toHaveCount(0);
  await other.reload();
  await other.getByRole("button", { name: "Práctica", exact: true }).click();
  await expect(other.getByLabel("Código Python")).toHaveValue("# cambio revisado");
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

test("a write from an older tab is preserved after migration", async ({ page, context }) => {
  const legacyKey = "python-tutor:course-progress:v1:python-fundamentos";
  await page.addInitScript((key) => {
    if (!localStorage.getItem("python-tutor:learner-store:v1"))
      localStorage.setItem(key, JSON.stringify({ topicId: "valores-variables", completed: [], assessmentResult: null }));
  }, legacyKey);
  await page.goto("/");
  await enterCourse(page);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("python-tutor:learner-store:v1"))).not.toBeNull();
  const oldTab = await context.newPage();
  await oldTab.goto("/");
  const newer = JSON.stringify({ topicId: "valores-variables", completed: ["saludo"], assessmentResult: null });
  await oldTab.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: legacyKey, value: newer });
  await page.getByRole("button", { name: /02 Expresiones y salida/ }).click();
  await expect(page.getByRole("alert")).toContainText("No se pudo guardar");
  expect(await oldTab.evaluate((key) => localStorage.getItem(key), legacyKey)).toBe(newer);
});

test("reset does not revive retained legacy progress", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("python-tutor:learner-store:v1"))
      localStorage.setItem("python-tutor:course-progress:v1:python-fundamentos", JSON.stringify({ topicId: "valores-variables", completed: ["saludo"], assessmentResult: null }));
  });
  await page.goto("/");
  await enterCourse(page);
  await expect(page.getByText("1 / 12 ejercicios", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reiniciar este curso", exact: true }).click();
  await page.getByRole("button", { name: "Sí, reiniciar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Comenzar curso", exact: true })).toBeVisible();
  await page.reload();
  await enterCourse(page);
  await expect(page.getByText("0 / 12 ejercicios", { exact: true })).toBeVisible();
});

test("failed migration keeps the legacy learning available", async ({ page }) => {
  const key = "python-tutor:course-progress:v1:python-fundamentos";
  const legacy = JSON.stringify({ topicId: "valores-variables", completed: ["saludo"], assessmentResult: null });
  await page.addInitScript(({ key, legacy }) => {
    localStorage.setItem(key, legacy);
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === "python-tutor:learner-store:v1") throw new DOMException("Full", "QuotaExceededError");
      return set.call(this, name, value);
    };
  }, { key, legacy });
  await page.goto("/");
  await enterCourse(page);
  await expect(page.getByText("1 / 12 ejercicios", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("No se pudo guardar");
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(legacy);
  await page.reload();
  await enterCourse(page);
  await expect(page.getByText("1 / 12 ejercicios", { exact: true })).toBeVisible();
});

test("denied learner locks keep changes in the session with a warning", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.locks.request = () => Promise.reject(new DOMException("Blocked", "SecurityError"));
  });
  await page.goto("/");
  await enterCourse(page);
  await expect(page.getByRole("alert")).toContainText("solo está disponible en esta sesión");
  await page.getByRole("button", { name: /02 Expresiones y salida/ }).click();
  await expect(page.getByRole("heading", { name: "Expresiones y salida", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reiniciar este curso", exact: true }).click();
  await page.getByRole("button", { name: "Sí, reiniciar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("No se pudo proteger el reinicio");
});

test("legacy changes can be reviewed and preserved without replacing current learning", async ({ page, context }) => {
  const key = "python-tutor:course-progress:v1:python-fundamentos";
  await page.addInitScript((key) => {
    if (!localStorage.getItem("python-tutor:learner-store:v1"))
      localStorage.setItem(key, JSON.stringify({ topicId: "valores-variables", completed: ["saludo"], assessmentResult: null }));
  }, key);
  await page.goto("/");
  await enterCourse(page);
  await expect(page.getByText("1 / 12 ejercicios", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("python-tutor:learner-store:v1"))).not.toBeNull();
  const other = await context.newPage();
  await other.goto("/");
  const changed = JSON.stringify({ topicId: "valores-variables", completed: [], assessmentResult: null });
  await other.evaluate(({ key, changed }) => localStorage.setItem(key, changed), { key, changed });
  await expect(page.getByRole("region", { name: "Revisar datos de otra versión" })).toBeVisible();
  await page.getByText("Ver versiones disponibles", { exact: true }).click();
  await expect(page.getByRole("region", { name: "Revisar datos de otra versión" })).toContainText("python-fundamentos");
  await page.getByLabel("Código Python").fill("# borrador de sesión");
  await page.getByRole("button", { name: "Conservar ambas versiones", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cursos y rutas de aprendizaje" })).toBeVisible();
  await expect(page.getByText("Copias de datos de otra versión", { exact: true })).toBeVisible();
  await page.getByText("Copias de datos de otra versión", { exact: true }).click();
  await expect(page.getByText("Descargar copias de recuperación", { exact: true })).toBeVisible();
  await enterCourse(page);
  await expect(page.getByText("1 / 12 ejercicios", { exact: true })).toBeVisible();
  const copies = await page.evaluate(() => window.__learnerTest.keys().filter((key) => key.startsWith("python-tutor:recovery:v1:")).map((key) => window.__learnerTest.getItem(key)));
  expect(copies.some((copy) => copy.includes('"after"') && copy.includes('python-fundamentos'))).toBe(true);
  expect(copies.some((copy) => copy.includes("# borrador de sesión"))).toBe(true);
  expect(await other.evaluate((key) => localStorage.getItem(key), key)).toBe(changed);
});

test("failed legacy reconciliation preserves both versions and the session", async ({ page, context }) => {
  const key = "python-tutor:course-progress:v1:python-fundamentos";
  await page.addInitScript((key) => {
    if (!localStorage.getItem("python-tutor:learner-store:v1"))
      localStorage.setItem(key, JSON.stringify({ topicId: "valores-variables", completed: ["saludo"], assessmentResult: null }));
  }, key);
  await page.goto("/");
  await enterCourse(page);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("python-tutor:learner-store:v1"))).not.toBeNull();
  const other = await context.newPage();
  await other.goto("/");
  const changed = JSON.stringify({ topicId: "valores-variables", completed: [], assessmentResult: null });
  await other.evaluate(({ key, changed }) => localStorage.setItem(key, changed), { key, changed });
  await expect(page.getByRole("region", { name: "Revisar datos de otra versión" })).toBeVisible();
  await page.getByLabel("Código Python").fill("# no perder");
  const durable = await page.evaluate(() => localStorage.getItem("python-tutor:learner-store:v1"));
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "python-tutor:learner-store:v1") throw new DOMException("Full", "QuotaExceededError");
      return set.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Conservar ambas versiones", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "No se pudieron conservar ambas versiones" })).toBeVisible();
  await expect(page.getByLabel("Código Python")).toHaveValue("# no perder");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Descargar ambas versiones" }).click(),
  ]);
  expect(await readFile(await download.path(), "utf8")).toContain("# no perder");
  expect(await page.evaluate(() => localStorage.getItem("python-tutor:learner-store:v1"))).toBe(durable);
  expect(await other.evaluate((key) => localStorage.getItem(key), key)).toBe(changed);
});

test("a new legacy change requires another review before reconciliation", async ({ page, context }) => {
  const key = "python-tutor:course-progress:v1:python-fundamentos";
  await page.addInitScript((key) => {
    if (!localStorage.getItem("python-tutor:learner-store:v1"))
      localStorage.setItem(key, JSON.stringify({ topicId: "valores-variables", completed: [], assessmentResult: null }));
  }, key);
  await page.goto("/");
  await enterCourse(page);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("python-tutor:learner-store:v1"))).not.toBeNull();
  const other = await context.newPage();
  await other.goto("/");
  await other.evaluate((key) => localStorage.setItem(key, "primera versión"), key);
  await expect(page.getByRole("region", { name: "Revisar datos de otra versión" })).toBeVisible();
  const durable = await page.evaluate(() => localStorage.getItem("python-tutor:learner-store:v1"));
  await other.evaluate((key) => localStorage.setItem(key, "segunda versión"), key);
  await expect(page.getByRole("button", { name: "Revisar datos actualizados" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Conservar ambas versiones" })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem("python-tutor:learner-store:v1"))).toBe(durable);
  await page.getByRole("button", { name: "Revisar datos actualizados" }).click();
  await expect(page.getByRole("region", { name: "Revisar datos de otra versión" })).toContainText("segunda versión");
  await page.getByRole("button", { name: "Conservar ambas versiones" }).click();
  await expect(page.getByRole("heading", { name: "Cursos y rutas de aprendizaje" })).toBeVisible();
  expect(await other.evaluate((key) => localStorage.getItem(key), key)).toBe("segunda versión");
});

test("reviewed legacy learning can be made active while current learning is recoverable", async ({ page, context }) => {
  const key = "python-tutor:course-progress:v1:python-fundamentos";
  await page.addInitScript((key) => {
    if (!localStorage.getItem("python-tutor:learner-store:v1"))
      localStorage.setItem(key, JSON.stringify({ topicId: "valores-variables", completed: ["saludo"], assessmentResult: null }));
  }, key);
  await page.goto("/");
  await enterCourse(page);
  await expect(page.getByText("1 / 12 ejercicios", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("python-tutor:learner-store:v1"))).not.toBeNull();
  const other = await context.newPage();
  await other.goto("/");
  await other.evaluate((key) => localStorage.setItem(key, JSON.stringify({ topicId: "valores-variables", completed: [], assessmentResult: null })), key);
  await expect(page.getByRole("region", { name: "Revisar datos de otra versión" })).toBeVisible();
  await page.getByRole("button", { name: "Usar datos de otra versión" }).click();
  await expect(page.getByRole("heading", { name: "Cursos y rutas de aprendizaje" })).toBeVisible();
  await enterCourse(page);
  await expect(page.getByText("0 / 12 ejercicios", { exact: true })).toBeVisible();
  await page.getByText("Copias de datos de otra versión", { exact: true }).click();
  await expect(page.getByText("Descargar copias de recuperación")).toBeVisible();
  const copies = await page.evaluate(() => window.__learnerTest.keys().filter((key) => key.startsWith("python-tutor:recovery:v1:")).map((key) => window.__learnerTest.getItem(key)));
  expect(copies.some((copy) => copy.includes('"type":"current"') && copy.includes("saludo"))).toBe(true);
});
