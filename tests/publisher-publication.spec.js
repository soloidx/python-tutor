import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  test,
  expect,
  enterCourse,
  sourceBase,
} from "./fixtures/catalog.js";

const publisherPublicDir = process.env.PUBLISHER_PUBLIC_DIR;

test("consumes the generated publisher publication through the real catalog boundary", async ({
  page,
  context,
}) => {
  test.skip(!publisherPublicDir, "set PUBLISHER_PUBLIC_DIR to run against generated publisher output");
  const root = path.resolve(publisherPublicDir);
  await context.unroute(`${sourceBase}**`);
  await context.route(`${sourceBase}**`, async (route) => {
    const relative = route.request().url().slice(sourceBase.length);
    if (!/^(?:catalog\.json|courses\/[^/]+\.json|icons\/[^/]+\.svg)$/.test(relative)) {
      await route.fulfill({ status: 404 });
      return;
    }
    try {
      const file = path.resolve(root, relative);
      if (!file.startsWith(`${root}${path.sep}`) && file !== path.join(root, "catalog.json")) {
        await route.fulfill({ status: 404 });
        return;
      }
      const body = await readFile(file);
      await route.fulfill({
        body,
        contentType: relative.endsWith(".svg") ? "image/svg+xml" : "application/json",
      });
    } catch {
      await route.fulfill({ status: 404 });
    }
  });

  await page.goto("/");
  await enterCourse(page);
  const practice = page.getByLabel("Espacio de práctica");
  await expect(practice.getByLabel("Código Python")).toBeVisible();
  await practice.getByRole("button", { name: /2\. Interpretar una asignación/ }).click();
  await expect(practice.getByRole("radio")).toHaveCount(3);
  await expect(practice.getByLabel("Código Python")).toHaveCount(0);

  await practice.getByLabel("Compara edad con 7").check();
  await practice.getByRole("button", { name: "Comprobar", exact: true }).click();
  await expect(practice.locator(".choice-feedback")).toContainText(
    "Busca el operador que Python usa para comparar dos valores.",
  );
  await practice.getByLabel("Guarda 7 en la variable edad").check();
  await practice.getByRole("button", { name: "Comprobar", exact: true }).click();
  await expect(practice).toContainText("Ejercicio aprobado");
});
