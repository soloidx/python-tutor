import { test, expect, enterCourse } from "./fixtures/catalog.js";
import { setup, frame, model } from "./fixtures/tutor.js";
import { streamingOpenRouter } from "./fixtures/openrouter.js";

test.use({ actionTimeout: 8000, ignoreHTTPSErrors: true });
const configure = (page) =>
  page
    .getByRole("button", { name: "Configuración del tutor", exact: true })
    .click();
const send = async (page, message) => {
  await page.getByLabel("Mensaje al tutor").fill(message);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
};
const tutor = (page) =>
  page.getByRole("tab", { name: "Tutor", exact: true }).click();

test("confirmed key removal interrupts streaming, blocks access and preserves model and conversation after reload", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await streamingOpenRouter(page);
  try {
    await send(page, "Mi pregunta conservada");
    await expect.poll(() => fixture.responses.length).toBe(1);
    fixture.responses[0].write(frame("Mi parcial conservado"));
    await expect(
      page.getByText("Mi parcial conservado", { exact: true }),
    ).toBeVisible();
    await configure(page);
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toMatch(/modelo.*conversaciones/i);
      await dialog.dismiss();
    });
    await page
      .getByRole("button", { name: "Eliminar clave", exact: true })
      .click();
    expect(fixture.closed).toBe(0);
    await expect(page.getByLabel("Clave de OpenRouter")).toHaveValue(
      "sk-or-fictitious",
    );
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Eliminar clave", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect.poll(() => fixture.closed).toBe(1);
    fixture.responses[0].end(frame("Tardío no permitido") + frame("", "stop"));
    await expect(page.getByText(/Respuesta interrumpida/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Enviar", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText("Tardío no permitido", { exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await enterCourse(page);
    await tutor(page);
    await expect(
      page.getByText("Mi pregunta conservada", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Mi parcial conservado", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Enviar", exact: true }),
    ).toBeDisabled();
    await configure(page);
    await expect(page.getByLabel("Clave de OpenRouter")).toHaveValue("");
    await expect(
      page.getByText("Modelo seleccionado: Tutor de prueba", { exact: true }),
    ).toBeVisible();
    expect(fixture.requests).toHaveLength(1);
  } finally {
    await fixture.close();
  }
});

