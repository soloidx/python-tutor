import { test, expect, enterCourse } from "./fixtures/catalog.js";
import { setup, frame } from "./fixtures/tutor.js";
import { streamingOpenRouter } from "./fixtures/openrouter.js";

test.use({ actionTimeout: 8000, ignoreHTTPSErrors: true });
async function tutor(page) {
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Enviar", exact: true }),
  ).toBeEnabled();
}
async function send(page, message) {
  await page.getByLabel("Mensaje al tutor").fill(message);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Enviar", exact: true }),
  ).toBeEnabled();
}
async function topic(page, number) {
  await page
    .getByRole("button", {
      name: number === 1 ? /01 Valores y variables/ : /02 Expresiones y salida/,
    })
    .click();
  await tutor(page);
}
async function openDelete(page) {
  await page
    .getByRole("button", { name: "Borrar conversación del tema", exact: true })
    .click();
  return page.getByRole("group", { name: "Confirmar borrado de conversación" });
}

test("deletes only the confirmed topic conversation and keeps other history, progress and access after reload", async ({
  page,
}) => {
  const requests = await setup(page);
  await page
    .getByLabel("Código Python")
    .fill('nombre = "Ada"\nprint("Hola, " + nombre)');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("¡Correcto!");
  await send(page, "Pregunta del primer tema");
  await topic(page, 2);
  await send(page, "Pregunta del segundo tema");
  await topic(page, 1);
  let confirmation = await openDelete(page);
  await expect(confirmation).toContainText("Valores y variables");
  await expect(confirmation).toContainText(
    "preguntas, respuestas, parciales y capturas",
  );
  await confirmation
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  await expect(
    page.getByText("Pregunta del primer tema", { exact: true }),
  ).toBeVisible();
  confirmation = await openDelete(page);
  await confirmation
    .getByRole("button", { name: "Sí, borrar conversación", exact: true })
    .click();
  await expect(
    page.getByText("Pregunta del primer tema", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("1 / 12 ejercicios", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await enterCourse(page);
  await tutor(page);
  await expect(
    page.getByText("Pregunta del primer tema", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("1 / 12 ejercicios", { exact: true }),
  ).toBeVisible();
  await send(page, "Pregunta nueva");
  expect(requests[2].messages).toHaveLength(2);
  await topic(page, 2);
  await expect(
    page.getByText("Pregunta del segundo tema", { exact: true }),
  ).toBeVisible();
  await send(page, "Continuar segundo tema");
  expect(requests[3].messages[1].content).toContain(
    "Pregunta del segundo tema",
  );
  expect(requests[3].model).toBe("example/tutor");
  expect(requests).toHaveLength(4);
});

test("reset confirmation preserves an active response on cancel and removes every topic on confirm despite late events", async ({
  page,
}) => {
  const requests = await setup(page);
  await send(page, "Pregunta del primer tema");
  await topic(page, 2);
  await send(page, "Pregunta del segundo tema");
  const fixture = await streamingOpenRouter(page);
  try {
    await page.getByLabel("Mensaje al tutor").fill("Pregunta activa");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(() => fixture.responses.length).toBe(1);
    fixture.responses[0].write(frame("Parcial antes de confirmar"));
    await expect(
      page.getByText("Parcial antes de confirmar", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Reiniciar progreso", exact: true })
      .click();
    const confirmation = page.getByRole("group", {
      name: "Confirmar reinicio",
    });
    await expect(confirmation).toContainText("todas las conversaciones");
    await expect(confirmation).toContainText("Configuración del tutor");
    await confirmation
      .getByRole("button", { name: "Cancelar", exact: true })
      .click();
    fixture.responses[0].write(frame(" y después de cancelar"));
    await expect(
      page.getByText("Parcial antes de confirmar y después de cancelar", {
        exact: true,
      }),
    ).toBeVisible();
    expect(fixture.closed).toBe(0);
    await page
      .getByRole("button", { name: "Reiniciar progreso", exact: true })
      .click();
    await confirmation
      .getByRole("button", { name: "Sí, reiniciar", exact: true })
      .click();
    await expect.poll(() => fixture.closed).toBe(1);
    fixture.responses[0].end(
      frame(" EVENTO TARDÍO", "stop") + "data: [DONE]\n\n",
    );
    await tutor(page);
    await expect(
      page.getByText("Pregunta del primer tema", { exact: true }),
    ).toHaveCount(0);
    await topic(page, 2);
    await expect(
      page.getByText("Pregunta del segundo tema", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Pregunta activa", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText(/EVENTO TARDÍO/)).toHaveCount(0);
    await page.reload();
    await enterCourse(page);
    await tutor(page);
    await expect(
      page.getByText("Respuesta completa", { exact: true }),
    ).toHaveCount(0);
    await topic(page, 1);
    await expect(
      page.getByText("Pregunta del primer tema", { exact: true }),
    ).toHaveCount(0);
    expect(fixture.requests).toHaveLength(1);
    expect(requests).toHaveLength(2);
    await page.getByLabel("Mensaje al tutor").fill("Tras reiniciar");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(() => fixture.responses.length).toBe(2);
    expect(fixture.requests[1].messages).toHaveLength(2);
    expect(fixture.requests[1].model).toBe("example/tutor");
    fixture.responses[1].end(
      frame("Nueva respuesta", "stop") + "data: [DONE]\n\n",
    );
    await expect(
      page.getByText("Nueva respuesta", { exact: true }),
    ).toBeVisible();
  } finally {
    await fixture.close();
  }
});

test("topic deletion cancels its stream only on confirmation and late events never restore it", async ({
  page,
}) => {
  const requests = await setup(page);
  await send(page, "Conservar otro tema");
  await topic(page, 2);
  const fixture = await streamingOpenRouter(page);
  try {
    await page.getByLabel("Mensaje al tutor").fill("Borrar pregunta activa");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(() => fixture.responses.length).toBe(1);
    fixture.responses[0].write(frame("Parcial por borrar"));
    await expect(
      page.getByText("Parcial por borrar", { exact: true }),
    ).toBeVisible();
    let confirmation = await openDelete(page);
    await confirmation
      .getByRole("button", { name: "Cancelar", exact: true })
      .click();
    fixture.responses[0].write(frame(" todavía activo"));
    await expect(
      page.getByText("Parcial por borrar todavía activo", { exact: true }),
    ).toBeVisible();
    expect(fixture.closed).toBe(0);
    confirmation = await openDelete(page);
    await confirmation
      .getByRole("button", { name: "Sí, borrar conversación", exact: true })
      .click();
    await expect.poll(() => fixture.closed).toBe(1);
    fixture.responses[0].end(
      frame(" EVENTO TARDÍO", "stop") + "data: [DONE]\n\n",
    );
    await expect(
      page.getByText("Borrar pregunta activa", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText(/EVENTO TARDÍO/)).toHaveCount(0);
    await page.reload();
    await enterCourse(page);
    await tutor(page);
    await expect(
      page.getByText("Borrar pregunta activa", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Respuesta completa", { exact: true }),
    ).toHaveCount(0);
    await topic(page, 1);
    await expect(
      page.getByText("Conservar otro tema", { exact: true }),
    ).toBeVisible();
    expect(fixture.requests).toHaveLength(1);
    expect(requests).toHaveLength(1);
  } finally {
    await fixture.close();
  }
});

test("failed topic deletion reports session-only deletion, preserves other topics and can still learn", async ({
  page,
}) => {
  await setup(page);
  await send(page, "Pregunta que podría reaparecer");
  await topic(page, 2);
  await send(page, "Otra conversación intacta");
  await topic(page, 1);
  // Fault injection at the browser storage boundary, with no app collaborator replaced.
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
    Storage.prototype.removeItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  const confirmation = await openDelete(page);
  await confirmation
    .getByRole("button", { name: "Sí, borrar conversación", exact: true })
    .click();
  await expect(
    page.getByText("Pregunta que podría reaparecer", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText(
    "Se borró la conversación de este tema en esta sesión",
  );
  await expect(page.getByRole("alert")).toContainText(
    "podría reaparecer al recargar",
  );
  await send(page, "Continuar temporalmente");
  await expect(page.getByRole("alert")).toContainText(
    "podría reaparecer al recargar",
  );
  await topic(page, 2);
  await expect(
    page.getByText("Otra conversación intacta", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await enterCourse(page);
  await topic(page, 1);
  await expect(
    page.getByText("Pregunta que podría reaparecer", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Continuar temporalmente", { exact: true }),
  ).toHaveCount(0);
});

for (const [failHistory, failProgress] of [
  [true, false],
  [false, true],
  [true, true],
])
  test(`reset reports independent persistence outcomes: history=${failHistory}, progress=${failProgress}`, async ({
    page,
  }) => {
    const requests = await setup(page);
    await page
      .getByLabel("Código Python")
      .fill('nombre = "Ada"\nprint("Hola, " + nombre)');
    await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("¡Correcto!");
    await send(page, "Pregunta antes del reinicio");
    await topic(page, 2);
    await page.evaluate(
      ({ failHistory, failProgress }) => {
        // Identify a browser record by student-authored content, without assuming keys or schema.
        const conversationRecord = Object.keys(localStorage).find((record) =>
          localStorage.getItem(record).includes("Pregunta antes del reinicio"),
        );
        for (const method of ["setItem", "removeItem"]) {
          const original = Storage.prototype[method];
          Storage.prototype[method] = function (record, ...args) {
            if (record === conversationRecord ? failHistory : failProgress)
              throw new DOMException("Blocked", "SecurityError");
            return original.call(this, record, ...args);
          };
        }
      },
      { failHistory, failProgress },
    );
    await page
      .getByRole("button", { name: "Reiniciar progreso", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Sí, reiniciar", exact: true })
      .click();
    const warning = page
      .getByRole("region", { name: "Progreso guardado" })
      .getByRole("alert");
    await expect(warning).toContainText(
      failHistory
        ? "Se borraron todas las conversaciones en esta sesión"
        : "No se pudo borrar el progreso guardado",
    );
    if (failProgress)
      await expect(warning).toContainText(
        "el progreso anterior podría reaparecer",
      );
    else
      await expect(warning).not.toContainText(
        "el progreso anterior podría reaparecer",
      );
    if (!failHistory)
      await expect(warning).not.toContainText("el historial guardado");
    await expect(
      page.getByText("0 / 12 ejercicios", { exact: true }),
    ).toBeVisible();
    await tutor(page);
    await expect(
      page.getByText("Pregunta antes del reinicio", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Enviar", exact: true }),
    ).toBeEnabled();
    expect(requests).toHaveLength(1);
    await page.reload();
    await enterCourse(page);
    await topic(page, 1);
    await expect(
      page.getByText("Pregunta antes del reinicio", { exact: true }),
    ).toHaveCount(failHistory ? 1 : 0);
    await expect(
      page.getByText(`${failProgress ? 1 : 0} / 12 ejercicios`, {
        exact: true,
      }),
    ).toBeVisible();
    expect(requests).toHaveLength(1);
  });

for (const blocked of ["setItem", "removeItem"])
  test(`reset persists deletion when only ${blocked} fails`, async ({
    page,
  }) => {
    await setup(page);
    await send(page, "Pregunta que no debe volver");
    await page.evaluate((method) => {
      Storage.prototype[method] = () => {
        throw new DOMException("Blocked", "SecurityError");
      };
    }, blocked);
    await page
      .getByRole("button", { name: "Reiniciar progreso", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Sí, reiniciar", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: /podría reaparecer/ }),
    ).toHaveCount(0);
    await page.reload();
    await enterCourse(page);

    await tutor(page);
    await expect(
      page.getByText("Pregunta que no debe volver", { exact: true }),
    ).toHaveCount(0);
  });

test("deletion and reset preserve the explicitly chosen session-only configuration", async ({
  page,
}) => {
  const requests = await setup(page);
  const authorization = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/chat/completions"))
      authorization.push(request.headers().authorization);
  });
  await page
    .getByRole("button", { name: "Configuración del tutor", exact: true })
    .click();
  await page.getByLabel("Clave de OpenRouter").fill("sk-or-temporary");
  await page
    .getByRole("button", { name: "Validar clave", exact: true })
    .click();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page
    .getByRole("button", { name: "Guardar y volver al tutor", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Usar solo en esta sesión", exact: true })
    .click();
  await send(page, "Antes de borrar con acceso temporal");
  const confirmation = await openDelete(page);
  await confirmation
    .getByRole("button", { name: "Sí, borrar conversación", exact: true })
    .click();
  await expect(
    page.getByText(
      /Solo en esta sesión\. La configuración se perderá al recargar/,
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reiniciar progreso", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sí, reiniciar", exact: true })
    .click();
  await tutor(page);
  await expect(
    page.getByText(
      /Solo en esta sesión\. La configuración se perderá al recargar/,
    ),
  ).toBeVisible();
  await send(page, "Después del reinicio con acceso temporal");
  expect(requests[1].messages).toHaveLength(2);
  expect(requests[1].model).toBe("example/tutor");
  expect(authorization).toEqual([
    "Bearer sk-or-temporary",
    "Bearer sk-or-temporary",
  ]);
});
