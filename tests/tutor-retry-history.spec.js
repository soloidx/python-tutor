import { test, expect, enterCourse } from "./fixtures/catalog.js";
import { setup, frame } from "./fixtures/tutor.js";
import { streamingOpenRouter } from "./fixtures/openrouter.js";

test.use({ actionTimeout: 8000, ignoreHTTPSErrors: true });

test("retry after reload preserves captures and partials without borrowing later exchanges", async ({
  page,
}) => {
  await setup(page);
  const fixture = await streamingOpenRouter(page);
  try {
    await page.getByLabel("Código Python").fill("# captura persistida");
    await page.getByLabel("Mensaje al tutor").fill("Pregunta pendiente");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(() => fixture.responses.length).toBe(1);
    fixture.responses[0].end(frame("Parcial persistido") + frame("", "length"));
    await expect(page.getByText(/límite de salida/)).toBeVisible();
    await page.getByLabel("Código Python").fill("# captura posterior");
    await page.getByLabel("Mensaje al tutor").fill("Pregunta posterior");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(() => fixture.responses.length).toBe(2);
    expect(fixture.requests[1].messages).toHaveLength(2);
    fixture.responses[1].end(frame("Respuesta posterior") + frame("", "stop"));
    await expect(
      page.getByText("Respuesta completa", { exact: true }),
    ).toHaveCount(1);
    await page.reload();
    await enterCourse(page);
    await page.getByRole("tab", { name: "Tutor", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Enviar", exact: true }),
    ).toBeEnabled();
    expect(fixture.requests).toHaveLength(2);
    await page
      .getByRole("button", { name: "Reintentar respuesta", exact: true })
      .click();
    await expect.poll(() => fixture.responses.length).toBe(3);
    expect(fixture.requests[2]).toEqual(fixture.requests[0]);
    fixture.responses[2].end(frame("Respuesta recuperada") + frame("", "stop"));
    await expect(
      page.getByText("Respuesta completa", { exact: true }),
    ).toHaveCount(2);
    await page.reload();
    await enterCourse(page);
    await page.getByRole("tab", { name: "Tutor", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Enviar", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByText("Pregunta pendiente", { exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByText("Parcial persistido", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/límite de salida/)).toBeVisible();
    await expect(
      page.getByText("Respuesta recuperada", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Mensaje al tutor").fill("Otra pregunta");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(() => fixture.responses.length).toBe(4);
    expect(fixture.requests[3].messages.map((item) => item.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
      "assistant",
      "user",
    ]);
    expect(
      JSON.parse(fixture.requests[3].messages[1].content).capture.draft,
    ).toBe("# captura persistida");
    expect(fixture.requests[3].messages[2].content).toBe(
      "Respuesta recuperada",
    );
    expect(JSON.stringify(fixture.requests[3])).not.toContain(
      "Parcial persistido",
    );
    fixture.responses[3].end(frame("Listo") + frame("", "stop"));
  } finally {
    await fixture.close();
  }
});
