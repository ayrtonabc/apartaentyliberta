/**
 * middleware.ts
 * ----------------------------------------------------------------------------
 * Middleware de servidor (adaptador @astrojs/node). Se ocupa de dos cosas que
 * el build estático no puede resolver:
 *
 *   1. Compresión en tiempo de ejecución (Brotli con reserva a gzip) para
 *      respuestas textuales. Las páginas llevan el CSS inline (~84 KB), así que
 *      comprimirlas baja el peso real a ~28 KB.
 *
 *   2. Cabeceras de seguridad y de caché:
 *      - Assets con hash de Vite: caché inmutable de un año.
 *      - Imágenes de /assets: caché larga (cambian poco).
 *      - HTML: revalidate, para poder publicar contenido sin esperar cachés.
 */
import type { MiddlewareHandler } from "astro";
import { brotliCompressSync, gzipSync, constants as zlibConstants } from "node:zlib";

const COMPRESSIBLE = /^(?:text\/|application\/(?:javascript|json|xml|manifest\+json)|image\/svg\+xml)/i;
/** Por debajo de este tamaño no compensa el coste de comprimir. */
const MIN_SIZE = 1024;

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "geolocation=(self), camera=(), microphone=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  /**
   * Misma CSP que `server.mjs`. Aquí cubre las respuestas que genera Astro en
   * caliente (la API); el HTML prerenderizado lo sirve `server.mjs`, que pone la
   * suya. Si se cambia una, hay que cambiar la otra.
   */
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self' https://www.booking.com https://secure.booking.com https://booking.com",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    // youtube-nocookie: reproductores de la sección "Nagrano w Liberta"
    "frame-src https://www.google.com https://maps.google.com https://consent.google.com https://www.youtube-nocookie.com",
  ].join("; "),
};

function cacheControlFor(pathname: string): string {
  // Assets con hash generados por Vite → inmutables
  if (pathname.startsWith("/_astro/")) {
    return "public, max-age=31536000, immutable";
  }
  // Imágenes y estáticos del cliente
  if (/\.(?:webp|avif|jpe?g|png|gif|svg|ico|woff2?|mp4)$/i.test(pathname)) {
    return "public, max-age=604800, stale-while-revalidate=86400";
  }
  // Documentos: revalidar siempre para poder publicar cambios al instante
  return "public, max-age=0, must-revalidate";
}

export const onRequest: MiddlewareHandler = async (context, next) => {
  /*
   * Las páginas prerenderizadas NO pasan por aquí en producción: `server.mjs`
   * las sirve directamente desde dist/client con sus propias cabeceras y su
   * Brotli precomprimido.
   *
   * Durante el build, en cambio, Astro sí ejecuta el middleware con una petición
   * sintética para cada ruta prerenderizada. Leer sus headers lanzaba 43 avisos
   * («Astro.request.headers... is not available on prerendered pages») y el
   * middleware comprimía el HTML para nada, porque ese resultado no se guarda.
   * Salir aquí es lo que hace que el build deje de mentir.
   */
  if (context.isPrerendered) return next();

  const response = await next();
  const url = new URL(context.request.url);
  const headers = new Headers(response.headers);

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }

  if (url.protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=31536000");
  }

  if (context.request.method === "GET") {
    headers.set("Cache-Control", cacheControlFor(url.pathname));
  }

  // --- Compresión -----------------------------------------------------------
  const contentType = headers.get("Content-Type") ?? "";
  const alreadyEncoded = headers.has("Content-Encoding");
  if (alreadyEncoded || !COMPRESSIBLE.test(contentType) || context.request.method === "HEAD") {
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  const accept = context.request.headers.get("Accept-Encoding") ?? "";
  const encoding = accept.includes("br") ? "br" : accept.includes("gzip") ? "gzip" : null;
  if (!encoding) {
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  let body;
  try {
    body = Buffer.from(await response.arrayBuffer());
  } catch {
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  if (body.byteLength < MIN_SIZE) {
    return new Response(body, { status: response.status, statusText: response.statusText, headers });
  }

  const compressed =
    encoding === "br"
      ? brotliCompressSync(body, {
          params: {
            [zlibConstants.BROTLI_PARAM_QUALITY]: 5,
            [zlibConstants.BROTLI_PARAM_SIZE_HINT]: body.byteLength,
          },
        })
      : gzipSync(body, { level: 6 });

  // Solo se usa la versión comprimida si realmente ahorra bytes
  if (compressed.byteLength >= body.byteLength) {
    return new Response(body, { status: response.status, statusText: response.statusText, headers });
  }

  headers.set("Content-Encoding", encoding);
  headers.set("Vary", headers.has("Vary") ? `${headers.get("Vary")}, Accept-Encoding` : "Accept-Encoding");
  headers.set("Content-Length", String(compressed.byteLength));

  return new Response(compressed, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
