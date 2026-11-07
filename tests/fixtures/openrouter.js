import https from "node:https";
import { readFileSync } from "node:fs";

// Test-only localhost certificate. No real credentials or paid inference.
export async function streamingOpenRouter(page) {
  const connections = new Set();
  const requests = [];
  const responses = [];
  let closed = 0;
  const server = https.createServer(
    {
      key: readFileSync(new URL("./localhost-key.pem", import.meta.url)),
      cert: readFileSync(new URL("./localhost-cert.pem", import.meta.url)),
    },
    (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "*");
      if (req.method === "OPTIONS") {
        res.end();
        return;
      }
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        requests.push(JSON.parse(body));
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        });
        res.flushHeaders();
        responses.push(res);
        res.on("close", () => {
          closed++;
        });
      });
    },
  );
  server.on("connection", (socket) => {
    connections.add(socket);
    socket.on("close", () => connections.delete(socket));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  await page.route("https://openrouter.ai/api/v1/chat/completions", (route) =>
    route.continue({
      url: `https://127.0.0.1:${server.address().port}/chat/completions`,
    }),
  );
  return {
    requests,
    responses,
    get closed() {
      return closed;
    },
    async close() {
      for (const socket of connections) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
