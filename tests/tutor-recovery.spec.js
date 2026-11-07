import { test, expect } from "@playwright/test";
import { setup, frame } from "./fixtures/tutor.js";
import { streamingOpenRouter } from "./fixtures/openrouter.js";
test.use({ actionTimeout: 8000, ignoreHTTPSErrors: true });

test("explicit retry keeps original capture, one question and previous incomplete partial", async ({
  page,
}) => {
  await setup(page);
  const fixture = await streamingOpenRouter(page);
  try {
    await page.getByLabel("Código Python").fill("# original");
    await page.getByLabel("Mensaje al tutor").fill("Pregunta original");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(() => fixture.responses.length).toBe(1);
    fixture.responses[0].end(frame("Pista parcial") + frame("", "length"));
    await expect(page.getByText(/límite de salida/)).toBeVisible();
    await page.getByLabel("Código Python").fill("# editado después");
    await page
      .getByRole("button", { name: "Reintentar respuesta", exact: true })
      .click();
    await expect.poll(() => fixture.responses.length).toBe(2);
    await expect(
      page.getByRole("button", { name: "Reintentar respuesta", exact: true }),
    ).toBeDisabled();
    await page.getByLabel("Mensaje al tutor").fill("No enviar mientras genera");
    await page.getByLabel("Mensaje al tutor").press("Enter");
    expect(fixture.requests).toHaveLength(2);
    expect(fixture.requests[1]).toEqual(fixture.requests[0]);
    await expect(
      page.getByText("Pregunta original", { exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByText("Pista parcial", { exact: true }),
    ).toBeVisible();
    fixture.responses[1].end(frame("Pista terminada") + frame("", "stop"));
    await expect(
      page.getByText("Respuesta completa", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/límite de salida/)).toBeVisible();
    await page.getByLabel("Mensaje al tutor").fill("Pregunta nueva");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(() => fixture.responses.length).toBe(3);
    expect(
      JSON.parse(fixture.requests[2].messages.at(-1).content).capture.draft,
    ).toBe("# editado después");
    fixture.responses[2].end(frame("Nueva respuesta") + frame("", "stop"));
  } finally {
    await fixture.close();
  }
});

test("a rejected key inside HTTP 200 preserves partial and blocks sends until corrected", async ({
  page,
}) => {
  const requests = await setup(page);
  await page.route("https://openrouter.ai/api/v1/chat/completions", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({
      contentType: "text/event-stream",
      body:
        frame("Antes del rechazo") +
        'data: {"error":{"code":401,"message":"Invalid API key"}}\n\n',
    });
  });
  await page.getByLabel("Mensaje al tutor").fill("Ayúdame");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText("Antes del rechazo", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Respuesta incompleta: OpenRouter rechazó la clave/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviar", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Reintentar respuesta", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Código Python").fill("# práctica sigue disponible");
  expect(requests).toHaveLength(1);
  await page
    .getByRole("button", { name: "Configuración del tutor", exact: true })
    .click();
  await page.getByLabel("Clave de OpenRouter").fill("sk-or-corrected");
  await page
    .getByRole("button", { name: "Validar clave", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Guardar y volver al tutor", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Enviar", exact: true }),
  ).toBeEnabled();
  expect(requests).toHaveLength(1);
});

for (const scenario of [
  {
    name: "balance error-only SSE",
    code: 402,
    message: "Insufficient credits",
    text: /saldo insuficiente/,
    sse: true,
  },
  {
    name: "model retired",
    code: 404,
    message: "Model not found",
    text: /modelo ya no está disponible/,
    blocked: true,
  },
  {
    name: "canonical context rejection",
    code: 400,
    message: "Request rejected",
    metadata: { error_type: "context_length_exceeded" },
    text: /capacidad de contexto/,
  },
  {
    name: "service unavailable",
    code: 503,
    message: "Unavailable",
    text: /servicio de OpenRouter no está disponible/,
  },
  {
    name: "rate limited",
    code: 429,
    message: "Rate limit exceeded",
    text: /límite de solicitudes/,
  },
  {
    name: "non-auth 403",
    code: 403,
    message: "Content moderation",
    metadata: { error_type: "moderation" },
    text: /servicio rechazó la solicitud/,
  },
  {
    name: "unclassified 400",
    code: 400,
    message: "Bad request",
    text: /servicio rechazó la solicitud/,
  },
])
  test(`explains ${scenario.name} without automatic resend or model substitution`, async ({
    page,
  }) => {
    const requests = await setup(page);
    await page.route(
      "https://openrouter.ai/api/v1/chat/completions",
      (route) => {
        requests.push(route.request().postDataJSON());
        const error = {
          code: scenario.code,
          message: scenario.message,
          metadata: scenario.metadata,
        };
        return route.fulfill(
          scenario.sse
            ? {
                contentType: "text/event-stream",
                body: "data: " + JSON.stringify({ error }) + "\n\n",
              }
            : { status: scenario.code, json: { error } },
        );
      },
    );
    await page.getByLabel("Código Python").fill("# no recortar");
    await page.getByLabel("Mensaje al tutor").fill("Ayuda sin cambiar modelo");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(page.getByText(scenario.text).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Detener", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Enviar", exact: true }))[
      scenario.blocked ? "toBeDisabled" : "toBeEnabled"
    ]();
    expect(requests).toHaveLength(1);
    expect(requests[0].model).toBe("example/tutor");
    expect(requests[0].models).toBeUndefined();
    expect(JSON.parse(requests[0].messages.at(-1).content).capture.draft).toBe(
      "# no recortar",
    );
  });

