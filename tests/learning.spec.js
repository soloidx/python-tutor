import { test, expect, enterCourse } from "./fixtures/catalog.js";

test("a beginner progresses through fundamentals with real Python", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Cursos y rutas de aprendizaje" }),
  ).toBeVisible();
  await enterCourse(page);
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
    .fill('nombre = "Ada"\nprint("Hola, " + nombre, end="")');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByLabel("Salida del programa")).toHaveText("Hola, Ada");
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  // A following run must not inherit buffered output from the previous one.
  await page
    .getByLabel("Código Python")
    .fill('nombre = "Ada"\nprint("Hola, " + nombre)');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByLabel("Salida del programa")).toHaveText("Hola, Ada");
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await expect(
    page.getByText("1 de 2 ejercicios completados", { exact: true }),
  ).toBeVisible();
  // A new execution cannot reuse a variable from the previous solution.
  await page.getByLabel("Código Python").fill('print("Hola, Ada")');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Todavía no");
  await page.getByRole("button", { name: /2\. Un valor que cambia/ }).click();
  await page
    .getByLabel("Código Python")
    .fill('print("Antes del error", end="")\nprint(variable_inexistente)');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByLabel("Errores del programa")).toContainText(
    "NameError",
  );
  await expect(page.getByLabel("Salida del programa")).toHaveText(
    "Antes del error",
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
  const expressionsStarter = await page
    .getByLabel("Código Python")
    .inputValue();
  await page
    .getByLabel("Código Python")
    .fill("# borrador que no debe guardarse");
  await page.getByRole("button", { name: "Dame una pista" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Cursos y rutas de aprendizaje" }),
  ).toBeVisible();
  await enterCourse(page);
  await expect(
    page.getByRole("heading", { name: "Expresiones y salida", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("2 / 12 ejercicios", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /01 Valores y variables Completado/ }),
  ).toBeVisible();
  await expect(page.getByLabel("Código Python")).toHaveValue(
    expressionsStarter,
  );
  await expect(page.getByText("Pista 1 de 2")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ejecutar", exact: true }),
  ).toBeEnabled();

  await expect(
    page.getByRole("heading", { name: "Expresiones y salida", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dame una pista" }).click();
  await expect(page.getByText("Pista 1 de 2")).toBeVisible();
  await page.getByRole("button", { name: "Otra pista" }).click();
  await expect(page.getByText("Pista 2 de 2")).toBeVisible();
  await page.getByLabel("Código Python").fill("total = 15\nprint(total)");
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Todavía no");
  await page
    .getByLabel("Código Python")
    .fill("precio = 8\ncantidad = 3\ntotal = precio * cantidad\nprint(total)");
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await expect(page.getByLabel("Salida del programa")).toHaveText("24");
  await page
    .getByRole("button", { name: /2\. Un mensaje con resultado/ })
    .click();
  await page
    .getByLabel("Código Python")
    .fill('puntos = 10 + 5\nprint("Puntos:", puntos)');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await expect(page.getByLabel("Salida del programa")).toHaveText("Puntos: 15");
  await expect(
    page.getByText("2 de 2 ejercicios completados", { exact: true }),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: /03 Condicionales/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /03 Condicionales/ }).click();
  await expect(
    page.getByRole("heading", { name: "Condicionales", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dame una pista" }).click();
  await page.getByRole("button", { name: "Otra pista" }).click();
  await expect(page.getByText("Pista 2 de 2")).toBeVisible();
  await page
    .getByLabel("Código Python")
    .fill(
      'edad = 16\nif edad >= 18:\n    print("Puede entrar")\nelse:\n    print("Debe esperar")',
    );
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByLabel("Salida del programa")).toHaveText(
    "Debe esperar",
  );
  await expect(page.getByRole("status")).toContainText("Todavía no");
  await page
    .getByLabel("Código Python")
    .fill(
      'edad = 20\nif edad >= 18:\n    print("Puede entrar")\nelse:\n    print("Debe esperar")',
    );
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await page.getByRole("button", { name: /2\. ¿Par o impar/ }).click();
  await page
    .getByLabel("Código Python")
    .fill(
      'numero = 7\nif numero % 2 == 0:\n    print("Par")\nelse:\n    print("Impar")',
    );
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await expect(page.getByLabel("Salida del programa")).toHaveText("Impar");
  await expect(
    page.getByText("2 de 2 ejercicios completados", { exact: true }),
  ).toBeVisible();

  await expect(page.getByRole("button", { name: /04 Bucles/ })).toBeVisible();
  await page.getByRole("button", { name: /04 Bucles/ }).click();
  await expect(
    page.getByRole("heading", { name: "Bucles", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dame una pista" }).click();
  await page.getByRole("button", { name: "Otra pista" }).click();
  await expect(page.getByText("Pista 2 de 2")).toBeVisible();
  await page
    .getByLabel("Código Python")
    .fill("for numero in range(1, 3):\n    print(numero)");
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Todavía no");
  await page
    .getByLabel("Código Python")
    .fill("for numero in range(1, 4):\n    print(numero)");
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await expect(page.getByLabel("Salida del programa")).toHaveText("1\n2\n3");
  await page.getByRole("button", { name: /2\. Suma paso a paso/ }).click();
  await page
    .getByLabel("Código Python")
    .fill(
      "total = 0\nnumero = 1\nwhile numero <= 4:\n    total = total + numero\n    numero = numero + 1\nprint(total)",
    );
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await expect(page.getByLabel("Salida del programa")).toHaveText("10");
  await expect(
    page.getByText("2 de 2 ejercicios completados", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: /05 Funciones/ }).click();
  await expect(
    page.getByRole("heading", { name: "Funciones", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dame una pista" }).click();
  await page.getByRole("button", { name: "Otra pista" }).click();
  await expect(page.getByText("Pista 2 de 2")).toBeVisible();
  await page
    .getByLabel("Código Python")
    .fill("def doble(numero):\n    return 8\nprint(doble(4))");
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Todavía no");
  await page
    .getByLabel("Código Python")
    .fill("def doble(numero):\n    return numero * 2\nprint(doble(4))");
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await expect(page.getByLabel("Salida del programa")).toHaveText("8");
  await page
    .getByRole("button", { name: /2\. Un saludo reutilizable/ })
    .click();
  await page
    .getByLabel("Código Python")
    .fill(
      'def saludar(nombre):\n    return "Hola, " + nombre\nprint(saludar("Ada"))',
    );
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await expect(
    page.getByText("2 de 2 ejercicios completados", { exact: true }),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: /06 Listas y diccionarios/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /06 Listas y diccionarios/ }).click();
  await expect(
    page.getByRole("heading", { name: "Listas y diccionarios", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dame una pista" }).click();
  await page.getByRole("button", { name: "Otra pista" }).click();
  await expect(page.getByText("Pista 2 de 2")).toBeVisible();
  await page
    .getByLabel("Código Python")
    .fill('frutas = ["pera"]\nprint("pera")');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Todavía no");
  await page
    .getByLabel("Código Python")
    .fill(
      'frutas = ["manzana", "pera"]\nfrutas.append("uva")\nprint(frutas[1])',
    );
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await expect(page.getByLabel("Salida del programa")).toHaveText("pera");
  await page.getByRole("button", { name: /2\. Una ficha con claves/ }).click();
  await page
    .getByLabel("Código Python")
    .fill(
      'persona = {"nombre": "Ada", "edad": 20}\npersona["edad"] = persona["edad"] + 1\nprint(persona["nombre"], persona["edad"])',
    );
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await expect(page.getByLabel("Salida del programa")).toHaveText("Ada 21");
  await expect(
    page.getByText("2 de 2 ejercicios completados", { exact: true }),
  ).toBeVisible();

  await expect(
    page.getByText("12 / 12 ejercicios", { exact: true }),
  ).toBeVisible();
  for (const title of [
    "Valores y variables",
    "Expresiones y salida",
    "Condicionales",
    "Bucles",
    "Funciones",
    "Listas y diccionarios",
  ]) {
    const topicButton = page.getByRole("button", {
      name: new RegExp(title + " Completado"),
    });
    await expect(topicButton).toBeVisible();
    await topicButton.click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("2 de 2 ejercicios completados", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /1\..*Completado/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /2\..*Completado/ }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Volver a cursos" }).click();
  await expect(
    page.getByText("100% · 12 / 12 ejercicios aprobados", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Cursos y rutas de aprendizaje" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Explorar Primeros pasos con Python" })
    .click();
  await expect(
    page.getByText("100% · 12 / 12 ejercicios aprobados", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ver temas de Python Fundamentos" })
    .click();
  await page.getByRole("button", { name: "Repasar curso" }).click();
  await expect(
    page.getByRole("heading", { name: "Listas y diccionarios", exact: true }),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "Comenzar evaluación final" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Comenzar evaluación final" }).click();
  await expect(
    page.getByRole("heading", { name: "Evaluación final", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ver resultado" }),
  ).toBeDisabled();
  const answers = [
    "Guarda el valor 7 en edad",
    "14",
    "Puede entrar",
    "1, 2 y 3",
    "Devuelve un valor a quien llama",
    "Ada",
  ];
  for (const [index, answer] of answers.entries()) {
    await page
      .getByRole("group")
      .nth(index)
      .getByRole("radio", { name: answer, exact: true })
      .check();
  }
  await page.getByRole("button", { name: "Ver resultado" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu resultado: 5 de 6", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Respuesta correcta: 10", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Cursos y rutas de aprendizaje" }),
  ).toBeVisible();
  await enterCourse(page);
  await page.getByRole("button", { name: "Ver evaluación final" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu resultado: 5 de 6", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("group")
      .nth(1)
      .getByRole("radio", { name: "14", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByText("Respuesta correcta: 10", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Intentar de nuevo" }).click();
  for (const [index, answer] of answers.entries()) {
    await page
      .getByRole("group")
      .nth(index)
      .getByRole("radio", { name: index === 1 ? "10" : answer, exact: true })
      .check();
  }
  await page.getByRole("button", { name: "Ver resultado" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu resultado: 6 de 6", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Volver a las lecciones" }).click();
  await expect(
    page.getByRole("heading", { name: "Listas y diccionarios", exact: true }),
  ).toBeVisible();
  const previousPage = page;
  page = await page.context().newPage();
  await previousPage.close();
  await page.goto("/");
  await enterCourse(page);
  await expect(
    page.getByRole("heading", { name: "Listas y diccionarios", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("12 / 12 ejercicios", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ver evaluación final" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu resultado: 6 de 6", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reiniciar progreso", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tu resultado: 6 de 6", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reiniciar progreso", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sí, reiniciar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Valores y variables", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("0 / 12 ejercicios", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Completado/ })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Cursos y rutas de aprendizaje" }),
  ).toBeVisible();
  await enterCourse(page);
  await expect(
    page.getByRole("heading", { name: "Valores y variables", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("0 / 12 ejercicios", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /06 Listas y diccionarios/ }).click();
  await page.getByRole("button", { name: "Comenzar evaluación final" }).click();
  await expect(
    page.getByRole("heading", { name: /Tu resultado:/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);

  await page.getByRole("group").first().getByRole("radio").first().check();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Cursos y rutas de aprendizaje" }),
  ).toBeVisible();
  await enterCourse(page);
  await page.getByRole("button", { name: "Comenzar evaluación final" }).click();
  await expect(
    page.getByRole("heading", { name: "Evaluación final", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);

  // Fault injection stays at the browser-storage boundary; assertions use the UI.
  for (const damaged of ["{damaged JSON", "{}"]) {
    await page.evaluate(
      (value) => localStorage.setItem("python-tutor:course-progress:v1:python-fundamentos", value),
      damaged,
    );
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Cursos y rutas de aprendizaje" }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("No se pudo recuperar");
    await enterCourse(page);
    await expect(
      page.getByText("0 / 12 ejercicios", { exact: true }),
    ).toBeVisible();
  }
  // A full or blocked store must leave the learning flow usable and report failure.
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Cursos y rutas de aprendizaje" }),
  ).toBeVisible();
  await enterCourse(page);
  await expect(page.getByRole("alert")).toContainText("No se pudo guardar");
  await page.getByRole("button", { name: /02 Expresiones y salida/ }).click();
  await expect(
    page.getByRole("heading", { name: "Expresiones y salida", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reiniciar progreso", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sí, reiniciar", exact: true })
    .click();
  await expect(page.getByRole("alert")).not.toContainText(
    "el progreso anterior podría reaparecer",
  );
  await expect(
    page.getByRole("heading", { name: "Valores y variables", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Cursos y rutas de aprendizaje" }),
  ).toBeVisible();
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
    Storage.prototype.removeItem = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Cursos y rutas de aprendizaje" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toBeVisible();
  await enterCourse(page);
  await expect(
    page.getByRole("heading", { name: "Valores y variables", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reiniciar progreso", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sí, reiniciar", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "el progreso anterior podría reaparecer",
  );
  await expect(
    page.getByRole("heading", { name: "Valores y variables", exact: true }),
  ).toBeVisible();
});
