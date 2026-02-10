import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KIOSK_BASE = "/kiosk";

function resolveKioskRoot(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // Packaged: kiosk dist alongside gateway
    path.resolve(here, "../kiosk"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
}

function contentTypeForExt(ext: string): string {
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
    case ".map":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

let cachedRoot: string | null | undefined;

export function handleKioskHttpRequest(req: IncomingMessage, res: ServerResponse): boolean {
  const url = req.url ?? "/";
  if (!url.startsWith(KIOSK_BASE)) return false;

  if (cachedRoot === undefined) {
    cachedRoot = resolveKioskRoot();
  }
  if (!cachedRoot) return false;

  let filePath = url.slice(KIOSK_BASE.length) || "/";
  // Strip query strings
  const qIdx = filePath.indexOf("?");
  if (qIdx !== -1) filePath = filePath.slice(0, qIdx);

  // Default to index.html for SPA
  if (filePath === "/" || filePath === "") filePath = "/index.html";

  const resolved = path.resolve(cachedRoot, `.${filePath}`);
  // Prevent directory traversal
  if (!resolved.startsWith(cachedRoot)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return true;
  }

  try {
    const data = fs.readFileSync(resolved);
    const ext = path.extname(resolved).toLowerCase();
    res.statusCode = 200;
    res.setHeader("Content-Type", contentTypeForExt(ext));
    if (ext !== ".html") {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
    res.end(data);
    return true;
  } catch {
    // SPA fallback: serve index.html for non-asset routes
    if (!path.extname(filePath)) {
      try {
        const indexData = fs.readFileSync(path.join(cachedRoot, "index.html"));
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(indexData);
        return true;
      } catch {
        // fall through
      }
    }
    return false;
  }
}
