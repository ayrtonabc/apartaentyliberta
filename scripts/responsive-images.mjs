/**
 * responsive-images.mjs
 * ----------------------------------------------------------------------------
 * Genera variantes responsivas en WebP + placeholders LQIP para todas las
 * imágenes de contenido del sitio.
 *
 * Por qué: las fotos originales pesan 150–500 KB y se sirven en resolución
 * única. Este script produce, por imagen:
 *   - variantes WebP a varios anchos (para srcset con sizes correctos)
 *   - un placeholder de 20px en base64 (para el efecto blur-up sin CLS)
 *   - las dimensiones reales (para width/height y evitar layout shift)
 *
 * Salida:
 *   public/assets/responsive/<rel-path>/<name>-<width>.webp
 *   src/data/image-manifest.json
 *
 * Es idempotente: si la variante ya existe y es más nueva que el original,
 * no la regenera. Se ejecuta en predev/prebuild.
 */
import { mkdir, readdir, stat, unlink, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const PUBLIC_DIR = resolve(ROOT, "public");
const OUT_DIR = join(PUBLIC_DIR, "assets", "responsive");
const MANIFEST_PATH = resolve(ROOT, "src", "data", "image-manifest.json");

/** Carpetas con imágenes de contenido (se ignoran branding/iconos). */
const SOURCE_DIRS = [
  "assets/hero",
  "assets/apartments",
  "assets/editorial",
  "assets/events",
  "assets/attractions",
  "assets/facilities",
  "assets/videos",
  "assets/wellness",
];

/** Anchos objetivo. Se recortan automáticamente si superan el ancho original. */
const WIDTHS = [480, 768, 1100, 1400];
const LQIP_WIDTH = 20;
const QUALITY = 76;
const LQIP_QUALITY = 40;

const IMAGE_RE = /\.(jpe?g|png|webp|avif)$/i;

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (IMAGE_RE.test(entry.name)) out.push(full);
  }
  return out;
}

async function isStale(src, out) {
  if (!existsSync(out)) return true;
  try {
    const [a, b] = await Promise.all([stat(src), stat(out)]);
    return a.mtimeMs > b.mtimeMs;
  } catch {
    return true;
  }
}

/** Ruta relativa a public/, normalizada con "/" (para URLs). */
function publicKey(absPath) {
  return relative(PUBLIC_DIR, absPath).split(sep).join("/");
}

