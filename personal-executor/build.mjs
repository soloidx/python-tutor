// Produce a static bundle for a dedicated, credential-free origin. Hosting must
// honor the supplied response headers before the application enables it.
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile, copyFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [runtimeArg, outputArg, appOrigin] = process.argv.slice(2);
if (!runtimeArg || !outputArg || !appOrigin) throw new Error("Uso: node personal-executor/build.mjs RUNTIME DESTINO ORIGEN_APP");
const url = new URL(appOrigin);
if (url.origin !== appOrigin || !(url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new Error("Origen de aplicación inválido.");
const hashes = {
  "pyodide.js": "24a458425dcb4ea9836eb5ce26701d18cb769374e2b79247602ba605bf093278",
  "pyodide.asm.js": "b22e5831eade9ff10e6fe2c811c68688cd91f10154377b4f80debcf5bafa1e56",
  "pyodide.asm.wasm": "5effb6a1a6cc4a1a85bec4622701aa797c031e1de923cbbaf2ad47abdc4ab325",
  "python_stdlib.zip": "71fee17f88a6260ec8c9c7c063533ee59c021fdc88a1ce76247378d3c4a35f4c",
  "pyodide-lock.json": "f6e6f42f451f42affbbcddb00e8c9a3278dcbf399f57aab9f3f568839a7ff4a6",
};
const values = {};
for (const [name, expected] of Object.entries(hashes)) {
  const bytes = await readFile(join(resolve(runtimeArg), name));
  if (bytes.length > 64 * 1024 * 1024 || createHash("sha256").update(bytes).digest("hex") !== expected) throw new Error(`Asset no admitido: ${name}`);
  values[name] = bytes;
}
const output = resolve(outputArg);
await mkdir(join(output, "runtime"), { recursive: true });
const document = (await readFile(join(here, "executor.html"), "utf8")).replaceAll("__APP_ORIGIN__", appOrigin);
await writeFile(join(output, "index.html"), document);
await copyFile(join(here, "protocol.js"), join(output, "protocol.js"));
await writeFile(join(output, "worker.js"), Buffer.concat([values["pyodide.asm.js"], Buffer.from("\n"), values["pyodide.js"], Buffer.from("\n"), await readFile(join(here, "protocol.js")), Buffer.from("\n"), await readFile(join(here, "worker.js"))]));
for (const name of ["pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) await writeFile(join(output, "runtime", name), values[name]);
await writeFile(join(output, "_headers"), `/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()\n  Content-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-inline'; connect-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors ${appOrigin}\n/worker.js\n  Content-Security-Policy: default-src 'none'; script-src 'wasm-unsafe-eval'; connect-src 'none'; worker-src 'none'; base-uri 'none'\n`);
