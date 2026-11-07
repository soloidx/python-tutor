import { test, expect } from "@playwright/test";

test("a beginner progresses through fundamentals with real Python", async ({
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

  await page.getByRole("button", { name: /02 Expresiones y salida/ }).click();
  await expect(page.getByRole("heading", { name: "Expresiones y salida", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Dame una pista" }).click();
  await expect(page.getByText("Pista 1 de 2")).toBeVisible();
  await page.getByRole("button", { name: "Otra pista" }).click();
  await expect(page.getByText("Pista 2 de 2")).toBeVisible();
  await page.getByLabel("Código Python").fill('total = 15\nprint(total)');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Todavía no");
  await page.getByLabel("Código Python").fill('precio = 8\ncantidad = 3\ntotal = precio * cantidad\nprint(total)');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await expect(page.getByLabel("Salida del programa")).toHaveText("24");
  await page.getByRole("button", { name: /2\. Un mensaje con resultado/ }).click();
  await page.getByLabel("Código Python").fill('puntos = 10 + 5\nprint("Puntos:", puntos)');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await expect(page.getByLabel("Salida del programa")).toHaveText("Puntos: 15");
  await expect(page.getByText("2 de 2 ejercicios completados", { exact: true })).toBeVisible();

  await expect(page.getByRole("button", { name: /03 Condicionales/ })).toBeVisible();
  await page.getByRole("button", { name: /03 Condicionales/ }).click();
  await expect(page.getByRole("heading", { name: "Condicionales", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Dame una pista" }).click();
  await page.getByRole("button", { name: "Otra pista" }).click();
  await expect(page.getByText("Pista 2 de 2")).toBeVisible();
  await page.getByLabel("Código Python").fill('edad = 16\nif edad >= 18:\n    print("Puede entrar")\nelse:\n    print("Debe esperar")');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByLabel("Salida del programa")).toHaveText("Debe esperar");
  await expect(page.getByRole("status")).toContainText("Todavía no");
  await page.getByLabel("Código Python").fill('edad = 20\nif edad >= 18:\n    print("Puede entrar")\nelse:\n    print("Debe esperar")');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await page.getByRole("button", { name: /2\. ¿Par o impar/ }).click();
  await page.getByLabel("Código Python").fill('numero = 7\nif numero % 2 == 0:\n    print("Par")\nelse:\n    print("Impar")');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await expect(page.getByLabel("Salida del programa")).toHaveText("Impar");
  await expect(page.getByText("2 de 2 ejercicios completados", { exact: true })).toBeVisible();

  await expect(page.getByRole("button", { name: /04 Bucles/ })).toBeVisible();
  await page.getByRole("button", { name: /04 Bucles/ }).click();
  await expect(page.getByRole("heading", { name: "Bucles", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Dame una pista" }).click();
  await page.getByRole("button", { name: "Otra pista" }).click();
  await expect(page.getByText("Pista 2 de 2")).toBeVisible();
  await page.getByLabel("Código Python").fill('for numero in range(1, 3):\n    print(numero)');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Todavía no");
  await page.getByLabel("Código Python").fill('for numero in range(1, 4):\n    print(numero)');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await expect(page.getByLabel("Salida del programa")).toHaveText("1\n2\n3");
  await page.getByRole("button", { name: /2\. Suma paso a paso/ }).click();
  await page.getByLabel("Código Python").fill('total = 0\nnumero = 1\nwhile numero <= 4:\n    total = total + numero\n    numero = numero + 1\nprint(total)');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await expect(page.getByLabel("Salida del programa")).toHaveText("10");
  await expect(page.getByText("2 de 2 ejercicios completados", { exact: true })).toBeVisible();

  await expect(page.getByText("8 / 8 ejercicios", { exact: true })).toBeVisible();
  for (const title of ["Valores y variables", "Expresiones y salida", "Condicionales", "Bucles"]) {
    const topicButton = page.getByRole("button", { name: new RegExp(title + " Completado") });
    await expect(topicButton).toBeVisible();
    await topicButton.click();
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.getByText("2 de 2 ejercicios completados", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /1\..*Completado/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /2\..*Completado/ })).toBeVisible();
  }
  await page.getByRole("button", { name: "Volver a cursos" }).click();
  await expect(page.getByText("8 ejercicios completados", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continuar ruta" }).click();
  await expect(page.getByRole("heading", { name: "Bucles", exact: true })).toBeVisible();

});
