import { test, expect } from "./fixtures/catalog.js";
import { setup, frame } from "./fixtures/tutor.js";
import { streamingOpenRouter } from "./fixtures/openrouter.js";

test.use({ ignoreHTTPSErrors: true });

test("a conflict during streaming keeps the received partial available for review", async ({ page, context }) => {
  await setup(page);
  const stream = await streamingOpenRouter(page);
  try {
    await page.getByLabel("Mensaje al tutor").fill("Pregunta en curso");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(() => stream.responses.length).toBe(1);
    const other = await context.newPage();
    await setup(other);
    await other.getByLabel("Mensaje al tutor").fill("Pregunta de otra pestaña");
    await other.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(other.getByText("Respuesta completa", { exact: true })).toBeVisible();
    stream.responses[0].write(frame("Fragmento que debe conservarse"));
    await expect(page.getByRole("alert").filter({ hasText: "otra pestaña" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Cambios recuperados de esta sesión" })).toContainText("Fragmento que debe conservarse");
    await expect(page.getByRole("region", { name: "Cambios recuperados de esta sesión" })).toContainText("no están guardados");
    await expect.poll(() => stream.closed).toBe(1);
    await page.getByRole("button", { name: "Cerrar Tutor" }).click();
    await page.getByRole("button", { name: "Reiniciar este curso", exact: true }).click();
    await page.getByRole("button", { name: "Sí, reiniciar", exact: true }).click();
    await page.getByRole("button", { name: "Comenzar curso", exact: true }).click();
    await page.getByRole("button", { name: "Tutor IA", exact: true }).click();
    await expect(page.getByRole("region", { name: "Cambios recuperados de esta sesión" })).toHaveCount(0);
  } finally { await stream.close(); }
});
