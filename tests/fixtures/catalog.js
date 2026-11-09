import { createHash } from "node:crypto";
import { test as base, expect } from "@playwright/test";
import { initialCourse } from "./content/initialCourse.js";

export const sourceBase = "https://www.ider.ninja/python-tutor-content/";
export function publication(revision = "fixture-1") {
  const shared = structuredClone(initialCourse);
  const other = {
    ...structuredClone(shared),
    id: "python-practica",
    title: "Python Práctica",
    description: "Otro curso con identidades locales compartidas.",
  };
  delete other.assessment;
  const documents = [shared, other];
  const files = Object.fromEntries(
    documents.map((course) => [
      `courses/${course.id}.${revision}.json`,
      JSON.stringify(course),
    ]),
  );
  return {
    catalog: {
      schemaVersion: 1,
      revision,
      learningPaths: [
        {
          id: "primeros-pasos",
          title: "Primeros pasos con Python",
          description: "Aprende las bases.",
          courseIds: [shared.id, other.id],
        },
        {
          id: "automatizacion",
          title: "Camino a la automatización",
          description: "Cursos compartidos.",
          courseIds: [shared.id],
        },
      ],
      courses: documents.map((course) => {
        const file = `courses/${course.id}.${revision}.json`;
        return {
          id: course.id,
          file,
          sha256: createHash("sha256").update(files[file]).digest("hex"),
        };
      }),
    },
    files,
  };
}
export function updateCourse(value, id, change) {
  const record = value.catalog.courses.find((course) => course.id === id);
  const course = JSON.parse(value.files[record.file]);
  change(course);
  value.files[record.file] = JSON.stringify(course);
  record.sha256 = createHash("sha256")
    .update(value.files[record.file])
    .digest("hex");
}
export async function serveCatalog(context, value = publication()) {
  await context.route(`${sourceBase}**`, async (route) => {
    const file = route.request().url().slice(sourceBase.length);
    if (file === "catalog.json") await route.fulfill({ json: value.catalog });
    else if (Object.hasOwn(value.files, file))
      await route.fulfill({
        contentType: "application/json",
        body: value.files[file],
      });
    else await route.fulfill({ status: 404 });
  });
}
export async function enterCourse(
  page,
  {
    path = "Primeros pasos con Python",
    course = "Python Fundamentos",
    topic,
  } = {},
) {
  await page
    .getByRole("button", { name: `Explorar ${path}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: `Ver temas de ${course}`, exact: true })
    .click();
  if (topic)
    await page.getByRole("button", { name: topic, exact: true }).click();
  else
    await page
      .getByRole("button", { name: /^(Comenzar|Continuar|Repasar) curso$/ })
      .click();
}
export const test = base.extend({
  context: async ({ context }, use) => {
    await serveCatalog(context);
    await use(context);
  },
});
export { expect };
