# Remote learning catalog

The app reads one public source, `https://soloidx.github.io/python-tutor-content/`, configured in `src/catalog.js`. It requests `catalog.json` on opening or reloading. There is no source selector or compiled course fallback. Operating that source and publishing real lessons are separate work; this change does not deploy it. The source must allow public cross-origin requests from the app.

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

`duration`, `assessment`, and question `code` are optional. An assessment has questions; every question has at least two options and an `answerId` naming one of them. IDs use lowercase ASCII letters, numbers and single separating hyphens. Path IDs and course IDs are unique within their respective collections. Topic IDs and exercise IDs are unique within their course, including exercises in different topics. Question IDs are unique within an assessment; option IDs within a question. A course document ID must match its registry entry. IDs are independent of titles and filenames and must never be reused for different pedagogical content. Content corrections keep their identity; a substantially different exercise objective requires a new ID.

## Consumer boundaries

`loadCatalog({ signal })` downloads and validates one complete publication and returns `{ catalog, courses, courseFiles }`. `courses` is keyed by course ID. `courseFiles` retains the exact validated UTF-8 response text by course ID so a later saved publication can verify the original digest without reserializing JSON. `validateCatalog`, `validateCourse`, and `validatePublication` validate structure; `loadCatalog` additionally verifies byte integrity. No learner storage is touched by the loader.

`CatalogBootstrap.jsx` owns initial loading, errors and Retry. `App.jsx` receives the publication and keeps tutor access and conversation services alive while navigating paths, courses, topics and learning. Browser history stores screen snapshots separately from learner changes. Reload always opens all learning paths.

The former production course is only in `tests/fixtures/content/`. `tests/fixtures/catalog.js` serves complete HTTP publications, computes digests from the exact returned bytes, offers `updateCourse` for coherent changed documents, and provides `enterCourse` through the visible UI. Its two paths share a course; the other course deliberately reuses topic and exercise IDs to exercise identity isolation in later features.

## Saved publications and activation

The complete catalog and exact `courseFiles` texts are stored together under `python-tutor:catalog:v1`. Loading a backup validates the catalog, hashes the UTF-8 source texts again, and reconstructs each course from those verified texts; a separately stored parsed course object is never trusted. Replacement uses one atomic `localStorage.setItem`, so quota or permission failures preserve the previous complete value. This storage is independent of learner progress and tutor settings. Course and global learner resets preserve this downloaded publication.

A valid backup opens immediately while all remote courses download in parallel. A new revision is saved for the next reload and announced without changing the running session. The consumer rejects changes to a known immutable file and changes to a publication with the same revision. Publishers must use both a new revision and a new file for changed course content.

Failed writes display the temporary-content warning and allow retry. When an update could not be saved, the Reload action uses a one-use `catalog-update` URL parameter to download fresh content before starting the new session, even if browser storage writes are blocked. The parameter is consumed immediately; if that download fails, the previous valid backup remains available. Ordinary reloads continue to open the saved complete publication immediately. This backup covers course content, not offline delivery of the application or Python runtime.
