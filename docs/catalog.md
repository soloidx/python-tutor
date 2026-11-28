# Remote learning catalog

The app reads one public source, `https://www.ider.ninja/python-tutor-content/`, configured in `src/catalog.js`. It requests `catalog.json` on opening or reloading. There is no source selector or compiled course fallback. Operating that source and publishing real lessons are separate work; this change does not deploy it. The source must allow public cross-origin requests from the app.

A publication is activated only after every registered course is downloaded, its exact response bytes match its SHA-256, and all documents satisfy this contract. Any failure rejects the entire publication. JSON strings are rendered as text, never as HTML or external JavaScript. Python examples and checks use the existing Pyodide worker; checks see program variables and `_output`.

## Format version 1

All fields below are required unless marked optional. Human-facing strings must be nonempty; `starter` can be an empty string. Lists are ordered. `hints` may be empty. Other listed collections must be nonempty.

```json
{
  "schemaVersion": 1,
  "revision": "2026-11-08-1",
  "learningPaths": [
    {
      "id": "primeros-pasos",
      "title": "Primeros pasos con Python",
      "description": "Aprende las bases.",
      "courseIds": ["python-fundamentos"]
    }
  ],
  "courses": [
    {
      "id": "python-fundamentos",
      "file": "courses/python-fundamentos.2026-11-08-1.json",
      "sha256": "<64 lowercase hexadecimal characters of the exact course response bytes>"
    }
  ]
}
```

`revision` identifies the content publication independently of `schemaVersion`. Change it for a new publication. Course files are immutable: changing a course creates a new file and digest. Upload all course files before updating `catalog.json`. Compute SHA-256 from the bytes actually served, including whitespace and newlines; reserializing parsed JSON can change its digest.

Course files must be relative references inside the source directory and origin. Absolute URLs/paths, dot segments, percent encoding, backslashes, query strings and fragments are rejected. Redirects are rejected. Every registered course belongs to at least one learning path; each path references existing courses at most once. A course can belong to multiple paths.

```json
{
  "schemaVersion": 1,
  "id": "python-fundamentos",
  "title": "Python Fundamentos",
  "description": "Escribe tus primeros programas.",
  "topics": [
    {
      "id": "valores-variables",
      "title": "Valores y variables",
      "summary": "Guarda un valor con un nombre.",
      "duration": "12 min",
      "explanation": ["Una variable guarda un valor. print() lo muestra."],
      "example": "nombre = \"Ada\"\nprint(nombre)",
      "takeaway": "El signo = asigna un valor.",
      "exercises": [
        {
          "id": "saludo",
          "type": "code",
          "title": "Tu primera variable",
          "prompt": "Guarda Ada en nombre y muestra Hola, Ada.",
          "starter": "nombre = \"\"\nprint(\"Hola, \" + nombre)",
          "hints": ["Asigna un texto con comillas a nombre."],
          "check": "nombre == \"Ada\" and _output == \"Hola, Ada\"",
          "success": "Guardaste un texto y lo mostraste.",
          "retry": "Comprueba el valor de nombre y la salida."
        }
      ]
    }
  ],
  "assessment": {
    "questions": [
      {
        "id": "asignacion",
        "prompt": "¿Qué hace edad = 7?",
        "options": [
          { "id": "asigna", "text": "Guarda 7 en edad" },
          { "id": "compara", "text": "Compara edad con 7" }
        ],
        "answerId": "asigna",
        "explanation": "El signo = asigna un valor."
      }
    ]
  }
}
```

`duration`, `assessment`, and question `code` are optional. Exercises share `id`, `title`, `prompt`, and `hints`, and declare `type: "code"` or `type: "choice"` in new content. Code exercises require `starter`, `check`, `success`, and `retry`; choice exercises require at least two `{id, text}` options, one `answerId`, `retry`, and `explanation`, and may include a nonempty `code` fragment. A wrong option may include its own `retry`; the correct option may not. Fields belonging to the other format are rejected. The consumer treats an omitted exercise type in retained historical documents as `code`, but an explicit unknown, empty, or null type is invalid.

An assessment has questions; every question has at least two options and an `answerId` naming one of them. IDs use lowercase ASCII letters, numbers and single separating hyphens. Path IDs and course IDs are unique within their respective collections. Topic IDs and exercise IDs are unique within their course, including exercises in different topics. Question IDs are unique within an assessment; option IDs within a question. A course document ID must match its registry entry. IDs are independent of titles and filenames and must never be reused for different pedagogical content. Content corrections keep their identity; a substantially different exercise objective or format requires a new ID.

Editable sources use the same exercise representation and require the type discriminator on every exercise. The publisher validates sources before converting icon paths to hashed published objects; it retains old hashed course and icon files and validates them as historical publications.

