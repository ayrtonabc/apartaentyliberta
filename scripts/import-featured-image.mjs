/**
 * import-featured-image.mjs — normaliza la foto destacada de la portada.
 *
 * Toma public/destacada.jpg, la pasa a WebP con nombre en polaco y la deja en
 * public/assets/editorial/, que es la carpeta de imágenes editoriales y ya está
 * registrada en SOURCE_DIRS de responsive-images.mjs.
 *
 * Decisiones:
 *   - Nombre en polaco, como el resto del sitio (`dom-z-ogrodem` = casa con
 *     jardín). Los nombres de archivo acaban en URLs públicas.
 *   - WebP, el formato que usa todo el sitio.
 *   - Ancho máximo 1600 px, el nativo de la foto. No se amplía ni se recorta.
 *
 * El original se respalda en public/import-original/otros/.
 *
 * Uso: node scripts/import-featured-image.mjs
 */
import sharp from "sharp";
import { mkdir, copyFile, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const RAIZ = process.cwd();
const ORIGEN = resolve(RAIZ, "public", "destacada.jpg");
const DESTINO_DIR = resolve(RAIZ, "public", "assets", "editorial");
const RESPALDO_DIR = resolve(RAIZ, "public", "import-original", "otros");
const NOMBRE = "dom-z-ogrodem.webp";

async function main() {
  if (!existsSync(ORIGEN)) {
    console.error(`No se encuentra ${ORIGEN}`);
    process.exit(1);
  }
  await mkdir(DESTINO_DIR, { recursive: true });
  await mkdir(RESPALDO_DIR, { recursive: true });

  const meta = await sharp(ORIGEN).metadata();
  const antes = (await stat(ORIGEN)).size;
  const destino = join(DESTINO_DIR, NOMBRE);

  await sharp(ORIGEN)
    .rotate()
    .resize({ width: Math.min(meta.width ?? 1600, 1600), withoutEnlargement: true })
    .webp({ quality: 82, effort: 6 })
    .toFile(destino);

  const despues = (await stat(destino)).size;
  const salida = await sharp(destino).metadata();

  console.log(`  original: ${meta.format} ${meta.width}×${meta.height}  ${(antes / 1024).toFixed(0)} KB`);
  console.log(`  salida:   webp ${salida.width}×${salida.height}  ${(despues / 1024).toFixed(0)} KB`);
  console.log(`  ruta:     public/assets/editorial/${NOMBRE}`);
  console.log(
    `  proporción ${(salida.width / salida.height).toFixed(2)} (16:9) · la figura debe usar la misma para no recortar`,
  );

  try {
    await copyFile(ORIGEN, join(RESPALDO_DIR, "destacada.jpg"));
    await rm(ORIGEN, { force: true });
    console.log("  original respaldado en public/import-original/otros/ y retirado de public/");
  } catch {
    console.warn("  aviso: no se pudo retirar el original de public/");
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
