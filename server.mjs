/**
 * server.mjs
 * ----------------------------------------------------------------------------
 * Servidor de producción propio, en lugar del arranque automático del adaptador
 * de Node. Motivo: el adaptador sirve el HTML prerenderizado con `send`, que no
 * comprime nada, así que el middleware de Astro nunca ve esas respuestas y el
 * Brotli de build no se aplica a los documentos.
 *
 * Este servidor:
 *   1. Sirve el HTML prerenderizado con compresión Brotli (o gzip) en streaming.
 *   2. Aplica cabeceras de caché y de seguridad a todo lo que sirve.
 *   3. Deja pasar el resto (API, 404 y rutas on-demand) al handler de Astro, que
 *      ya comprime por su cuenta desde src/middleware.ts.
 *
 * Uso: node ./server.mjs   (o npm start / npm run preview)
 */
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join, extname, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createBrotliCompress, createGzip, constants as zlibConstants } from "node:zlib";

process.env.ASTRO_NODE_AUTOSTART = process.env.ASTRO_NODE_AUTOSTART ?? "disabled";

const { handler } = await import("./dist/server/entry.mjs");

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? "0.0.0.0";
const CLIENT_DIR = fileURLToPath(new URL("./dist/client/", import.meta.url));

/** Tipos comprimibles. */
const COMPRESSIBLE = new Set([
  "text/html",
  "text/css",
  "text/plain",
  "text/xml",
  "application/javascript",
  "application/json",
  "application/xml",
  "application/manifest+json",
  "image/svg+xml",
]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "geolocation=(self), camera=(), microphone=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

function cacheControlFor(pathname) {
  if (pathname.startsWith("/_astro/")) return "public, max-age=31536000, immutable";
  if (/\.(?:webp|avif|jpe?g|png|gif|svg|ico|woff2?|mp4|pdf)$/i.test(pathname)) {
    return "public, max-age=604800, stale-while-revalidate=86400";
  }
  return "public, max-age=0, must-revalidate";
}

function pickEncoding(acceptEncoding = "") {
  if (/\bbr\b/.test(acceptEncoding)) return "br";
  if (/\bgzip\b/.test(acceptEncoding)) return "gzip";
  return null;
}

/** Resuelve una URL a un archivo real dentro de dist/client, o null. */
async function resolveFile(pathname) {
  // Evita path traversal
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  if (safe.includes(`..${sep}`) || safe.includes("../")) return null;

  const candidates = [];
  if (safe.endsWith("/")) {
    candidates.push(join(CLIENT_DIR, safe, "index.html"));
  } else if (extname(safe)) {
    candidates.push(join(CLIENT_DIR, safe));
  } else {
    candidates.push(join(CLIENT_DIR, safe, "index.html"));
    candidates.push(join(CLIENT_DIR, `${safe}.html`));
  }

  for (const candidate of candidates) {
    if (!candidate.startsWith(CLIENT_DIR)) continue;
    try {
      const info = await stat(candidate);
      if (info.isFile()) return { file: candidate, size: info.size };
    } catch {
      // siguiente candidato
    }
  }
  return null;
}

/** Devuelve la variante precomprimida si existe; si no, el archivo original. */
async function pickVariant(file, encoding) {
  if (!encoding) return { file, precompressed: false };
  try {
    const variant = `${file}.${encoding === "br" ? "br" : "gz"}`;
    const info = await stat(variant);
    if (info.isFile() && info.size > 0) return { file: variant, precompressed: true, size: info.size };
  } catch {
    // sin variante precomprimida
  }
  return { file, precompressed: false };
}

async function serveStatic(req, res, url) {
  const resolved = await resolveFile(url.pathname);
  if (!resolved) return false;

  const { size } = resolved;
  const ext = extname(resolved.file).toLowerCase();
  const type = MIME[ext] ?? "application/octet-stream";

  res.setHeader("Content-Type", type);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(key, value);
  res.setHeader("Cache-Control", cacheControlFor(url.pathname));

  const isHead = req.method === "HEAD";
  const encoding = isHead ? null : pickEncoding(req.headers["accept-encoding"]);
  const compress = encoding !== null && COMPRESSIBLE.has(type.split(";")[0]) && size >= 1024;

  if (!compress) {
    res.setHeader("Content-Length", String(size));
    res.writeHead(200);
    if (isHead) {
      res.end();
      return true;
    }
    createReadStream(resolved.file).pipe(res);
    return true;
  }

  const variant = await pickVariant(resolved.file, encoding);

  res.setHeader("Content-Encoding", variant.precompressed ? encoding : encoding);
  res.setHeader("Vary", "Accept-Encoding");

  if (variant.precompressed) {
    // Servir el archivo ya comprimido en build: sin coste de CPU por petición
    res.setHeader("Content-Length", String(variant.size));
    res.writeHead(200);
    createReadStream(variant.file).pipe(res);
    return true;
  }

  // Reserva: comprimir en streaming
  res.writeHead(200);
  const stream = createReadStream(resolved.file);
  const compressor =
    encoding === "br"
      ? createBrotliCompress({
          params: {
            [zlibConstants.BROTLI_PARAM_QUALITY]: 5,
            [zlibConstants.BROTLI_PARAM_SIZE_HINT]: size,
          },
        })
      : createGzip({ level: 6 });

  stream.on("error", () => res.destroy());
  compressor.on("error", () => res.destroy());
  stream.pipe(compressor).pipe(res);
  return true;
}

const server = createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }

  try {
    const handled = await serveStatic(req, res, url);
    if (!handled) handler(req, res);
  } catch (error) {
    console.error("[server] error:", error);
    if (!res.headersSent) res.writeHead(500);
    res.end("Internal server error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  Apartamenty Liberta listo en http://localhost:${PORT}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
