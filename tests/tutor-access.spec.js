import { test, expect } from "@playwright/test";
test.use({ actionTimeout: 5000 });

test("Tutor tabs and configuration preserve practice and keyboard focus", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Comenzar ruta" }).click();
  await page.getByLabel("Código Python").fill('print("mi borrador")');
  await expect(
    page.getByRole("button", { name: "Ejecutar", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.getByLabel("Salida del programa")).toHaveText(
    "mi borrador",
  );
  await page.getByRole("tab", { name: "Lección", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Tutor", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Enviar", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Configurar tutor", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Configuración del tutor" }),
  ).toBeVisible();
  await expect(page.getByLabel("Clave de OpenRouter")).toBeFocused();
  for (const provider of ["OpenAI", "Anthropic", "Modelos locales"]) {
    await expect(
      page.getByRole("button", { name: provider, exact: true }),
    ).toBeDisabled();
  }
  await page.getByRole("button", { name: "Cancelar", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "OpenRouter", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Cancelar", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Configurar tutor", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Código Python")).toHaveValue(
    'print("mi borrador")',
  );
  await page
    .getByRole("button", { name: "Configuración del tutor", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("tab", { name: "Tutor", exact: true })
    .press("ArrowLeft");
  await expect(
    page.getByRole("heading", { name: "Valores y variables", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Lección", exact: true }).press("End");
  await expect(
    page.getByRole("tab", { name: "Tutor", exact: true }),
  ).toBeFocused();
  await page.getByRole("tab", { name: "Tutor", exact: true }).press("Home");
  await expect(
    page.getByRole("tab", { name: "Lección", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Salida del programa")).toHaveText(
    "mi borrador",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Configuración", exact: true }),
  ).toBeVisible();
  const lesson = await page.getByRole("tabpanel").boundingBox();
  const practice = await page.getByLabel("Espacio de práctica").boundingBox();
  expect(practice.y).toBeGreaterThan(lesson.y + lesson.height);
});

const compatible = {
  id: "example/text",
  name: "Texto claro",
  architecture: { input_modalities: ["text"], output_modalities: ["text"] },
  context_length: 8192,
  supported_parameters: ["max_tokens"],
  top_provider: { max_completion_tokens: 1024 },
};
async function mockAccess(page, models = [compatible]) {
  const requests = [];
  await page.route("https://openrouter.ai/api/v1/**", async (route) => {
    requests.push({
      url: route.request().url(),
      method: route.request().method(),
      authorization: route.request().headers().authorization,
    });
    await route.fulfill({
      json: route.request().url().endsWith("/key")
        ? { data: { limit: null } }
        : { data: models },
    });
  });
  return requests;
}
async function configure(page) {
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  await page.getByLabel("Clave de OpenRouter").fill("sk-or-fictitious");
  await page
    .getByRole("button", { name: "Validar clave", exact: true })
    .click();
  await expect(
    page.getByText("Credenciales válidas", { exact: true }),
  ).toBeVisible();
}

test("validates without generation, explicitly selects and persists a checked model", async ({
  page,
}) => {
  const requests = await mockAccess(page, [
    compatible,
    {
      ...compatible,
      id: "example/unknown",
      name: "Sin ventana",
      context_length: null,
    },
    {
      ...compatible,
      id: "example/no-limit",
      name: "Sin límite",
      supported_parameters: [],
    },
    {
      ...compatible,
      id: "example/image",
      name: "Solo imagen",
      architecture: {
        input_modalities: ["image"],
        output_modalities: ["image"],
      },
    },
    {
      ...compatible,
      id: "example/no-max",
      name: "Máximo no declarado",
      top_provider: {},
    },
  ]);
  await page.goto("/");
  await page.getByRole("button", { name: "Comenzar ruta" }).click();
  await page.getByLabel("Código Python").fill("# conservado");
  await configure(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/no comprueba el saldo/)).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /Sin ventana/ }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: /Sin límite/ }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: /Solo imagen/ }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: /Máximo no declarado/ }),
  ).toBeEnabled();
  await expect(
    dialog.getByRole("button", { name: "Guardar y volver al tutor" }),
  ).toBeDisabled();
  await dialog.getByLabel("Buscar modelo por nombre").fill("Texto");
  await expect(
    dialog.getByRole("button", { name: /Máximo no declarado/ }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: /Texto claro/ }).click();
  await dialog
    .getByRole("button", { name: "Guardar y volver al tutor" })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "Tutor", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("tab", { name: "Tutor", exact: true }),
  ).toBeFocused();
  await expect(page.getByText(/Acceso listo/)).toBeVisible();
  await expect(page.getByLabel("Código Python")).toHaveValue("# conservado");
  await page.reload();
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await expect(page.getByText(/Acceso listo/)).toBeVisible();
  await page
    .getByRole("button", { name: "Configuración del tutor", exact: true })
    .click();
  await expect(page.getByLabel("Clave de OpenRouter")).toHaveValue(
    "sk-or-fictitious",
  );
  await expect(
    page.getByText(/Modelo seleccionado: Texto claro/),
  ).toBeVisible();
  expect(requests).toHaveLength(6);
  expect(
    requests.every(
      (request) =>
        request.method === "GET" &&
        request.authorization === "Bearer sk-or-fictitious",
    ),
  ).toBe(true);
  expect(requests.some((request) => request.url.endsWith("/models/user"))).toBe(
    true,
  );
  expect(requests.some((request) => request.url.includes("/chat/"))).toBe(
    false,
  );
});

