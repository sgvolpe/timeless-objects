// Tiny zero-dependency static server for site/: node serve.mjs [port] [path/to/data.json]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "site");
const DATA = process.argv[3] || process.env.DATA || join(ROOT, "timeless-objects.json");
const PORT = Number(process.argv[2] || process.env.PORT || 4321);
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = url === "/timeless-objects.json" ? DATA
    : join(ROOT, normalize(url === "/" ? "/index.html" : url).replace(/^(\.\.[/\\])+/, ""));
  if (file !== DATA && !file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": (TYPES[extname(file)] || "application/octet-stream") + "; charset=utf-8",
      "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(PORT, () => console.log(`Timeless Objects running at http://localhost:${PORT}`));
