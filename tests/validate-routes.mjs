// tests/validate-routes.mjs
// Ejecuta: node tests/validate-routes.mjs
//
// POR QUÉ EXISTE
//
// El sitio enlazaba a 58 URLs que devolvían 404, todas por la misma causa:
// `routeMap` declaraba traducciones que nunca se publicaron (`/en/terms/`,
// `/de/agb/`, `/en/area/olsztyn/`, `/en/sup-festival/`…) y `translatePath()`
// no sabía volver de una ruta inglesa o alemana a la polaca.
//
// Este test cierra las dos puertas:
//   1. Cada ruta declarada en `routeMap` tiene que existir como página de Astro.
//   2. Traducir CUALQUIER ruta publicada a CUALQUIER idioma tiene que dar otra
//      ruta publicada (o, si no hay traducción, la polaca), nunca una inventada.
//
// Se importa `src/data/locales.ts` directamente: Node 22.18+ / 24 elimina los
// tipos al vuelo. Si el runtime es más antiguo, falla con un mensaje claro.

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

let mod;
try {
  mod = await import(pathToFileURL(join(ROOT, "src", "data", "locales.ts")).href);
} catch (error) {
  console.error(
    "✗ No se pudo importar src/data/locales.ts.\n" +
      "  Este test necesita Node >= 22.18 (eliminación de tipos nativa).\n" +
      `  Runtime actual: ${process.version}\n  ${error.message}`,
  );
  process.exit(1);
}

const { routeMap, locales, translatePath, hasTranslation, normalizePath } = mod;

const errors = [];
const ok = [];

/** ¿Existe una página de Astro para esta ruta? */
function pageFileFor(route) {
  const clean = normalizePath(route).replace(/^\/|\/$/g, "");
  if (!clean) return join(ROOT, "src", "pages", "index.astro");

  const candidates = [
    join(ROOT, "src", "pages", ...clean.split("/")) + ".astro",
    join(ROOT, "src", "pages", ...clean.split("/"), "index.astro"),
  ];

  // Rutas dinámicas ([slug]): se acepta si existe la carpeta con el [slug]
  const parts = clean.split("/");
  const dir = join(ROOT, "src", "pages", ...parts.slice(0, -1));
  if (existsSync(dir)) {
    const match = candidates.find((candidate) => existsSync(candidate));
    if (match) return match;
    // /apartamenty/liberta-i/ la sirve src/pages/apartamenty/[slug].astro
    const dynamic = join(dir, "[slug].astro");
    if (existsSync(dynamic)) return dynamic;
  }

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

console.log("🔍 Validando rutas declaradas y traducciones\n" + "=".repeat(52));

/* ------------------------------------------- 1. Cada ruta tiene su página */

for (const [key, translations] of Object.entries(routeMap)) {
  for (const locale of locales) {
    const route = translations[locale];
    if (!route) continue;
    const file = pageFileFor(route);
    if (existsSync(file)) {
      ok.push(`${locale}: ${route}`);
    } else {
      errors.push(
        `routeMap["${key}"].${locale} = "${route}" no tiene página (esperada: ${file.replace(ROOT + "\\", "")})`,
      );
    }
  }
}

/* ------------------------------- 2. Traducir una ruta publicada da una ruta publicada */

/** Todas las rutas que el sitio publica de verdad (las de routeMap). */
const published = new Set();
for (const [key, translations] of Object.entries(routeMap)) {
  published.add(normalizePath(key));
  for (const route of Object.values(translations)) {
    if (route) published.add(normalizePath(route));
  }
}
// Páginas de detalle: se aceptan por prefijo de sección
const sectionPrefixes = ["/apartamenty/", "/en/apartments/", "/de/ferienwohnungen/"];

function isPublished(route) {
  const p = normalizePath(route);
  if (published.has(p)) return true;
  return sectionPrefixes.some((prefix) => p.startsWith(prefix) && p !== prefix);
}

for (const route of published) {
  for (const target of locales) {
    const translated = translatePath(route, target);
    if (isPublished(translated)) {
      ok.push(`${route} → ${target}: ${translated}`);
      continue;
    }
    errors.push(`${route} traducida a ${target} da "${translated}", que no está publicada (404)`);
  }
}

/* ------------------------- 3. Sin traducción se enlaza a la polaca, no a un 404 */

for (const [key, translations] of Object.entries(routeMap)) {
  for (const locale of locales) {
    if (hasTranslation(key, locale)) continue;
    const fallback = translatePath(key, locale);
    if (normalizePath(fallback) !== normalizePath(key)) {
      errors.push(
        `${key} no tiene versión ${locale} pero translatePath devuelve "${fallback}" en vez de la polaca`,
      );
    }
  }
}

/* ------------------------------------------------------------- Resultado */

console.log(`\n✔ ${ok.length} comprobaciones correctas`);

if (errors.length > 0) {
  console.log(`\n✗ ${errors.length} errores:`);
  for (const error of errors) console.log(`  - ${error}`);
  process.exit(1);
}

console.log("\n✓ Todas las rutas declaradas existen y todas las traducciones llevan a una página real.");
