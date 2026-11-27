import { enterCourse, expect, publication, serveCatalog, sourceBase, test, updateCourse } from "./fixtures/catalog.js";
import { setup } from "./fixtures/tutor.js";

const graph = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60">
  <title>Dos bloques</title>
  <rect data-style="surface" data-part="start" width="30" height="30"/>
  <path data-style="connector" data-part="arrow" d="M30 15H50"/>
  <rect data-style="surface" data-part="end" data-hidden="true" x="50" width="30" height="30"/>
</svg>`;

function withWalkthrough(revision, change = () => {}) {
  const catalog = publication(revision);
  updateCourse(catalog, "python-fundamentos", course => {
    course.topics[0].example = 'value = 25\nprint(value)';
    const walkthrough = {
      type: "svg",
      code: true,
      graphics: { graph },
      scenarios: [
        { id: "25", label: "25", graphic: "graph", steps: [
          { explanation: "Asignar 25.", line: 1, highlight: ["start"] },
          { explanation: "Mostrar el 25.", line: 2, animate: ["arrow"], show: ["end"], output: "25" },
        ] },
        { id: "23", label: "23", graphic: "graph", replacement: { line: 1, code: "value = 23" }, steps: [
          { explanation: "Asignar 23.", line: 1, highlight: ["start"] },
          { explanation: "Mostrar el 23.", line: 2, highlight: ["end"], show: ["end"], output: "23" },
        ] },
      ],
    };
    course.topics[0].walkthrough = walkthrough;
    course.topics[1].walkthrough = {
      type: "svg",
      graphics: { graph },
      scenarios: [{ id: "one", label: "Una parte", graphic: "graph", steps: [
        { explanation: "Una parte al inicio." },
        { explanation: "Ocultar la primera y mostrar otra.", show: ["end"], hide: ["start"] },
      ] }],
    };
    change(walkthrough);
  });
  return catalog;
}

test("the SVG player restores each scene, with optional code and output", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await serveCatalog(context, withWalkthrough("svg-valid"));
  await page.goto("/");
  await enterCourse(page);

  const player = page.getByRole("region", { name: "Recorrido interactivo" });
  const controls = player.getByRole("group", { name: "Controles del recorrido" });
  const previous = controls.getByRole("button", { name: "Anterior" });
  const next = controls.getByRole("button", { name: "Siguiente" });
  const reset = controls.getByRole("button", { name: "Reiniciar" });
  const counter = controls.getByLabel("Paso del recorrido");
  const output = player.getByLabel("Salida del recorrido");
  const currentLine = player.locator('[aria-current="step"]');

  await expect(controls.locator(":scope > *")).toHaveCount(4);
  expect(await controls.locator(":scope > *").evaluateAll(items => items.map(item => item.getAttribute("aria-label"))))
    .toEqual(["Anterior", "Siguiente", "Reiniciar", "Paso del recorrido"]);
  await expect(previous).toBeDisabled();
  await expect(player.getByRole("img", { name: "Dos bloques" })).toHaveCount(1);
  await expect(player.locator('[data-part="end"]')).toBeHidden();
  await next.click();
  await expect(player.locator('[data-part="arrow"][data-walkthrough-animate]')).toHaveCount(1);
  await expect(output).toHaveText("25");
  await expect(next).toBeDisabled();

  await player.getByRole("button", { name: "23", exact: true }).click();
  await expect(counter).toHaveText("1 / 2");
  await expect(currentLine).toHaveText("value = 23");
  await expect(output).toBeHidden();
  await next.click();
  await expect(output).toHaveText("23");
  await reset.click();
  await expect(counter).toHaveText("1 / 2");
  await expect(player.getByRole("button", { name: "23", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: /02 Expresiones y salida/ }).click();
  await expect(player.getByLabel("Código del recorrido")).toBeHidden();
  await expect(player.getByRole("group", { name: "Escenarios" })).toBeHidden();
  await next.click();
  await expect(player.locator('[data-part="end"]')).toBeVisible();
  await expect(player.locator('[data-part="start"]')).toBeHidden();
  await previous.click();
  await expect(player.locator('[data-part="end"]')).toBeHidden();
  await expect(player.locator('[data-part="start"]')).toBeVisible();
});

test("rejects SVG markup and invalid targets and restores the last saved publication offline", async ({ page, context }) => {
  await serveCatalog(context, withWalkthrough("svg-valid"));
  await page.goto("/");
  await enterCourse(page);
  await expect(page.getByRole("img", { name: "Dos bloques" })).toBeVisible();

  for (const [revision, mutate] of [
    ["svg-script", walkthrough => { walkthrough.graphics.graph = graph.replace("</svg>", "<script>alert(1)</script></svg>"); }],
    ["svg-url", walkthrough => { walkthrough.graphics.graph = graph.replace('data-style="surface"', 'fill="url(https://example.org/a)"'); }],
    ["svg-missing-part", walkthrough => { walkthrough.scenarios[0].steps[0].highlight = ["missing"]; }],
  ]) {
    await serveCatalog(context, withWalkthrough(revision, mutate));
    await page.reload();
    await expect(page.getByRole("alert")).toContainText("No se pudo actualizar el catálogo");
    await enterCourse(page);
    await expect(page.getByRole("img", { name: "Dos bloques" })).toBeVisible();
  }
  await context.route(`${sourceBase}**`, route => route.abort("internetdisconnected"));
  await page.reload();
  await enterCourse(page);
  await expect(page.getByRole("img", { name: "Dos bloques" })).toBeVisible();
});

test("captures the visible SVG scenario and step for the tutor", async ({ page, context }) => {
  await serveCatalog(context, withWalkthrough("svg-tutor"));
  const requests = await setup(page);
  await page.getByRole("button", { name: "Cerrar Tutor" }).click();
  await page.getByRole("tab", { name: "Lección" }).click();
  const player = page.getByRole("region", { name: "Recorrido interactivo" });
  await player.getByRole("button", { name: "23", exact: true }).click();
  await player.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Tutor IA" }).click();
  await page.getByLabel("Mensaje al tutor").fill("¿Qué ocurrió?");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Respuesta completa", { exact: true })).toBeVisible();
  const { capture } = JSON.parse(requests.at(-1).messages.at(-1).content);
  expect(capture.walkthrough).toEqual({
    type: "svg",
    scenario: { id: "23", label: "23" },
    step: { line: 2, explanation: "Mostrar el 23." },
    code: "value = 23\nprint(value)",
    output: "23",
    stepNumber: 2,
    stepCount: 2,
  });
  await page.reload();
  await enterCourse(page);
  await page.getByRole("button", { name: "Tutor IA" }).click();
  await expect(page.getByText("Respuesta completa", { exact: true })).toBeVisible();
});
