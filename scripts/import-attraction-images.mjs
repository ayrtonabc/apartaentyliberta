/**
 * import-attraction-images.mjs — normaliza las imágenes de atracciones.
 *
 * Toma los archivos que aportó el propietario (sueltos en public/ y con nombres
 * pensados para ordenarlos a mano), los convierte a WebP y los deja en
 * public/assets/attractions/ con el nombre del slug de cada atracción.
 *
 * Por qué normalizar:
 *   - `rejsmotorowka.webp` era en realidad un JPEG con la extensión cambiada.
 *     Servir un JPEG con extensión .webp funciona por sniffing del navegador,
 *     pero rompe el content-type y cualquier herramienta que se fíe de ella.
 *   - Los nombres con espacios ("szlaki rowerowe.webp") dan problemas en URLs.
 *   - Estaban a 1085 KB; con WebP q82 bajan muchísimo.
 *
 * Los originales se conservan en public/import-original/ para no perder nada.
 *
 * Uso: node scripts/import-attraction-images.mjs
 */
import sharp from "sharp";
import { mkdir, copyFile, rm, stat, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = process.cwd();
const PUBLIC = resolve(ROOT, "public");
const OUT_DIR = join(PUBLIC, "assets", "attractions");
const BACKUP_DIR = join(PUBLIC, "import-original");

/** nombre original → slug de la atracción */
const MANIFIESTO = [
  { origen: "kanalostrodzkoelblaski.webp", slug: "kanal-ostrodzko-elblaski" },
  { origen: "szelagwielki.webp", slug: "jezioro-szelag" },
  { origen: "rejsmotorowka.webp", slug: "rejs-motorowka" },
  { origen: "supikajaki.jpg", slug: "sup-kajaki" },
  { origen: "bunkry.webp", slug: "bunkry-stare-jablonki" },
  { origen: "szlaki rowerowe.webp", slug: "szlaki-rowerowe" },
];

/** Ancho máximo de salida: la tarjeta nunca se muestra más grande que esto. */
const MAX_WIDTH = 1600;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(BACKUP_DIR, { recursive: true });

  console.log("imagen".padEnd(34) + "formato real".padEnd(14) + "original".padEnd(16) + "salida");

  for (const { origen, slug } of MANIFIESTO) {
    const src = join(PUBLIC, origen);
    if (!existsSync(src)) {
      console.log(`  ${origen.padEnd(32)} NO ENCONTRADO`);
      process.exitCode = 1;
      continue;
    }

    const meta = await sharp(src).metadata();
    const antes = (await stat(src)).size;
    const destino = join(OUT_DIR, `${slug}.webp`);

    await sharp(src)
      .rotate() // respeta la orientación EXIF
      .resize({ width: Math.min(meta.width ?? MAX_WIDTH, MAX_WIDTH), withoutEnlargement: true })
      .webp({ quality: 78, effort: 6 })
      .toFile(destino);

    const despues = (await stat(destino)).size;
    const salidaMeta = await sharp(destino).metadata();

    console.log(
      `  ${origen.padEnd(32)}${String(meta.format).padEnd(14)}` +
        `${`${meta.width}×${meta.height}`.padEnd(16)}` +
        `${slug}.webp ${salidaMeta.width}×${salidaMeta.height}  ` +
        `${(antes / 1024).toFixed(0)} KB → ${(despues / 1024).toFixed(0)} KB`,
    );

    // El original se copia al respaldo y luego se borra del sitio público.
    // Se copia en vez de mover porque en Windows el archivo puede estar
    // bloqueado por el visor de imágenes o el navegador y `rename` da EBUSY.
    const respaldo = join(BACKUP_DIR, origen);
    try {
      await copyFile(src, respaldo);
      await rm(src, { force: true });
    } catch (error) {
      console.warn(`  aviso: no se pudo retirar ${origen} del sitio público (${error.code ?? error.message})`);
    }
  }

  // Nota para quien mire la carpeta después
  await writeFile(
    join(BACKUP_DIR, "LEEME.txt"),
    [
      "Originales de las imágenes de atracciones, tal como los aportó el propietario.",
      "",
      "Las versiones que usa la web están en public/assets/attractions/ con el nombre",
      "del slug de cada atracción. Se generan con:",
      "",
      "  node scripts/import-attraction-images.mjs",
      "",
      "No se enlazan desde el sitio: se conservan solo como respaldo.",
      "",
    ].join("\n"),
    "utf8",
  );

  const restantes = (await readdir(PUBLIC)).filter((n) => /\.(jpe?g|png|webp|avif)$/i.test(n));
  console.log(`\nimágenes sueltas que quedan en public/: ${restantes.length ? restantes.join(", ") : "ninguna"}`);
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
