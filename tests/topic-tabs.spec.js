import { test, expect, enterCourse, publication, serveCatalog, updateCourse } from "./fixtures/catalog.js";

test("the lesson and exercises occupy accessible tabs", async ({ page }) => {
  await page.goto("/");
  await enterCourse(page);
  const lesson = page.getByRole("tab", { name: "Lección" });
  const exercises = page.getByRole("tab", { name: /Ejercicios/ });
  await expect(lesson).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Código Python")).toBeHidden();
  await lesson.focus();
  await page.keyboard.press("ArrowRight");
  await expect(exercises).toBeFocused();
  await expect(exercises).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Código Python")).toBeVisible();
  await page.keyboard.press("Home");
  await expect(lesson).toBeFocused();
  await page.keyboard.press("End");
  await expect(exercises).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("tabpanel", { name: /Ejercicios/ })).toBeFocused();
  await page.getByLabel("Código Python").fill("# mi borrador");
  await page.getByRole("button", { name: /02 Expresiones y salida/ }).click();
  await expect(lesson).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: /01 Valores y variables/ }).click();
  await expect(exercises).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Código Python")).toHaveValue("# mi borrador");
});

test("a running program finishes while the lesson is open", async ({ page }) => {
  await page.goto("/");
  await enterCourse(page);
  await page.getByRole("tab", { name: /Ejercicios/ }).click();
  await page.getByLabel("Código Python").fill('nombre = "Ada"\nprint("Hola, " + nombre)');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await page.getByRole("tab", { name: "Lección" }).click();
  await expect(page.getByRole("tab", { name: "Lección" })).toBeFocused();
  await expect(page.getByRole("tab", { name: /Ejercicios \(1\/2\)/ })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("tab", { name: "Lección" })).toBeFocused();
  await page.getByRole("tab", { name: /Ejercicios/ }).click();
  await expect(page.getByLabel("Salida del programa")).toHaveText("Hola, Ada");
});


test("mobile learners can complete a choice exercise and return to their draft", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const catalog = publication("topic-tabs-choice");
  updateCourse(catalog, "python-fundamentos", (course) => {
    const item = course.topics[0].exercises[1];
    Object.assign(item, { type: "choice", title: "Interpretar una asignación", prompt: "¿Qué hace edad = 7?", code: "edad = 7", options: [{ id: "asigna", text: "Guarda 7 en edad" }, { id: "compara", text: "Compara edad con 7" }], answerId: "asigna", retry: "Piensa en el signo igual.", explanation: "Asigna 7." });
    delete item.starter; delete item.check; delete item.success;
  });
  await serveCatalog(context, catalog);
  await page.goto("/");
  await enterCourse(page);
  await page.getByRole("tab", { name: /Ejercicios/ }).click();
  await page.getByLabel("Código Python").fill("# borrador móvil");
  await page.getByRole("button", { name: /2\. Interpretar una asignación/ }).click();
  await page.getByRole("radio", { name: "Guarda 7 en edad" }).check();
  await page.getByRole("button", { name: "Comprobar" }).click();
  await expect(page.getByRole("tab", { name: /Ejercicios \(1\/2\)/ })).toBeVisible();
  await page.getByRole("button", { name: /02 Expresiones y salida/ }).click();
  await page.getByRole("button", { name: /01 Valores y variables/ }).click();
  await expect(page.getByRole("radio", { name: "Guarda 7 en edad" })).toBeChecked();
  await page.getByRole("button", { name: /1\. / }).click();
  await expect(page.getByLabel("Código Python")).toHaveValue("# borrador móvil");
});
