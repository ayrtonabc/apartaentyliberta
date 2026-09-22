/**
 * import-gastro-image.mjs — normaliza la foto de la sección de gastronomía.
 *
 * Toma public/gastronomia.avif, la pasa a WebP con el nombre que usa el sitio y
 * la deja en public/assets/editorial/, que es la carpeta de imágenes editoriales
 * y ya está registrada en SOURCE_DIRS de responsive-images.mjs.
 *
 * SOBRE EL TAMAÑO
 *
 * El original mide 400×600. Se conserva a resolución nativa, sin recortar ni
 * ampliar: ampliarla no añadiría detalle y recortarla perdería encuadre. Su
 * proporción (2:3) es la que usa la figura de la sección, así que encaja sin
 * recorte.
 *
 * Aviso: 400 px de ancho es poco para una pantalla de alta densidad. En la
 * columna donde va (unos 515 px CSS) se verá algo blanda en pantallas retina.
 * Para que se vea nítida haría falta un original de al menos 1000 px de ancho.
 *
 * Uso: node scripts/import-gastro-image.mjs
 */
import sharp from "sharp";
import { mkdir, copyFile, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const RAIZ = process.cwd();
const ORIGEN = resolve(RAIZ, "public", "gastronomia.avif");
const DESTINO_DIR = resolve(RAIZ, "public", "assets", "editorial");
const RESPALDO_DIR = resolve(RAIZ, "public", "import-original", "otros");
const NOMBRE = "gastronomia.webp";

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
    .webp({ quality: 86, effort: 6 })
    .toFile(destino);

  const despues = (await stat(destino)).size;
  const salida = await sharp(destino).metadata();

  console.log(`  original: ${meta.format} ${meta.width}×${meta.height}  ${(antes / 1024).toFixed(0)} KB`);
  console.log(`  salida:   webp ${salida.width}×${salida.height}  ${(despues / 1024).toFixed(0)} KB`);
  console.log(`  ruta:     public/assets/editorial/${NOMBRE}`);
  console.log(
    `  proporción ${(salida.width / salida.height).toFixed(2)} · la figura usa 2:3 (0.67), así que encaja sin recorte`,
  );

  // Respaldo del original
  try {
    await copyFile(ORIGEN, join(RESPALDO_DIR, "gastronomia.avif"));
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
