import { test, expect, enterCourse } from "./fixtures/catalog.js";

async function blockRecoveryCopies(page) {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "python-tutor:learner-store:v1" && Object.keys(JSON.parse(value).records).some((item) => item.startsWith("python-tutor:recovery:v1:")))
        throw new DOMException("Full", "QuotaExceededError");
      return set.call(this, key, value);
    };
  });
}

test("damaged legacy progress cannot be masked when backup fails", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("python-tutor:course-progress:v1:python-fundamentos", JSON.stringify({ topicId: "valores-variables", completed: ["saludo", null], assessmentResult: null })));
  await blockRecoveryCopies(page);
  await page.goto("/");
  await enterCourse(page);
  await expect(page.getByRole("alert")).toContainText("recuperación parcial");
  await page.getByRole("button", { name: /02 Expresiones y salida/ }).click();
  await page.reload();
  await enterCourse(page);
  await expect(page.getByRole("alert")).toContainText("recuperación parcial");
  await expect(page.getByText("1 / 12 ejercicios", { exact: true })).toBeVisible();
});

test("damaged legacy conversation cannot be masked when backup fails", async ({ page }) => {
  const { setup } = await import("./fixtures/tutor.js");
  await setup(page);
  await page.getByLabel("Mensaje al tutor").fill("Pregunta original");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Respuesta completa", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const key = "python-tutor:course-conversations:v1:" + encodeURIComponent(JSON.stringify(["original", "python-fundamentos"]));
    const saved = JSON.parse(window.__learnerTest.getItem(key));
    for (const entry of saved) { entry.courseId = "python-fundamentos"; entry.capture.course.id = entry.courseId; }
    saved.push(null);
    localStorage.removeItem("python-tutor:learner-store:v1");
    localStorage.setItem("python-tutor:course-conversations:v1:python-fundamentos", JSON.stringify(saved));
  });
  await blockRecoveryCopies(page);
  await page.reload();
  await enterCourse(page);
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await page.getByLabel("Mensaje al tutor").fill("Pregunta de sesión");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Respuesta completa", { exact: true })).toHaveCount(2);
  await page.reload();
  await enterCourse(page);
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await expect(page.getByText("Pregunta original", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "recuperación parcial" })).toBeVisible();
  await expect(page.getByText("Pregunta de sesión", { exact: true })).toHaveCount(0);
});

test("damaged legacy practice cannot be masked when backup fails", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Práctica", exact: true }).click();
  await expect(page.getByText("Ronda guardada", { exact: false })).toBeVisible();
  await page.evaluate(() => {
    localStorage.removeItem("python-tutor:learner-store:v1");
    localStorage.setItem("python-tutor:practice:v1", "{damaged");
  });
  await blockRecoveryCopies(page);
  await page.reload();
  await page.getByRole("button", { name: "Práctica", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "registro está dañado" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Práctica", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "registro está dañado" })).toBeVisible();
});