async function saveAccess(page) {
  await page.goto("/");
  await configure(page);
  await page.getByRole("button", { name: /Texto claro/ }).click();
  await page.getByRole("button", { name: "Guardar y volver al tutor" }).click();
  await expect(page.getByText(/Acceso listo/)).toBeVisible();
}

test("cancelled and rejected pending changes retain the saved access", async ({
  page,
}) => {
  const requests = await mockAccess(page);
  await saveAccess(page);
  await page
    .getByRole("button", { name: "Configuración del tutor", exact: true })
    .click();
  await page.getByLabel("Clave de OpenRouter").fill("sk-or-rejected");
  await page.route("https://openrouter.ai/api/v1/key", (route) =>
    route.fulfill({ status: 401, json: { error: { message: "invalid" } } }),
  );
  await page
    .getByRole("button", { name: "Validar clave", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Clave rechazada");
  await expect(
    page.getByRole("button", { name: "Guardar y volver al tutor" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByText(/Acceso listo · Texto claro/)).toBeVisible();
  await page
    .getByRole("button", { name: "Configuración del tutor", exact: true })
    .click();
  await expect(page.getByLabel("Clave de OpenRouter")).toHaveValue(
    "sk-or-fictitious",
  );
  await page.getByLabel("Clave de OpenRouter").fill("sk-or-pending");
  await page.keyboard.press("Escape");
  await expect(page.getByText(/Acceso listo · Texto claro/)).toBeVisible();
  expect(requests.every((request) => !request.url.includes("/chat/"))).toBe(
    true,
  );
});

test("reload checks access before enabling messages and network failure preserves saved fields for retry", async ({
  page,
}) => {
  await mockAccess(page);
  await saveAccess(page);
  let release;
  await page.route("https://openrouter.ai/api/v1/key", async (route) => {
    await new Promise((resolve) => {
      release = resolve;
    });
    await route.abort("failed");
  });
  await page.reload();
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await expect(
    page.getByText("Comprobando acceso…", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviar", exact: true }),
  ).toBeDisabled();
  release();
  await expect(page.getByText(/No se pudo conectar/)).toBeVisible();
  await page
    .getByRole("button", { name: "Configuración del tutor", exact: true })
    .click();
  await expect(page.getByLabel("Clave de OpenRouter")).toHaveValue(
    "sk-or-fictitious",
  );
  await expect(
    page.getByText("Modelo seleccionado: Texto claro"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.unroute("https://openrouter.ai/api/v1/key");
  await page.getByRole("button", { name: "Reintentar comprobación" }).click();
  await expect(page.getByText(/Acceso listo/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviar", exact: true }),
  ).toBeEnabled();
});

test("a retired model requires a new explicit selection and never substitutes another model", async ({
  page,
}) => {
  await mockAccess(page);
  await saveAccess(page);
  const replacement = { ...compatible, id: "example/new", name: "Otro modelo" };
  await page.route("https://openrouter.ai/api/v1/models/user", (route) =>
    route.fulfill({ json: { data: [replacement] } }),
  );
  await page.reload();
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await expect(
    page.getByText(/El modelo guardado ya no está disponible/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviar", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Configurar tutor", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Validar clave", exact: true })
    .click();
  await expect(
    page.getByText(/El modelo seleccionado ya no está disponible/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Guardar y volver al tutor" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Otro modelo/ }).click();
  await page.getByRole("button", { name: "Guardar y volver al tutor" }).click();
  await expect(page.getByText(/Acceso listo · Otro modelo/)).toBeVisible();
});

test("a browser storage failure requires explicit choice for session-only access", async ({
  page,
}) => {
  await mockAccess(page);
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await configure(page);
  await page.getByRole("button", { name: /Texto claro/ }).click();
  await page.getByRole("button", { name: "Guardar y volver al tutor" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText(/No se pudo guardar la configuración/),
  ).toBeVisible();
  await expect(page.getByText("Guardado", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Usar solo en esta sesión", exact: true })
    .click();
  await expect(
    page.getByText(
      /Solo en esta sesión. La configuración se perderá al recargar/,
    ),
  ).toBeVisible();
  await expect(page.getByText(/Acceso listo/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Aprender", exact: true }).click();
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Enviar", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Configurar tutor", exact: true })
    .click();
  await expect(page.getByLabel("Clave de OpenRouter")).toHaveValue("");
});

test("an unavailable account catalog falls back to public models but incompatible catalog remains blocked", async ({
  page,
}) => {
  const requests = await mockAccess(page, [
    { ...compatible, context_length: null },
  ]);
  await page.route("https://openrouter.ai/api/v1/models/user", (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.goto("/");
  await configure(page);
  await expect(
    page.getByText(/No hay modelos compatibles en este catálogo/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Texto claro/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Guardar y volver al tutor" }),
  ).toBeDisabled();
  expect(requests.some((request) => request.url.endsWith("/models"))).toBe(
    true,
  );
});

test("a rejected recovered key blocks access and asks for correction without changing the model", async ({
  page,
}) => {
  await mockAccess(page);
  await saveAccess(page);
  await page.route("https://openrouter.ai/api/v1/key", (route) =>
    route.fulfill({ status: 401, json: { error: { message: "invalid" } } }),
  );
  await page.reload();
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await expect(page.getByText(/Clave rechazada/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviar", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Reintentar comprobación" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Configurar tutor", exact: true })
    .click();
  await expect(page.getByLabel("Clave de OpenRouter")).toHaveValue(
    "sk-or-fictitious",
  );
  await expect(
    page.getByText("Modelo seleccionado: Texto claro"),
  ).toBeVisible();
});