## Consumer boundaries

`loadCatalog({ signal })` downloads and validates one complete publication and returns `{ catalog, courses, courseFiles }`. `courses` is keyed by course ID. `courseFiles` retains the exact validated UTF-8 response text by course ID so a later saved publication can verify the original digest without reserializing JSON. `validateCatalog`, `validateCourse`, and `validatePublication` validate structure; `loadCatalog` additionally verifies byte integrity. No learner storage is touched by the loader.

`CatalogBootstrap.jsx` owns initial loading, errors and Retry. `App.jsx` receives the publication and keeps tutor access and conversation services alive while navigating paths, courses, topics and learning. Browser history stores screen snapshots separately from learner changes. Reload always opens all learning paths.

The former production course is only in `tests/fixtures/content/`. `tests/fixtures/catalog.js` serves complete HTTP publications, computes digests from the exact returned bytes, offers `updateCourse` for coherent changed documents, and provides `enterCourse` through the visible UI. Its two paths share a course; the other course deliberately reuses topic and exercise IDs to exercise identity isolation in later features.

## Saved publications and activation

The complete catalog and exact `courseFiles` texts are stored together under `python-tutor:catalog:v1`. Loading a backup validates the catalog, hashes the UTF-8 source texts again, and reconstructs each course from those verified texts; a separately stored parsed course object is never trusted. Replacement uses one atomic `localStorage.setItem`, so quota or permission failures preserve the previous complete value. This storage is independent of learner progress and tutor settings. Course and global learner resets preserve this downloaded publication.

A valid backup opens immediately while all remote courses download in parallel. A new revision is saved for the next reload and announced without changing the running session. The consumer rejects changes to a known immutable file and changes to a publication with the same revision. Publishers must use both a new revision and a new file for changed course content.

Failed writes display the temporary-content warning and allow retry. When an update could not be saved, the Reload action uses a one-use `catalog-update` URL parameter to download fresh content before starting the new session, even if browser storage writes are blocked. The parameter is consumed immediately; if that download fails, the previous valid backup remains available. Ordinary reloads continue to open the saved complete publication immediately. This backup covers course content, not offline delivery of the application or Python runtime.

## Optional SVG resource icons

A learning path, course document or topic may contain `icon`:

```json
"icon": {
  "file": "icons/functions.<sha256>.svg",
  "sha256": "<64 lowercase hexadecimal characters of the exact SVG bytes>"
}
```

The course registry continues to describe course JSON files; the course's icon belongs inside its document. Icons are optional under `schemaVersion: 1`. Omitting the field uses the app's local category icon. Files must end in `.svg` and satisfy the same relative origin/directory confinement as course files. All references to the same file must agree on its hash. Changing an icon requires a new immutable filename and publication revision; course/topic icon changes also produce a new course file.

All referenced icons are downloaded and checked before the publication activates. Missing files, bad hashes or unsupported SVG reject the entire update and preserve the previous backup. The original UTF-8 SVG text is included in `iconFiles`, keyed by relative filename, and revalidated on backup restore. Icon-free earlier backups remain supported. Images use data URLs derived from verified text, never inline SVG injection or direct remote object/embed elements. No new icon download is needed to display a saved publication.

The static SVG subset allows `svg`, `g`, `path`, `circle`, `ellipse`, `rect`, `line`, `polyline`, `polygon`, `title` and `desc`. The root requires `xmlns="http://www.w3.org/2000/svg"` and `viewBox`; the document must contain geometry and be at most 100 KiB. Use presentation attributes for fill/stroke, geometry, transforms and opacity (the exact allowlist is `src/svgIcon.js`). Colors are plain named/hex colors, `none`, `transparent` or `currentColor`; author explicit colors because image SVGs do not inherit the page theme. Scripts, event attributes, CSS/style, animation, links, embedded images, external references, DOCTYPE and processing instructions are rejected. Export outlined/static shapes from design tools rather than SVGs with embedded CSS or fonts.

For authoring, the content repository stores SVG originals in `content/icons/`. There `icon` is a source string, e.g. `"icon": "icons/functions.svg"`; `npm run build` validates the SVG, emits `public/icons/functions.<sha256>.svg`, and converts the source string into the published object. Keep previously generated SVG files, just like course files.

## Coordinated publication order

Prepare and release a contract-compatible consumer first. In the publisher, validate editable sources, run `npm run build`, and verify the complete publication with `npm run check`. Upload newly generated immutable course and icon files before replacing `catalog.json`; update the catalog last so every referenced byte is already available. The consumer activates a new revision on the next reload, while preserving the prior complete backup if any download, hash, or validation fails. Do not rewrite or delete historical hashed files, deploy a second content channel, or treat this order as a deployment performed by the application repository.