test("failed key removal reports possible return after reload while blocking this session and permits retry", async ({
  page,
}) => {
  await setup(page);
  await send(page, "Historial antes de retirar acceso");
  await expect(
    page.getByText("Respuesta completa", { exact: true }),
  ).toBeVisible();
  // Browser storage is a system boundary, not an application substitute.
  await page.evaluate(() => {
    window.savedSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function () {
      throw new DOMException("denied", "SecurityError");
    };
  });
  await configure(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Eliminar clave", exact: true })
    .click();
  await expect(
    page.getByText(/No se pudo retirar la clave guardada/),
  ).toBeVisible();
  await expect(page.getByText(/podría volver al recargar/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviar", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Historial antes de retirar acceso", { exact: true }),
  ).toBeVisible();
  await configure(page);
  await expect(page.getByLabel("Clave de OpenRouter")).toHaveValue("");
  await expect(
    page.getByText("Modelo seleccionado: Tutor de prueba", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.setItem = window.savedSetItem;
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Eliminar clave", exact: true })
    .click();
  await expect(page.getByText(/^Clave eliminada\./)).toBeVisible();
  await page.reload();
  await enterCourse(page);
  await tutor(page);
  await expect(
    page.getByRole("button", { name: "Enviar", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Historial antes de retirar acceso", { exact: true }),
  ).toBeVisible();
});

test("pending, failed and cancelled settings leave streaming intact; a valid save cancels before the next request uses new access", async ({
  page,
}) => {
  await setup(page);
  const replacement = {
    ...model,
    id: "example/replacement",
    name: "Modelo elegido después",
  };
  await page.route("https://openrouter.ai/api/v1/models/user", (route) =>
    route.fulfill({ json: { data: [model, replacement] } }),
  );
  await page.route("https://openrouter.ai/api/v1/key", (route) =>
    route.fulfill(
      route.request().headers().authorization === "Bearer sk-or-invalid"
        ? { status: 401, json: { error: { message: "invalid" } } }
        : { json: { data: {} } },
    ),
  );
  const authorizations = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/chat/completions"))
      authorizations.push(request.headers().authorization);
  });
  const fixture = await streamingOpenRouter(page);
  try {
    await page.getByLabel("Código Python").fill("# captura original");
    await send(page, "Pregunta antes del cambio");
    await expect.poll(() => fixture.responses.length).toBe(1);
    fixture.responses[0].write(frame("Parcial inicial"));
    await expect(
      page.getByText("Parcial inicial", { exact: true }),
    ).toBeVisible();
    await configure(page);
    await page.getByLabel("Clave de OpenRouter").fill("sk-or-invalid");
    await page
      .getByRole("button", { name: "Validar clave", exact: true })
      .click();
    await expect(
      page.getByRole("dialog").getByText(/Clave rechazada/),
    ).toBeVisible();
    expect(fixture.closed).toBe(0);
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(
      page.getByText(/Acceso listo · Tutor de prueba/),
    ).toBeVisible();
    fixture.responses[0].write(frame(" y sigue activa"));
    await expect(
      page.getByText("Parcial inicial y sigue activa", { exact: true }),
    ).toBeVisible();
    await configure(page);
    await expect(page.getByLabel("Clave de OpenRouter")).toHaveValue(
      "sk-or-fictitious",
    );
    await page.getByLabel("Clave de OpenRouter").fill("sk-or-replacement");
    await page.keyboard.press("Escape");
    expect(fixture.closed).toBe(0);
    await configure(page);
    await expect(page.getByLabel("Clave de OpenRouter")).toHaveValue(
      "sk-or-fictitious",
    );
    await page.getByLabel("Clave de OpenRouter").fill("sk-or-replacement");
    await page
      .getByRole("button", { name: "Validar clave", exact: true })
      .click();
    await page.getByRole("button", { name: /Modelo elegido después/ }).click();
    expect(fixture.closed).toBe(0);
    await page
      .getByRole("button", { name: "Guardar y volver al tutor" })
      .click();
    await expect.poll(() => fixture.closed).toBe(1);
    await expect(page.getByText(/Respuesta interrumpida/)).toBeVisible();
    expect(fixture.requests).toHaveLength(1);
    await send(page, "Pregunta con acceso nuevo");
    await expect.poll(() => fixture.responses.length).toBe(2);
    expect(authorizations).toEqual([
      "Bearer sk-or-fictitious",
      "Bearer sk-or-replacement",
    ]);
    expect(fixture.requests[1].model).toBe(replacement.id);
    expect(fixture.requests[1].messages).toHaveLength(2);
    fixture.responses[0].end(frame("Evento antiguo") + frame("", "stop"));
    fixture.responses[1].end(
      frame("Respuesta del nuevo acceso") + frame("", "stop"),
    );
    await expect(
      page.getByText("Respuesta completa", { exact: true }),
    ).toHaveCount(1);
    await expect(page.getByText("Evento antiguo", { exact: true })).toHaveCount(
      0,
    );
    await page.reload();
    await enterCourse(page);
    await tutor(page);
    await expect(
      page.getByText(/Acceso listo · Modelo elegido después/),
    ).toBeVisible();
    await expect(
      page.getByText("Parcial inicial y sigue activa", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Respuesta del nuevo acceso", { exact: true }),
    ).toBeVisible();
    await configure(page);
    await expect(page.getByLabel("Clave de OpenRouter")).toHaveValue(
      "sk-or-replacement",
    );
    expect(fixture.requests).toHaveLength(2);
  } finally {
    await fixture.close();
  }
});

test("failed persistence during streaming applies access only after explicit session choice and recovers previous saved access on reload", async ({
  page,
}) => {
  await setup(page);
  const fixture = await streamingOpenRouter(page);
  try {
    await send(page, "Conservar mientras elijo");
    await expect.poll(() => fixture.responses.length).toBe(1);
    fixture.responses[0].write(frame("Parcial en memoria"));
    await expect(
      page.getByText("Parcial en memoria", { exact: true }),
    ).toBeVisible();
    await configure(page);
    await page.getByLabel("Clave de OpenRouter").fill("sk-or-temporary");
    await page
      .getByRole("button", { name: "Validar clave", exact: true })
      .click();
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (value.includes("sk-or-temporary"))
          throw new DOMException("full", "QuotaExceededError");
        return original.call(this, key, value);
      };
    });
    await page
      .getByRole("button", { name: "Guardar y volver al tutor" })
      .click();
    await expect(
      page.getByRole("dialog").getByText(/No se pudo guardar la configuración/),
    ).toBeVisible();
    expect(fixture.closed).toBe(0);
    expect(fixture.requests).toHaveLength(1);
    await page
      .getByRole("button", { name: "Usar solo en esta sesión", exact: true })
      .click();
    await expect.poll(() => fixture.closed).toBe(1);
    await expect(page.getByText(/Solo en esta sesión/)).toBeVisible();
    await expect(
      page.getByText(/configuración guardada anteriormente.*recuperar/i),
    ).toBeVisible();
    await expect(page.getByText(/Respuesta interrumpida/)).toBeVisible();
    await configure(page);
    await expect(page.getByLabel("Clave de OpenRouter")).toHaveValue(
      "sk-or-temporary",
    );
    await page.keyboard.press("Escape");
    await page.reload();
    await enterCourse(page);
    await tutor(page);
    await expect(
      page.getByText("Parcial en memoria", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Acceso listo/)).toBeVisible();
    await configure(page);
    await expect(page.getByLabel("Clave de OpenRouter")).toHaveValue(
      "sk-or-fictitious",
    );
    expect(fixture.requests).toHaveLength(1);
  } finally {
    await fixture.close();
  }
});

test("save-time model rejection retains the previous access and uninterrupted response", async ({
  page,
}) => {
  await setup(page);
  const fixture = await streamingOpenRouter(page);
  try {
    await send(page, "Respuesta que debe continuar");
    await expect.poll(() => fixture.responses.length).toBe(1);
    fixture.responses[0].write(frame("Antes de comprobar modelo"));
    await expect(
      page.getByText("Antes de comprobar modelo", { exact: true }),
    ).toBeVisible();
    await configure(page);
    await page.getByLabel("Clave de OpenRouter").fill("sk-or-pending");
    await page
      .getByRole("button", { name: "Validar clave", exact: true })
      .click();
    await expect(
      page.getByText("Credenciales válidas", { exact: true }),
    ).toBeVisible();
    await page.route("https://openrouter.ai/api/v1/models/user", (route) =>
      route.fulfill({ json: { data: [] } }),
    );
    await page
      .getByRole("button", { name: "Guardar y volver al tutor" })
      .click();
    await expect(
      page.getByText(/El modelo seleccionado ya no está disponible/),
    ).toBeVisible();
    expect(fixture.closed).toBe(0);
    await expect(
      page.getByRole("button", { name: "Guardar y volver al tutor" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    fixture.responses[0].end(
      frame(" y terminó con acceso anterior") + frame("", "stop"),
    );
    await expect(
      page.getByText("Respuesta completa", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/Acceso listo · Tutor de prueba/),
    ).toBeVisible();
    await configure(page);
    await expect(page.getByLabel("Clave de OpenRouter")).toHaveValue(
      "sk-or-fictitious",
    );
    await expect(
      page.getByText("Modelo seleccionado: Tutor de prueba", { exact: true }),
    ).toBeVisible();
    expect(fixture.requests).toHaveLength(1);
  } finally {
    await fixture.close();
  }
});

test("a failed removal warns honestly when saved access returns after reload", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("denied", "SecurityError");
    };
  });
  await configure(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Eliminar clave", exact: true })
    .click();
  await expect(page.getByText(/podría volver al recargar/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviar", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await enterCourse(page);
  await tutor(page);
  await expect(page.getByText(/Acceso listo · Tutor de prueba/)).toBeVisible();
  await configure(page);
  await expect(page.getByLabel("Clave de OpenRouter")).toHaveValue(
    "sk-or-fictitious",
  );
});
