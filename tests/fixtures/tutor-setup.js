import { expect } from "@playwright/test";
export const model = {
  id: "example/tutor",
  name: "Tutor de prueba",
  context_length: 32768,
  architecture: { input_modalities: ["text"], output_modalities: ["text"] },
  supported_parameters: ["max_tokens"],
  top_provider: { max_completion_tokens: 1024 },
};
export const frame = (text, finish = null) =>
  `data: ${JSON.stringify({ id: "test", object: "chat.completion.chunk", created: 1, model: model.id, choices: [{ index: 0, delta: { content: text }, finish_reason: finish }] })}\n\n`;
export async function setup(
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