## Optional decision walkthrough

A topic may include `walkthrough` with `type: "decision"`, three uniquely identified `elements` (`condition`, `if`, `else`) with nonempty labels, and a nonempty `scenarios` array. Each scenario has a unique slug `id`, a label, a `replacement` with a one-based `line` in the topic's `example` and a single-line `code`, and a nonempty ordered `steps` array. A step names an existing one-based `line` and `element`, supplies an `explanation`, and may supply nonempty `output`. Output contributions accumulate in order. The diagram selects the first step referring to an element; the controls visit every step. State is kept per course and topic for the current session.

In editable content, `walkthrough` is instead a reference of the form `walkthroughs/<slug>.json`. The publisher checks that the resolved file stays inside the content tree, validates its contents against the topic example, and embeds it in the course before hashing. A declared invalid walkthrough rejects the complete publication; old topics and backups without one remain valid. Release the compatible consumer first, then publish the new immutable course before the catalog, retaining historical files.

## Sequence walkthrough

A topic may instead publish a `walkthrough` of `type: "sequence"` with a nonempty ordered `elements` array and a nonempty ordered `steps` array. Each element has a unique slug `id` and nonempty `label`. Each step refers to an existing element by `element`, has a valid one-based `line` in the example and a nonempty `explanation`, and may have nonempty `output`. Output contributions accumulate through the selected step. Elements and steps have independent orders; steps may revisit elements or leave elements unused. Selecting an element jumps to its first step; next and previous retain the declared order. The source publisher embeds the referenced walkthrough before hashing the course. Release the compatible consumer before publishing this template.

### Collection walkthroughs

A topic may embed a `walkthrough` of type `collection`. Its nonempty `groups` have unique IDs, labels, and nonempty `elements` with globally unique IDs and nonempty `key` and `value` strings. Keys are unique within each group. Its nonempty `steps` reference element IDs and provide a one-based example `line`, an `explanation`, and optional nonempty `output`. Elements without steps remain visible. A collection element may declare `introducedAt`, a one-based step number; it is hidden until that step. Omitted values are visible from the start, and a step cannot reference an element before its introduction. Steps are ordered; output accumulates through the current step. Editable publisher sources reference a walkthrough JSON file under `content/walkthroughs/`; the builder embeds it in the immutable course document. Existing walkthrough types and publications without walkthroughs remain valid.

## Recorridos con escenas SVG

El formato de autoría nuevo usa `type: "svg"`. El publicador incorpora cada SVG en `walkthrough.graphics`, dentro del curso inmutable. La validación del curso comprueba el SVG y los IDs de cada paso tanto en la descarga como al restaurar un respaldo. Los iconos conservan su contrato independiente.

Cada escenario elige un gráfico y define la lista de pasos. El reproductor monta únicamente los nodos y atributos que reconoce [walkthroughSvg.js](../src/walkthroughSvg.js). Las escenas usan `data-part` para identificar grupos o formas y `data-style` para adoptar los estilos del sitio. Los pasos controlan el resaltado, la animación y la visibilidad desde la escena base. `code: true` muestra el ejemplo Python con resaltado opcional y reemplazo de una línea por escenario. `output` contiene la salida completa del paso actual.

Los recorridos anteriores siguen disponibles. La app compatible debe desplegarse antes que el contenido con el tipo nuevo. La habilidad `author-svg-walkthrough` y los gráficos de ejemplo viven en el publicador.

## Markdown lessons

A topic may use an ordered, nonempty `lessons` list in place of the legacy `explanation`, `example`, `takeaway` and `walkthrough` fields. Each published lesson has a stable topic-local slug `id`, a nonempty `title` and its complete `markdown` text. A course can mix lesson topics and legacy topics. IDs are independent of titles, filenames and list order. The schema remains version 1; the exact course bytes, including Markdown, are checked and saved with the complete publication.

In the publisher's editable source, each lesson is `{ "id": "...", "file": "lessons/....md" }`. The file must resolve within `content/`; its first level-one heading supplies the title. Build and check reject missing files, missing titles, invalid or duplicate IDs, and topics mixing formats. Markdown is rendered without raw HTML, and NOTE, TIP, IMPORTANT, WARNING and CAUTION blockquotes receive Spanish labels.

Before publishing, verify the compatible Tutor against an original historical backup and the mixed course. Then validate the publisher sources, build and check, upload the new immutable course files, and update the catalog last. Keep the historical immutable files and previous catalog so the index can be restored. The Tutor saves a valid update for the next reload and preserves the last valid backup if validation or integrity fails.
