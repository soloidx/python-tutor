import { mkdir, copyFile } from "node:fs/promises";
// Bundle the actual interpreter with the static site; no runtime CDN is required.
await mkdir("public/runtime", { recursive: true });
for (const file of [
  "pyodide.js",
  "pyodide.asm.js",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
]) {
  await copyFile(`node_modules/pyodide/${file}`, `public/runtime/${file}`);
}
