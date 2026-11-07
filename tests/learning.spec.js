import { test, expect } from "@playwright/test";

test("a beginner studies variables and completes both exercises with real Python", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Cursos y rutas de aprendizaje" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Comenzar ruta" }).click();
  await expect(
    page.getByRole("heading", { name: "Valores y variables", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ejecutar", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Código Python").fill('print("Hola, Python")');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByLabel("Salida del programa")).toContainText(
    "Hola, Python",
  );
  await expect(page.getByRole("status")).toContainText("Todavía no");
  await page.getByRole("button", { name: "Dame una pista" }).click();
  await expect(page.getByText("Pista 1 de 2")).toBeVisible();
  await page.getByRole("button", { name: "Otra pista" }).click();
  await expect(page.getByText("Pista 2 de 2")).toBeVisible();
  await page
    .getByLabel("Código Python")
    .fill('nombre = "Ada"\nprint("Hola, " + nombre)');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await expect(
    page.getByText("1 de 2 ejercicios completados", { exact: true }),
  ).toBeVisible();
  // A new execution cannot reuse a variable from the previous solution.
  await page.getByLabel("Código Python").fill('print("Hola, Ada")');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Todavía no");
  await page.getByRole("button", { name: /2\. Un valor que cambia/ }).click();
  await page.getByLabel("Código Python").fill("print(variable_inexistente)");
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByLabel("Errores del programa")).toContainText(
    "NameError",
  );
  await page
    .getByLabel("Código Python")
    .fill("edad = 20\nedad = edad + 1\nprint(edad)");
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await expect(
    page.getByText("2 de 2 ejercicios completados", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Salida del programa")).toHaveText("21");
  await page.getByLabel("Código Python").fill("while True:\n    pass");
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await page.getByRole("button", { name: "Detener ejecución" }).click();
  await expect(page.getByRole("status")).toContainText("Ejecución detenida");
  await expect(
    page.getByRole("button", { name: "Ejecutar", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Código Python").fill("edad = 21\nprint(edad)");
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
});
