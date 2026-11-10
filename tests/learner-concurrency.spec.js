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
