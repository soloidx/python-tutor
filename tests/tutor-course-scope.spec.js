import { test, expect, enterCourse } from "./fixtures/catalog.js";
import { setup } from "./fixtures/tutor.js";

async function tutor(page) {
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
}
async function send(page, message, count) {
  await page.getByLabel("Mensaje al tutor").fill(message);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Respuesta completa", { exact: true })).toHaveCount(count);
}

test("shares a course conversation across paths and isolates matching local topics including deletion", async ({ page }) => {
  const requests = await setup(page);
  await send(page, "Pregunta de fundamentos", 1);
  await page.reload();
  await enterCourse(page, { course: "Python Práctica" });
  await tutor(page);
  await expect(page.getByText("Pregunta de fundamentos", { exact: true })).toHaveCount(0);
  await send(page, "Pregunta de práctica", 1);
  expect(requests[1].messages).toHaveLength(2);
  expect(JSON.parse(requests[1].messages.at(-1).content).capture.course).toEqual({
    id: "python-practica", title: "Python Práctica",
  });
  await page.reload();
  await enterCourse(page, { path: "Camino a la automatización" });
  await tutor(page);
  await expect(page.getByText("Pregunta de fundamentos", { exact: true })).toBeVisible();
  await expect(page.getByText("Pregunta de práctica", { exact: true })).toHaveCount(0);
  await send(page, "Otra ruta del mismo curso", 2);
  expect(requests[2].messages).toHaveLength(4);
  expect(requests[2].messages[1].content).toContain("Pregunta de fundamentos");
  expect(JSON.stringify(requests[2])).not.toContain("Pregunta de práctica");
  await page.getByRole("button", { name: "Borrar conversación del tema", exact: true }).click();
  await page.getByRole("button", { name: "Sí, borrar conversación", exact: true }).click();
  await page.reload();
  await enterCourse(page, { course: "Python Práctica" });
  await tutor(page);
  await expect(page.getByText("Pregunta de práctica", { exact: true })).toBeVisible();
  await page.reload();
  await enterCourse(page);
  await tutor(page);
  await expect(page.getByText("Pregunta de fundamentos", { exact: true })).toHaveCount(0);
});

test("starts official conversations without importing a legacy topic thread", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("python-tutor:conversations:v1", JSON.stringify([{
      id: "legacy-question",
      topicId: "valores-variables",
      message: "Pregunta del formato anterior",
      capture: { topic: { id: "valores-variables" }, exercise: { id: "saludo", title: "Saludo" } },
      attempts: [{ id: "legacy-answer", text: "Respuesta anterior", status: "complete" }],
    }]));
  });
  const requests = await setup(page);
  await expect(page.getByText("Pregunta del formato anterior", { exact: true })).toHaveCount(0);
  await send(page, "Primera pregunta oficial", 1);
  expect(requests[0].messages).toHaveLength(2);
  await page.reload();
  await enterCourse(page);
  await tutor(page);
  await expect(page.getByText("Primera pregunta oficial", { exact: true })).toBeVisible();
  await expect(page.getByText("Pregunta del formato anterior", { exact: true })).toHaveCount(0);
});
