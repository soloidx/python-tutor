#!/usr/bin/env python3
"""PROTOTYPE: two loopback origins, public runtime assets, no persistence."""
import argparse
import hashlib
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
EXECUTOR = HERE.parents[2] / "personal-executor"
ASSETS = {"pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"}
WORKER_POLICY = "default-src 'none'; script-src 'wasm-unsafe-eval'; connect-src 'none'; worker-src 'none'; base-uri 'none'"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime-dir", type=Path)
    parser.add_argument("--app-port", type=int, default=8871)
    parser.add_argument("--executor-port", type=int, default=8872)
    parser.add_argument("--app-origin")
    args = parser.parse_args()
    common = Path(subprocess.check_output(
        ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
        cwd=HERE, text=True).strip()).parent
    local_runtime = HERE.parents[2] / "public/runtime"
    runtime = args.runtime_dir or (local_runtime if local_runtime.is_dir() else common / "public/runtime")
    required = ASSETS | {"pyodide.js", "pyodide.asm.js"}
    if not all((runtime / name).is_file() for name in required):
        parser.error("Falta Pyodide 0.28.3. Indica --runtime-dir con los assets preparados de la app.")
    hashes = {
        "pyodide.js": "24a458425dcb4ea9836eb5ce26701d18cb769374e2b79247602ba605bf093278",
        "pyodide.asm.js": "b22e5831eade9ff10e6fe2c811c68688cd91f10154377b4f80debcf5bafa1e56",
        "pyodide.asm.wasm": "5effb6a1a6cc4a1a85bec4622701aa797c031e1de923cbbaf2ad47abdc4ab325",
        "python_stdlib.zip": "71fee17f88a6260ec8c9c7c063533ee59c021fdc88a1ce76247378d3c4a35f4c",
        "pyodide-lock.json": "f6e6f42f451f42affbbcddb00e8c9a3278dcbf399f57aab9f3f568839a7ff4a6",
    }
    for name, expected in hashes.items():
        data = (runtime / name).read_bytes()
        if len(data) > 64 * 1024 * 1024 or hashlib.sha256(data).hexdigest() != expected:
            parser.error("Asset público modificado o fuera de tamaño: " + name)
    app_origin = args.app_origin or f"http://127.0.0.1:{args.app_port}"
    executor_origin = f"http://127.0.0.1:{args.executor_port}"

    def handler(role):
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                path = urlparse(self.path).path
                if role == "app" and path == "/":
                    body = (HERE / "index.html").read_text().replace("__EXECUTOR_ORIGIN__", executor_origin).encode()
                    content_type = "text/html; charset=utf-8"
                    csp = f"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; frame-src {executor_origin}; base-uri 'none'; form-action 'none'"
                elif role == "app" and path == "/client.html":
                    body = (HERE / "client.html").read_text().replace("__EXECUTOR_ORIGIN__", executor_origin).encode()
                    content_type = "text/html; charset=utf-8"
                    csp = f"default-src 'none'; script-src 'self' 'unsafe-inline'; frame-src {executor_origin}; base-uri 'none'"
                elif role == "app" and path in {"/src/personalExecutor.js", "/src/personalRuleProfile.js"}:
                    body = (HERE.parents[2] / path.lstrip("/")).read_bytes()
                    content_type = "text/javascript; charset=utf-8"
                    csp = "default-src 'none'"
                elif role == "executor" and path == "/":
                    body = (EXECUTOR / "executor.html").read_text().replace("__APP_ORIGIN__", app_origin).encode()
                    content_type = "text/html; charset=utf-8"
                    csp = "default-src 'none'; script-src 'self' 'unsafe-inline'; connect-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'"
                elif path == "/protocol.js":
                    body = (EXECUTOR / "protocol.js").read_bytes()
                    content_type = "text/javascript; charset=utf-8"
                    csp = "default-src 'none'"
                elif role == "executor" and path == "/policy-conformance.js":
                    body = (EXECUTOR / "policy-conformance.js").read_bytes()
                    content_type = "text/javascript; charset=utf-8"
                    csp = WORKER_POLICY
                elif role == "executor" and path == "/policy-target":
                    body = b"/* Public, empty conformance fixture. */"
                    content_type = "text/javascript; charset=utf-8"
                    csp = WORKER_POLICY
                elif role == "executor" and path == "/worker.js":
                    body = b"\n".join((runtime / name).read_bytes() for name in ["pyodide.asm.js", "pyodide.js"])
                    body += b"\n" + (EXECUTOR / "protocol.js").read_bytes() + b"\n" + (EXECUTOR / "worker.js").read_bytes()
                    content_type = "text/javascript; charset=utf-8"
                    csp = WORKER_POLICY
                elif role == "executor" and path.removeprefix("/runtime/") in ASSETS and path.startswith("/runtime/"):
                    body = (runtime / path.removeprefix("/runtime/")).read_bytes()
                    content_type = "application/octet-stream"
                    csp = "default-src 'none'"
                else:
                    self.send_error(404)
                    return
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Security-Policy", csp)
                self.send_header("Cache-Control", "no-store")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.send_header("Referrer-Policy", "no-referrer")
                self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *_args):
                pass
        return Handler

    app = ThreadingHTTPServer(("127.0.0.1", args.app_port), handler("app"))
    executor = ThreadingHTTPServer(("127.0.0.1", args.executor_port), handler("executor"))
    threading.Thread(target=executor.serve_forever, daemon=True).start()
    print(f"PROTOTIPO DESCARTABLE: {app_origin}\nEjecutor: {executor_origin}\nRuntime público: {runtime}\nCtrl+C para cerrar.", flush=True)
    try:
        app.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        app.server_close()
        executor.shutdown()
        executor.server_close()


if __name__ == "__main__":
    main()
