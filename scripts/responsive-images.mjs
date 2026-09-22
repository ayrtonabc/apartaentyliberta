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
import { mkdir, readdir, stat, writeFile, readFile } from "node:fs/promises";
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

  for (const src of sources) {
    const key = publicKey(src);
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

  await mkdir(dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(
    `[images] ${Object.keys(manifest).length} imágenes · ${generated} variantes nuevas · ${skipped} ya vigentes`,
  );
}

main().catch((err) => {
  console.error("[images] error:", err.message);
  process.exitCode = 1;
});
