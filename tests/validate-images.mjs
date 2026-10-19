// tests/validate-images.mjs
// Ejecuta: node tests/validate-images.mjs
//
// POR QUÉ EXISTE
//
// Las fotos de cada apartamento se sustituyen cuando el propietario manda un
// envío nuevo. Al hacerlo, cualquier ruta escrita «a mano» hacia un archivo que
// ya no existe se queda rota **en silencio**: el build no falla, la página se
// sirve con un hueco y nadie se entera hasta que alguien mira.
//
// Pasó dos veces:
//   - el 404 apuntaba a `liberta-ii/exterior-noc.jpg`, que desapareció al
//     importar las fotos nuevas de esa unidad;
//   - la búsqueda de disponibilidad pedía `exterior-dzien.jpg` a las cuatro
//     unidades, y Liberta II ya no lo tenía.
//
// Este test comprueba, sin navegador y sin build:
//   1. Que cada foto declarada en `src/data/apartments.ts` existe en disco.
//   2. Que cada instalación de `facilities.ts` tiene su `.webp`.
//   3. Que cada `image` declarada en `attractions.ts` existe.
//   4. Que cada ruta literal `/assets/…` de `src/` existe en `public/`.
//
// Las rutas construidas con plantillas (`${apartment.id}`) no se pueden
// comprobar aquí; por eso el punto 1 valida el DATO, no el HTML.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "public");

const errors = [];
const checks = [];

function exists(relPath) {
  return existsSync(join(PUBLIC, relPath.replace(/^\//, "")));
}

function check(relPath, origin) {
  checks.push(relPath);
  if (!exists(relPath)) {
    errors.push(`falta ${relPath}  ← ${origin}`);
  }
}

async function loadTs(relPath) {
  return import(pathToFileURL(join(ROOT, relPath)).href);
}

// ---------------------------------------------------------------------------
// 1) Fotos de los apartamentos
// ---------------------------------------------------------------------------

const { apartments } = await loadTs("src/data/apartments.ts");

for (const apartment of apartments) {
  const dir = `assets/apartments/${apartment.id}`;
  const files = [apartment.photos.hero, apartment.photos.layout, ...apartment.photos.gallery];
  for (const file of files) {
    check(`${dir}/${file}`, `apartments.ts → ${apartment.id}`);
  }
  // El hero no puede ser una foto que no exista: es la tarjeta y la cabecera.
  checks.push(`${apartment.id}: hero declarado`);
}

// ---------------------------------------------------------------------------
// 2) Instalaciones del complejo
// ---------------------------------------------------------------------------

const { facilities } = await loadTs("src/data/facilities.ts");

for (const facility of facilities) {
  check(`assets/facilities/${facility.slug}.webp`, `facilities.ts → ${facility.slug}`);
}

// ---------------------------------------------------------------------------
// 3) Atracciones con imagen declarada
// ---------------------------------------------------------------------------

const { attractions } = await loadTs("src/data/attractions.ts");

for (const attraction of attractions) {
  if (!attraction.image) continue;
  check(attraction.image, `attractions.ts → ${attraction.slug}`);
}

// ---------------------------------------------------------------------------
// 4) Rutas literales en el código
// ---------------------------------------------------------------------------

const SOURCE_EXT = /\.(astro|ts|mjs)$/;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      out.push(...walk(full));
    } else if (SOURCE_EXT.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Literales de cadena que empiezan por /assets/. */
const ASSET_RE = /["'`](\/assets\/[^"'`\s]+)["'`]/g;

for (const file of walk(join(ROOT, "src"))) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(ASSET_RE)) {
    const asset = match[1];
    if (asset.includes("${") || asset.includes("?")) continue;
    check(asset, relative(ROOT, file).split(sep).join("/"));
  }
}

// ---------------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------------

if (errors.length > 0) {
  console.error(`✗ ${errors.length} referencia(s) a imágenes inexistentes:\n`);
  for (const error of errors) console.error(`  - ${error}`);
  console.error(
    "\n  Si acabas de importar fotos nuevas, actualiza también las rutas fijas" +
      " de `src/pages/` y los componentes que no lean el dato.",
  );
  process.exit(1);
}

console.log(`✓ ${checks.length} referencias de imagen verificadas (${apartments.length} apartamentos, ${facilities.length} instalaciones, ${attractions.length} atracciones).`);