test("uses the declared alternate output limit parameter", async ({ page }) => {
  const { model } = await import("./fixtures/tutor.js");
  const requests = await setup(page, {
    ...model,
    supported_parameters: ["max_completion_tokens"],
  });
  await page.getByLabel("Mensaje al tutor").fill("Una pista");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText("Respuesta completa", { exact: true }),
  ).toBeVisible();
  expect(requests[0].max_completion_tokens).toBe(1024);
  expect(requests[0].max_tokens).toBeUndefined();
});

test("a network disconnect keeps received text and never retries automatically", async ({
  page,
}) => {
  await setup(page);
  const fixture = await streamingOpenRouter(page);
  try {
    await page.getByLabel("Mensaje al tutor").fill("Ayuda");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(() => fixture.responses.length).toBe(1);
    fixture.responses[0].write(frame("Texto antes del corte"));
    await expect(
      page.getByText("Texto antes del corte", { exact: true }),
    ).toBeVisible();
    fixture.responses[0].destroy();
    await expect(page.getByText(/conexión de red/)).toBeVisible();
    expect(fixture.requests).toHaveLength(1);
    await expect(
      page.getByRole("button", { name: "Reintentar respuesta", exact: true }),
    ).toBeEnabled();
  } finally {
    await fixture.close();
  }
});

test("a sixty second time limit closes transport, keeps partial and allows explicit retry", async ({
  page,
}) => {
  await setup(page);
  await page.clock.install();
  const fixture = await streamingOpenRouter(page);
  try {
    await page.getByLabel("Mensaje al tutor").fill("Ayuda");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(() => fixture.responses.length).toBe(1);
    fixture.responses[0].write(frame("Texto antes de esperar"));
    await expect(
      page.getByText("Texto antes de esperar", { exact: true }),
    ).toBeVisible();
    await page.clock.fastForward(60001);
    await expect(page.getByText(/límite temporal/)).toBeVisible();
    await expect.poll(() => fixture.closed).toBe(1);
    expect(fixture.requests).toHaveLength(1);
    await expect(
      page.getByRole("button", { name: "Reintentar respuesta", exact: true }),
    ).toBeEnabled();
  } finally {
    await fixture.close();
  }
});

test("late stop frames cannot complete a cancelled attempt or affect the single active retry", async ({
  page,
}) => {
  await setup(page);
  const fixture = await streamingOpenRouter(page);
  try {
    await page
      .getByLabel("Mensaje al tutor")
      .fill("Pregunta que se interrumpe");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(() => fixture.responses.length).toBe(1);
    fixture.responses[0].write(frame("Parcial antiguo"));
    await expect(
      page.getByText("Parcial antiguo", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Detener", exact: true }).click();
    await expect.poll(() => fixture.closed).toBe(1);
    const retry = page.getByRole("button", {
      name: "Reintentar respuesta",
      exact: true,
    });
    await retry.press("Enter");
    await retry.press("Enter");
    await expect.poll(() => fixture.responses.length).toBe(2);
    fixture.responses[0].end(
      frame("Evento antiguo tardío") + frame("", "stop"),
    );
    fixture.responses[1].write(frame("Parcial nuevo"));
    await expect(
      page.getByText("Parcial nuevo", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Detener", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Respuesta interrumpida/)).toBeVisible();
    await expect(
      page.getByText("Evento antiguo tardío", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Respuesta completa", { exact: true }),
    ).toHaveCount(0);
    expect(fixture.requests).toHaveLength(2);
    fixture.responses[1].end(
      frame("", "stop") + frame("", "stop") + "data: [DONE]\n\n",
    );
    await expect(
      page.getByText("Respuesta completa", { exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByText("Pregunta que se interrumpe", { exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByText("Parcial antiguo", { exact: true }),
    ).toBeVisible();
  } finally {
    await fixture.close();
  }
});

test("generation model rejection requires explicit selection before saving access", async ({
  page,
}) => {
  await setup(page);
  await page.route("https://openrouter.ai/api/v1/chat/completions", (route) =>
    route.fulfill({
      status: 404,
      json: { error: { code: 404, message: "Model not found" } },
    }),
  );
  await page.getByLabel("Mensaje al tutor").fill("Ayuda");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText(/Respuesta incompleta: El modelo ya no está disponible/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviar", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Configuración del tutor", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Validar clave", exact: true })
    .click();
  await expect(
    page.getByText("Credenciales válidas", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Guardar y volver al tutor" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Tutor de prueba/ }).click();
  await page.getByRole("button", { name: "Guardar y volver al tutor" }).click();
  await expect(
    page.getByRole("button", { name: "Enviar", exact: true }),
  ).toBeEnabled();
});
