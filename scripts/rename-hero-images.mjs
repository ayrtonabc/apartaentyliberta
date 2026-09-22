#!/usr/bin/env node
/**
 * rename-hero-images.mjs
 *
 * Renombra los archivos del hero de nombres tipo "unnamed.webp" y
 * "unnamed (1).webp" (que el adapter Node de Astro no sirve bien
 * por los espacios y paréntesis) a nombres limpios.
 *
 * Mapeo:
 *   unnamed.webp      →  hero-1.webp
 *   unnamed (1).webp  →  hero-2.webp
 *   unnamed (2).webp  →  hero-3.webp
 *   unnamed (3).webp  →  hero-4.webp
 *   unnamed (4).webp  →  hero-5.webp
 *
 * Idempotente: si los hero-N.webp ya existen, no toca nada.
 *
 * Uso:
 *   npm run rename:hero
 */

import { readFile, readdir, rename } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HERO_DIR = join(__dirname, "..", "public", "assets", "hero");

const MAPPING = [
  ["unnamed.webp", "hero-1.webp"],
  ["unnamed (1).webp", "hero-2.webp"],
  ["unnamed (2).webp", "hero-3.webp"],
  ["unnamed (3).webp", "hero-4.webp"],
  ["unnamed (4).webp", "hero-5.webp"],
];

async function fileExists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  // Listar lo que hay actualmente
  let current = [];
  try {
    current = await readdir(HERO_DIR);
  } catch (e) {
    console.error(`✗ No se puede leer ${HERO_DIR}:`, e.message);
    process.exit(1);
  }

  console.log(`→ Carpeta: ${HERO_DIR}`);
  console.log(`  Archivos actuales: ${current.length}`);
  console.log("");

  let renamed = 0;
  let skipped = 0;
  let missing = 0;

  for (const [oldName, newName] of MAPPING) {
    const oldPath = join(HERO_DIR, oldName);
    const newPath = join(HERO_DIR, newName);

    // Si el destino ya existe, skip (idempotente)
    if (await fileExists(newPath)) {
      console.log(`  skip ${newName} (ya existe)`);
      skipped++;
      continue;
    }

    // Si el origen no existe, skip
    if (!(await fileExists(oldPath))) {
      console.log(`  skip ${oldName} (no existe)`);
      missing++;
      continue;
    }

    // Renombrar
    try {
      await rename(oldPath, newPath);
      console.log(`  ✓ ${oldName} → ${newName}`);
      renamed++;
    } catch (e) {
      console.error(`  ✗ falló renombrar ${oldName}: ${e.message}`);
    }
  }

  console.log("");
  console.log(`Resumen: ${renamed} renombrados, ${skipped} ya existían, ${missing} no encontrados`);

  if (renamed > 0) {
    console.log("");
    console.log("Listo. Refresca el navegador (Ctrl+Shift+R) y el hero debería mostrar las 5 imágenes.");
  }
}

main().catch((e) => {
  console.error("✗ ERROR:", e.message);
  process.exit(1);
});
