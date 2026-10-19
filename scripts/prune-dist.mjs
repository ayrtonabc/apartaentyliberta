/**
 * prune-dist.mjs
 * ----------------------------------------------------------------------------
 * Quita de `dist/client` lo que NO debe publicarse.
 *
 * Astro copia `public/` tal cual al build, y en `public/import-original/` viven
 * los originales pesados de las fotos (19,5 MB de JPG/PNG de cámara) que solo
 * existen para que los scripts de importación generen las variantes
 * responsive. No los referencia ninguna página: si se publican, se está
 * sirviendo el archivo fuente de cada imagen —el que pesa 10 veces más— y el
 * despliegue crece sin ninguna ventaja.
 *
 * Se ejecuta en `postbuild`, después de comprimir.
 */
import { readdir, stat, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const ROOT = process.cwd();
const CLIENT_DIR = resolve(ROOT, "dist", "client");

/** Rutas (relativas a dist/client) que no deben llegar al servidor. */
const EXCLUDE = ["import-original"];

async function sizeOf(dir) {
  let total = 0;
  let files = 0;
  const walk = async (current) => {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else {
        const info = await stat(full);
        total += info.size;
        files++;
      }
    }
  };
  await walk(dir);
  return { total, files };
}

async function main() {
  if (!existsSync(CLIENT_DIR)) {
    console.warn("[prune] no existe dist/client — ¿se ejecutó el build?");
    return;
  }

  for (const name of EXCLUDE) {
    const target = resolve(CLIENT_DIR, name);

    /*
     * Cinturón y tirantes: solo se borra si el destino resuelto sigue estando
     * DENTRO de dist/client. Un `rm` recursivo con una ruta calculada merece
     * esta comprobación antes de ejecutarse.
     */
    const rel = relative(CLIENT_DIR, target);
    if (!rel || rel.startsWith("..") || resolve(CLIENT_DIR, rel) !== target) {
      console.warn(`[prune] ruta sospechosa, se omite: ${target}`);
      continue;
    }

    if (!existsSync(target)) continue;

    const { total, files } = await sizeOf(target);
    await rm(target, { recursive: true, force: true });
    const mb = (total / (1024 * 1024)).toFixed(1);
    console.log(
      `[prune] ${name}/ fuera del despliegue: ${files} archivos, ${mb} MB liberados` +
        ` (${relative(ROOT, target).split(sep).join("/")})`,
    );
  }
}

main().catch((error) => {
  console.error("[prune] error:", error.message);
  process.exitCode = 1;
});
