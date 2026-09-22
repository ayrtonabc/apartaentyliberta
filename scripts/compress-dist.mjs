/**
 * compress-dist.mjs
 * ----------------------------------------------------------------------------
 * Precomprime los archivos textuales de dist/client en Brotli (.br) y gzip
 * (.gz). Así el servidor no gasta CPU comprimiendo en cada petición y puede
 * enviar el mejor formato que acepte el navegador (Brotli nivel 11, más
 * agresivo que el que se usaría en runtime).
 *
 * Se ejecuta en `postbuild`. Solo procesa extensiones textuales y omite
 * archivos que ya tengan variantes al día.
 */
import { readdir, stat, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, relative, sep } from "node:path";
import { brotliCompress, gzip, constants as zlibConstants } from "node:zlib";
import { promisify } from "node:util";

const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

const ROOT = process.cwd();
const DIST = join(ROOT, "dist", "client");

const EXTENSIONS = new Set([".html", ".css", ".js", ".mjs", ".json", ".xml", ".txt", ".svg"]);
/** Por debajo de este tamaño no compensa. */
const MIN_SIZE = 1024;

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
    if (entry.isDirectory()) {
      // Las variantes responsivas son imágenes: no se comprimen
      if (entry.name === "responsive") continue;
      out.push(...(await walk(full)));
    } else {
      out.push(full);
    }
  }
  return out;
}

async function isFresh(source, target) {
  if (!existsSync(target)) return false;
  try {
    const [a, b] = await Promise.all([stat(source), stat(target)]);
    return b.mtimeMs >= a.mtimeMs;
  } catch {
    return false;
  }
}

async function main() {
  if (!existsSync(DIST)) {
    console.warn("[compress] no existe dist/client — ¿se ejecutó el build?");
    return;
  }

  const files = (await walk(DIST)).filter((f) => EXTENSIONS.has(extname(f).toLowerCase()));

  let created = 0;
  let skipped = 0;
  let rawTotal = 0;
  let brTotal = 0;

  for (const file of files) {
    const info = await stat(file);
    if (info.size < MIN_SIZE) continue;

    const brPath = `${file}.br`;
    const gzPath = `${file}.gz`;

    if ((await isFresh(file, brPath)) && (await isFresh(file, gzPath))) {
      skipped++;
      continue;
    }

    const content = await import("node:fs/promises").then((fs) => fs.readFile(file));

    const [brBuffer, gzBuffer] = await Promise.all([
      brotli(content, {
        params: {
          [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
          [zlibConstants.BROTLI_PARAM_SIZE_HINT]: content.byteLength,
        },
      }),
      gzipAsync(content, { level: 9 }),
    ]);

    // Solo se escribe la variante si realmente ahorra espacio
    if (brBuffer.byteLength < content.byteLength) await writeFile(brPath, brBuffer);
    else if (existsSync(brPath)) await unlink(brPath);

    if (gzBuffer.byteLength < content.byteLength) await writeFile(gzPath, gzBuffer);
    else if (existsSync(gzPath)) await unlink(gzPath);

    created++;
    rawTotal += content.byteLength;
    brTotal += Math.min(brBuffer.byteLength, content.byteLength);
  }

  const saved = rawTotal > 0 ? (100 - (brTotal / rawTotal) * 100).toFixed(0) : "0";
  console.log(
    `[compress] ${created} archivos precomprimidos · ${skipped} ya vigentes${
      rawTotal > 0 ? ` · ahorro ${saved}% con Brotli` : ""
    }`,
  );
}

main().catch((error) => {
  console.error("[compress] error:", error.message);
  process.exitCode = 1;
});
