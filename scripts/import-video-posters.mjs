/**
 * import-video-posters.mjs
 * ----------------------------------------------------------------------------
 * Descarga las miniaturas de los vídeos grabados en Liberta y las convierte a
 * WebP 16:9 para servirlas desde el propio dominio.
 *
 * Por qué no se enlazan desde i.ytimg.com:
 *   - la CSP del sitio es `img-src 'self' data:`; una imagen externa se
 *     bloquearía (y abriría una conexión a Google antes del consentimiento);
 *   - una miniatura local se puede optimizar, cachear y servir con srcset.
 *
 * Los originales quedan en public/import-original/videos/ y no se publican.
 *
 * Uso: node scripts/import-video-posters.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT = resolve(ROOT, "public/assets/videos");
const ORIGINALS = resolve(ROOT, "public/import-original/videos");

const VIDEOS = [
  { id: "kPhunrv9RDc", slug: "fisher-nie-moge-ci-wiele-dac" },
  { id: "R4yK6LTpaZs", slug: "fisher-bez-szans" },
  { id: "cYMXG1TuKh4", slug: "explozja-nowy-sprzet" },
  { id: "leS87Odlles", slug: "lena-tancz-ze-mna-tancz" },
  { id: "C5ypS7MdNlI", slug: "fisher-tylko-dla-ciebie" },
  { id: "T4-p7wp_KB8", slug: "daniel-dabrowski-byle-bylo-tak" },
  { id: "8UKmPt5Syng", slug: "wesele-w-liberta" },
  { id: "uKUkRSwro1Y", slug: "liberta-luksus-na-mazurach" },
];

const CANDIDATES = ["maxresdefault", "maxres2", "sddefault", "hqdefault"];

async function download(id) {
  for (const name of CANDIDATES) {
    const url = `https://i.ytimg.com/vi/${id}/${name}.jpg`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) continue;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 5000) continue;
    return { buffer, name };
  }
  throw new Error(`Sin miniatura para ${id}`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(ORIGINALS, { recursive: true });

  let count = 0;
  let totalKb = 0;

  for (const video of VIDEOS) {
    const { buffer, name } = await download(video.id);
    const original = join(ORIGINALS, `${video.slug}.jpg`);
    await writeFile(original, buffer);

    const out = join(OUT, `${video.slug}.webp`);
    const info = await sharp(buffer)
      .resize({ width: 1280, height: 720, fit: "cover", position: "centre", withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 })
      .toFile(out);

    const meta = await sharp(out).metadata();
    count++;
    totalKb += info.size / 1024;
    console.log(`✓ ${video.slug.padEnd(34)} ${name.padEnd(14)} ${meta.width}×${meta.height}  ${Math.round(info.size / 1024)} KB`);
  }

  console.log(`\n${count} miniaturas · ${Math.round(totalKb)} KB en total`);
  if (!existsSync(OUT)) throw new Error("No se creó la carpeta de salida");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