async function main() {
  const sources = [];
  for (const dir of SOURCE_DIRS) {
    const abs = join(PUBLIC_DIR, dir);
    sources.push(...(await walk(abs)));
  }

  if (sources.length === 0) {
    console.log("[images] sin imágenes de contenido — nada que hacer");
    return;
  }

  let manifest = {};
  if (existsSync(MANIFEST_PATH)) {
    try {
      manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
    } catch {
      manifest = {};
    }
  }

  let generated = 0;
  let skipped = 0;

  /**
   * Se parte del manifiesto anterior para reutilizar los LQIP ya calculados,
   * pero solo se conservan las claves cuyas imágenes siguen existiendo: al
   * sustituir las fotos de un apartamento quedaban entradas de archivos
   * borrados que engordaban el JSON y despistaban al buscar.
   */
  const seen = new Set();

  for (const src of sources) {
    const key = publicKey(src);
    seen.add(key);
    const meta = await sharp(src).metadata();
    const srcWidth = meta.width ?? 0;
    const srcHeight = meta.height ?? 0;
    if (!srcWidth || !srcHeight) continue;

    const dir = dirname(key);
    const base = key.slice(dir.length + 1).replace(IMAGE_RE, "");
    const outDirAbs = join(OUT_DIR, dir);

    const widths = [...new Set(WIDTHS.filter((w) => w <= srcWidth).concat(srcWidth))]
      .filter((w) => w > 0)
      .sort((a, b) => a - b);

    const sources_ = [];

    for (const w of widths) {
      const outAbs = join(outDirAbs, `${base}-${w}.webp`);
      if (await isStale(src, outAbs)) {
        if (!existsSync(outDirAbs)) await mkdir(outDirAbs, { recursive: true });
        await sharp(src)
          .resize({ width: w, withoutEnlargement: true, kernel: "lanczos3" })
          .webp({ quality: QUALITY, effort: 5 })
          .toFile(outAbs);
        generated++;
      } else {
        skipped++;
      }
      sources_.push(`/assets/responsive/${dir}/${base}-${w}.webp ${w}w`);
    }

    // Placeholder LQIP en base64 (se incrusta en el HTML, ~0.4 KB)
    const srcStat = await stat(src);
    const prev = manifest[key];
    let lqip = prev?.lqip;
    if (!lqip || !prev?.mtimeMs || srcStat.mtimeMs > prev.mtimeMs) {
      const buf = await sharp(src)
        .resize({ width: LQIP_WIDTH })
        .blur(1.4)
        .webp({ quality: LQIP_QUALITY })
        .toBuffer();
      lqip = `data:image/webp;base64,${buf.toString("base64")}`;
    }

    manifest[key] = {
      width: srcWidth,
      height: srcHeight,
      mtimeMs: srcStat.mtimeMs,
      lqip,
      widths,
      // Se usa el ancho mayor generado como "src" por defecto
      fallback: `/assets/responsive/${dir}/${base}-${widths[widths.length - 1]}.webp`,
    };
  }

  // Entradas de imágenes que ya no existen → fuera del manifiesto
  let stale = 0;
  for (const key of Object.keys(manifest)) {
    if (!seen.has(key)) {
      delete manifest[key];
      stale++;
    }
  }

  await mkdir(dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  // Variantes huérfanas: <base>-<ancho>.webp cuyo original ya no está.
  //
  // Solo se limpian si el manifiesto está COMPLETO (ninguna entrada obsoleta).
  // Si en esta pasada se han descartado claves, es señal de que el manifiesto no
  // refleja todas las fuentes: borrar entonces "huérfanas" elimina variantes de
  // imágenes que sí existen (pasó: 39 variantes borradas y el manifiesto cayendo
  // de 88 a 78 imágenes en una sola ejecución).
  let orphans = 0;
  if (stale === 0) {
    orphans = await pruneOrphanVariants(manifest);
  } else {
    console.warn(
      `[images] limpieza de huérfanas omitida: el manifiesto ha perdido ${stale} entradas en esta pasada. ` +
        "Regenera con `npm run clean && npm run images:responsive` y revisa antes de borrar nada.",
    );
  }

  console.log(
    `[images] ${Object.keys(manifest).length} imágenes · ${generated} variantes nuevas · ${skipped} ya vigentes` +
      (stale ? ` · ${stale} entradas obsoletas del manifiesto` : "") +
      (orphans ? ` · ${orphans} variantes huérfanas borradas` : ""),
  );
}

/**
 * Borra variantes responsivas cuyo original ya no existe.
 *
 * Al cambiar las fotos de un apartamento, las variantes de las antiguas se
 * quedaban en public/assets/responsive: peso muerto en el despliegue y archivos
 * que parecen "la foto del apartamento" cuando ya no lo son.
 */
async function pruneOrphanVariants(manifest) {
  const files = await walk(OUT_DIR);
  let removed = 0;
  for (const file of files) {
    if (!file.endsWith(".webp")) continue;
    const key = relative(PUBLIC_DIR, file).split(sep).join("/");
    const match = key.match(/^assets\/responsive\/(.+)-(\d+)\.webp$/);
    if (!match) continue;
    const [, dirAndBase, width] = match;
    void width;
    // El original puede ser .jpg, .jpeg, .png o .webp
    const exists = [".jpg", ".jpeg", ".png", ".webp"].some(
      (ext) => manifest[`${dirAndBase}${ext}`] || manifest[dirAndBase],
    );
    if (!exists) {
      await unlink(file).catch(() => {});
      removed++;
    }
  }
  return removed;
}

main().catch((err) => {
  console.error("[images] error:", err.message);
  process.exitCode = 1;
});
