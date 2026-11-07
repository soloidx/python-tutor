import { streamingOpenRouter } from "./fixtures/openrouter.js";
import { test, expect } from "@playwright/test";

test.use({ actionTimeout: 8000, ignoreHTTPSErrors: true });
const model = {
  id: "example/tutor",
  name: "Tutor de prueba",
  context_length: 32768,
  architecture: { input_modalities: ["text"], output_modalities: ["text"] },
  supported_parameters: ["max_tokens"],
  top_provider: { max_completion_tokens: 1024 },
};
const frame = (text, finish = null) =>
  `data: ${JSON.stringify({ id: "test", object: "chat.completion.chunk", created: 1, model: model.id, choices: [{ index: 0, delta: { content: text }, finish_reason: finish }] })}\n\n`;
async function setup(
  page,
  metadata = model,
  answer = "Observa la variable.\n```python\nprint(nombre)\n```",
  finish = "stop",
) {
  const requests = [];
  await page.route("https://openrouter.ai/api/v1/**", async (route) => {
    if (route.request().url().endsWith("/chat/completions")) {
      requests.push(route.request().postDataJSON());
      await route.fulfill({
        contentType: "text/event-stream",
        body: frame(answer) + frame("", finish) + "data: [DONE]\n\n",
      });
    } else
      await route.fulfill({
        json: {
          data: route.request().url().endsWith("/key") ? {} : [metadata],
        },
      });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Comenzar ruta" }).click();
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  await page.getByLabel("Clave de OpenRouter").fill("sk-or-fictitious");
  await page
    .getByRole("button", { name: "Validar clave", exact: true })
    .click();
  await page.getByRole("button", { name: /Tutor de prueba/ }).click();
  await page.getByRole("button", { name: "Guardar y volver al tutor" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Tutor", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  return requests;
}

test("sends a Spanish tutor policy and allowed context through real LangChain; copies without editing or executing", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const requests = await setup(page);
  await page
    .getByLabel("Código Python")
    .fill('# mi borrador\nprint("borrador")');
  await page.getByLabel("Mensaje al tutor").fill("No entiendo");
  await page.getByLabel("Mensaje al tutor").press("Shift+Enter");
  await page.getByLabel("Mensaje al tutor").press("Enter");
  await expect(
    page.getByText("Respuesta completa", { exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    model: model.id,
    max_tokens: 1024,
    stream: true,
  });
  expect(requests[0].tools).toBeUndefined();
  expect(requests[0].messages[0].content).toContain("español");
  expect(requests[0].messages[0].content).toContain("petición explícita");
  const sent = JSON.parse(requests[0].messages.at(-1).content);
  expect(sent.message).toBe("No entiendo\n");
  expect(sent.capture).toMatchObject({
    topic: { id: "valores-variables" },
    exercise: { id: "saludo" },
    draft: '# mi borrador\nprint("borrador")',
    lastResult: null,
  });
  expect(JSON.stringify(sent)).not.toContain("_output");
  expect(JSON.stringify(sent)).not.toContain("Escribe nombre =");
  await page.getByRole("button", { name: "Copiar código" }).click();
  await expect(page.getByText("Código copiado", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "print(nombre)\n",
  );
  await expect(page.getByLabel("Código Python")).toHaveValue(
    '# mi borrador\nprint("borrador")',
  );
  await expect(page.getByLabel("Salida del programa")).toContainText(
    "Tu salida aparecerá",
  );
});

test("records the code behind an earlier result and refreshes the next context without borrowing another exercise result", async ({
  page,
}) => {
  const requests = await setup(page);
  await expect(
    page.getByRole("button", { name: "Ejecutar", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Código Python").fill('print("anterior")');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByLabel("Salida del programa")).toHaveText("anterior");
  await page.getByLabel("Código Python").fill('print("nuevo")');
  await page.getByLabel("Mensaje al tutor").fill("Explica mi resultado");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText("Respuesta completa", { exact: true }),
  ).toHaveCount(1);
  expect(
    JSON.parse(requests[0].messages.at(-1).content).capture.lastResult,
  ).toEqual({
    output: "anterior",
    error: null,
    previous: true,
    code: 'print("anterior")',
  });
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByLabel("Salida del programa")).toHaveText("nuevo");
  await page.getByLabel("Mensaje al tutor").fill("Ahora");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText("Respuesta completa", { exact: true }),
  ).toHaveCount(2);
  expect(
    JSON.parse(requests[1].messages.at(-1).content).capture.lastResult,
  ).toEqual({ output: "nuevo", error: null, previous: false });
  await page.getByRole("tab", { name: "Lección", exact: true }).click();
  await page.getByRole("button", { name: /2\. Un valor que cambia/ }).click();
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await page.getByLabel("Mensaje al tutor").fill("Otro ejercicio");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText("Respuesta completa", { exact: true }),
  ).toHaveCount(3);
  expect(
    JSON.parse(requests[2].messages.at(-1).content).capture.lastResult,
  ).toBeNull();
});

test("streams one immutable capture, keeps its exercise identity, and stops the transport with an incomplete partial", async ({
  page,
}) => {
  await setup(page);
  const fixture = await streamingOpenRouter(page);
  try {
    await page.getByLabel("Código Python").fill("# original");
    await page.getByLabel("Mensaje al tutor").fill("Ayúdame");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(() => fixture.responses.length).toBe(1);
    fixture.responses[0].write(frame("Una pista concreta"));
    await expect(
      page.getByText("Una pista concreta", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Enviar", exact: true }),
    ).toBeDisabled();
    await page.getByLabel("Mensaje al tutor").fill("No enviar todavía");
    await page.getByLabel("Mensaje al tutor").press("Enter");
    await page.getByLabel("Código Python").fill('print("posterior")');
    await expect(
      page.getByRole("button", { name: "Ejecutar", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
    await expect(page.getByLabel("Salida del programa")).toHaveText(
      "posterior",
    );
    await page.getByRole("tab", { name: "Lección", exact: true }).click();
    await page.getByRole("button", { name: /2\. Un valor que cambia/ }).click();
    await page.getByRole("tab", { name: "Tutor", exact: true }).click();
    await expect(
      page.getByText("Tu primera variable", { exact: true }),
    ).toBeVisible();
    expect(fixture.requests).toHaveLength(1);
    expect(
      JSON.parse(fixture.requests[0].messages.at(-1).content).capture,
    ).toMatchObject({
      draft: "# original",
      lastResult: null,
      exercise: { id: "saludo" },
    });
    await page.getByRole("button", { name: "Detener", exact: true }).click();
    await expect(page.getByText(/Respuesta interrumpida/)).toBeVisible();
    await expect.poll(() => fixture.closed).toBe(1);
    await expect(
      page.getByText("Respuesta completa", { exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(() => fixture.responses.length).toBe(2);
    expect(
      JSON.parse(fixture.requests[1].messages.at(-1).content).capture.exercise
        .id,
    ).toBe("cumpleanos");
    fixture.responses[1].write(frame("Segunda respuesta"));
    fixture.responses[1].end(
      frame("", "stop") + frame("", "stop") + "data: [DONE]\n\n",
    );
    await expect(
      page.getByText("Respuesta completa", { exact: true }),
    ).toBeVisible();
  } finally {
    await fixture.close();
  }
});

for (const [name, metadata, expected] of [
  [
    "large window",
    {
      ...model,
      context_length: 200000,
      top_provider: { max_completion_tokens: 9000 },
    },
    2048,
  ],
  ["missing output maximum", { ...model, top_provider: {} }, 2048],
  ["small output maximum", model, 1024],
])
  test(`uses the declared budget for ${name} and blocks excessive context without truncation`, async ({
    page,
  }) => {
    const requests = await setup(page, metadata);
    await page.getByLabel("Mensaje al tutor").fill("Una pista");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(
      page.getByText("Respuesta completa", { exact: true }),
    ).toBeVisible();
    expect(requests[0].max_tokens).toBe(expected);
    const oversized = "# " + "x".repeat(17000);
    await page.getByLabel("Código Python").fill(oversized);
    await page.getByLabel("Mensaje al tutor").fill("Explica");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Reduce el mensaje o el borrador",
    );
    await expect(page.getByLabel("Código Python")).toHaveValue(oversized);
    await expect(page.getByLabel("Mensaje al tutor")).toHaveValue("Explica");
    expect(requests).toHaveLength(1);
  });

test("explains when fixed topic content cannot fit the small window", async ({
  page,
}) => {
  const requests = await setup(page, { ...model, context_length: 3000 });
  await page.getByLabel("Código Python").fill("");
  await page.getByLabel("Mensaje al tutor").fill("Ayuda");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "reducir el borrador no basta",
  );
  expect(requests).toHaveLength(0);
});

for (const finish of ["length", null])
  test(`retains incomplete text on ${finish || "unconfirmed EOF"}`, async ({
    page,
  }) => {
    await setup(page, model, "Texto parcial", finish);
    await page.getByLabel("Mensaje al tutor").fill("Ayuda");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(
      page.getByText("Texto parcial", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Respuesta incompleta:/)).toBeVisible();
    await expect(
      page.getByText("Respuesta completa", { exact: true }),
    ).toHaveCount(0);
  });

test("leaving the topic cancels and returning never resends", async ({
  page,
}) => {
  await setup(page);
  const fixture = await streamingOpenRouter(page);
  try {
    await page.getByLabel("Mensaje al tutor").fill("Ayuda");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(() => fixture.responses.length).toBe(1);
    fixture.responses[0].write(frame("Parcial del tema"));
    await expect(
      page.getByText("Parcial del tema", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /02 Expresiones y salida/ }).click();
    await expect.poll(() => fixture.closed).toBe(1);
    await page.getByRole("button", { name: /01 Valores y variables/ }).click();
    await expect(
      page.getByText("Parcial del tema", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Respuesta interrumpida/)).toBeVisible();
    expect(fixture.requests).toHaveLength(1);
  } finally {
    await fixture.close();
  }
});

test("preserves partial text and rejects an HTTP 200 SSE error even if it claims a stop", async ({
  page,
}) => {
  await setup(page);
  await page.route("https://openrouter.ai/api/v1/chat/completions", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body:
        frame("Ayuda parcial") +
        `data: ${JSON.stringify({ error: { code: 402, message: "Insufficient credits" }, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    }),
  );
  await page.getByLabel("Mensaje al tutor").fill("Ayuda");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Ayuda parcial", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/No se pudo completar la respuesta/),
  ).toBeVisible();
  await expect(
    page.getByText("Respuesta completa", { exact: true }),
  ).toHaveCount(0);
});

test("applies the smaller input budget of a modest window", async ({
  page,
}) => {
  const requests = await setup(page, { ...model, context_length: 8192 });
  await page.getByLabel("Mensaje al tutor").fill("Ayuda");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText("Respuesta completa", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Código Python").fill("#" + "a".repeat(6500));
  await page.getByLabel("Mensaje al tutor").fill("Otra pregunta");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Reduce el mensaje o el borrador",
  );
  expect(requests).toHaveLength(1);
});

test("counts the immutable code behind a previous result as fixed content", async ({
  page,
}) => {
  const requests = await setup(page);
  await expect(
    page.getByRole("button", { name: "Ejecutar", exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel("Código Python")
    .fill("#" + "a".repeat(17000) + '\nprint("resultado")');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByLabel("Salida del programa")).toHaveText("resultado");
  await page.getByLabel("Código Python").fill("");
  await page.getByLabel("Mensaje al tutor").fill("Explica");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "reducir el borrador no basta",
  );
  expect(requests).toHaveLength(0);
});
