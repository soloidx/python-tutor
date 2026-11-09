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

## Verification with the publisher

The generated-publication integration was verified against publisher commit `d490eb68` on branch `codex/selection-57-content` in `../python-tutor-content`. That commit's generated output is revision `087095b4868dd7fcd0fd3029b162feccb85a157d6a802f7a3d3161280ecc9b9e`, including `public/courses/python-fundamentos.8d9ec0199012d8cf9d3303b76397540c2ffbf8be2b786cdb40d4c2bd5cfeda39.json`, whose first topic contains the typed `asignacion` choice exercise. The publisher also retains the generated `python-practica` course and hashed SVG resources.

From the application repository root, verify that exact coordination with:

```sh
(cd ../python-tutor-content && npm ci && npm run build && npm run check)
PUBLISHER_PUBLIC_DIR=../python-tutor-content/public npm run test:publisher
```

From an application worktree under `.worktrees/<name>`, use `../../python-tutor-content/public` for `PUBLISHER_PUBLIC_DIR`. The app's ordinary `npm test` intentionally excludes `tests/publisher-publication.spec.js` because it depends on a separately checked-out generated publication; `npm run test:publisher` is the explicit command and fails when `PUBLISHER_PUBLIC_DIR` is missing. It loads the generated files over the catalog HTTP boundary and exercises both a code and a choice exercise.

The Playwright accessibility coverage verifies native radio semantics, accessible labels, keyboard focus, arrow navigation across the Lección/Tutor tabs, and the polite atomic live result. It does not run a screen reader; manual screen-reader verification remains required before release, and this suite makes no claim to replace it.

## Coordinated publication order

Prepare and release a contract-compatible consumer first. In the publisher, validate editable sources, run `npm run build`, and verify the complete publication with `npm run check`. Upload newly generated immutable course and icon files before replacing `catalog.json`; update the catalog last so every referenced byte is already available. The consumer activates a new revision on the next reload, while preserving the prior complete backup if any download, hash, or validation fails. Do not rewrite or delete historical hashed files, deploy a second content channel, or treat this order as a deployment performed by the application repository.
