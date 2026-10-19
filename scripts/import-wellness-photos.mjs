/**
 * import-wellness-photos.mjs
 * ----------------------------------------------------------------------------
 * Importa las 7 fotos de sauna y ognisko que entregó el propietario en
 * `C:\Users\Ayrton\Desktop\apartamenty liberta fotos\zdjecia sauna ogniski`.
 *
 * Las PNG de iPhone vienen en Display P3 y pesan 2–3 MB. Aquí se convierten a
 * WebP sRGB, se normalizan a 1600 px de lado mayor y se les quita el metadata.
 * Los originales quedan en `public/import-original/wellness/` (no se publican).
 *
 * Uso: node scripts/import-wellness-photos.mjs [ruta-origen]
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ORIGEN =
  process.argv[2] ?? "C:\\Users\\Ayrton\\Desktop\\apartamenty liberta fotos\\zdjecia sauna ogniski";
const ROOT = process.cwd();
const OUT = resolve(ROOT, "public/assets/wellness");
const ORIGINALS = resolve(ROOT, "public/import-original/wellness");

/** El orden importa: la primera es la foto grande del mosaico. */
const PLAN = [
  { source: "image00001.png", slug: "sauna-wnetrze-lato" },
  { source: "image00002.png", slug: "sauna-wnetrze-lato-2" },
  { source: "image00003.png", slug: "sauna-wnetrze-zima" },
  { source: "image00004.png", slug: "sauna-ogrod-wieczor" },
  { source: "image00005.png", slug: "sauna-beczka-zachod" },
  { source: "image00006.png", slug: "ognisko-zachod" },
  { source: "image00007.png", slug: "ognisko-laka" },
];

const MAX_EDGE = 1600;
const QUALITY = 84;

async function main() {
  if (!existsSync(ORIGEN)) {
    throw new Error(`No existe la carpeta de origen: ${ORIGEN}`);
  }

  await mkdir(OUT, { recursive: true });
  await mkdir(ORIGINALS, { recursive: true });

  let count = 0;
  let totalKb = 0;

  for (const item of PLAN) {
    const src = join(ORIGEN, item.source);
    if (!existsSync(src)) {
      console.warn(`  ⚠ falta ${item.source}`);
      continue;
    }

    const original = await sharp(src).jpeg({ quality: 92 }).toBuffer();
    await writeFile(join(ORIGINALS, `${item.slug}.jpg`), original);

    const out = join(OUT, `${item.slug}.webp`);
    const info = await sharp(src)
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .toColourspace("srgb")
      .webp({ quality: QUALITY, effort: 5 })
      .toFile(out);

    const meta = await sharp(out).metadata();
    count++;
    totalKb += info.size / 1024;
    console.log(
      `  ✓ ${item.slug.padEnd(24)} ← ${item.source.padEnd(16)} ${meta.width}×${meta.height}  ${Math.round(info.size / 1024)} KB`,
    );
  }

  console.log(`\n${count} fotos · ${Math.round(totalKb)} KB en total`);
  console.log("Siguiente paso: npm run images:responsive");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
