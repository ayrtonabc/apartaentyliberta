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

/*
 * `.env` en el VPS.
 *
 * El adaptador de Node NO lee el archivo `.env` al arrancar (Astro solo lo hace
 * con `astro dev`), así que sin esto un despliegue con `node ./server.mjs` y un
 * `.env` en la raíz arrancaría sin RESEND_API_KEY y las reservas se quedarían
 * en el log. `loadEnvFile` no pisa lo que ya venga del entorno, así que en
 * Docker/systemd las variables del contenedor siguen mandando.
 *
 * Disponible desde Node 20.12; en versiones anteriores se ignora sin romper.
 */
try {
  process.loadEnvFile?.();
} catch {
  // No hay .env (Docker, systemd, CI): las variables vienen del entorno.
}

/**
 * `server.mjs` ES el servidor de producción, así que lo declara.
 *
 * Importa por dos cosas:
 *   1. Astro y sus dependencias toman el camino de producción (sin avisos de
 *      desarrollo ni comprobaciones extra por petición).
 *   2. `src/lib/availability.ts` usa NODE_ENV para decidir si puede leer el
 *      calendario de EJEMPLO. Sin esta línea, `npm start` en un VPS haría
 *      NODE_ENV=undefined y el `.ics` de muestra —con reservas inventadas—
 *      bloquearía fechas reales.
 */
process.env.NODE_ENV = process.env.NODE_ENV ?? "production";

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
  /**
   * CSP del sitio.
   *
   * Es una política de "sin terceros": el sitio no carga fuentes, scripts ni
   * imágenes externas; lo único ajeno es el iframe de Google Maps.
   *
   * `'unsafe-inline'` en `script-src` y `style-src` es obligatorio aquí: el CSS
   * va inline en el HTML por diseño (0 peticiones CSS, ver astro.config.mjs) y
   * Astro emite scripts inline. Aun así bloquea lo que de verdad importa en un
   * sitio así: inyectar un `<script src="https://malo...">`, secuestrar
   * `base-uri`, cambiar el destino de un formulario o meter el sitio en un
   * iframe ajeno.
   *
   * `frame-src` incluye consent.google.com porque el embed de Maps puede pasar
   * por la pantalla de consentimiento de la UE.
   *
   * NO se incluye `upgrade-insecure-requests`: mientras el VPS no tenga TLS
   * forzado, esa directiva rompería el sitio servido por http.
   */
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    /*
     * `youtube-nocookie.com` está aquí por la sección "Nagrano w Liberta": los
     * reproductores se insertan solo al pulsar play, así que sin esta directiva
     * el iframe saldría bloqueado. Se usa el dominio sin cookies para no enviar
     * datos del visitante a YouTube antes de que lo pida.
     */
    "frame-src https://www.google.com https://maps.google.com https://consent.google.com https://www.youtube-nocookie.com",
  ].join("; "),
};

/** HSTS solo tiene sentido (y solo se acepta) si la petición llegó por HTTPS. */
function isHttps(req) {
  if (req.socket?.encrypted) return true;
  const proto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
  return proto === "https";
}

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

  /*
   * Un archivo estático solo se sirve con GET o HEAD.
   *
   * Antes, un POST a `/` devolvía el HTML con 200: la petición ni llegaba a
   * Astro, así que ni el CSRF de Astro ni el endpoint de reservas veían nada.
   * Los métodos que sí necesitan cuerpo (la API) no entran aquí porque su ruta
   * no resuelve a un archivo de dist/client.
   */
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method not allowed");
    return true;
  }

  const { size } = resolved;
  const ext = extname(resolved.file).toLowerCase();
  const type = MIME[ext] ?? "application/octet-stream";

  res.setHeader("Content-Type", type);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(key, value);
  if (isHttps(req)) res.setHeader("Strict-Transport-Security", "max-age=31536000");
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

  res.setHeader("Content-Encoding", encoding);
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
