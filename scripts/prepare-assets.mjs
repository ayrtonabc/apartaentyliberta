/**
 * prepare-assets.mjs
 * ----------------------------------------------------------------------------
 * Tareas que deben correr antes de `dev` y de `build`:
 *   1. Normalizar los nombres de las fotos del hero (script heredado).
 *   2. Regenerar las variantes responsivas + manifiesto LQIP.
 *
 * Al unificarlas en un único `predev`/`prebuild` se evita que un clon limpio
 * del repositorio se quede sin imágenes responsivas y que el manifiesto quede
 * desincronizado con las fotos.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const scripts = [
  "scripts/rename-hero-images.mjs",
  "scripts/responsive-images.mjs",
];

function run(file) {
  return new Promise((resolvePromise, rejectPromise) => {
    const full = resolve(ROOT, file);
    if (!existsSync(full)) {
      console.warn(`[assets] no existe ${file}, se omite`);
      resolvePromise();
      return;
    }
    const child = spawn(process.execPath, [full], { stdio: "inherit" });
    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`${file} terminó con código ${code}`));
    });
  });
}

for (const file of scripts) {
  await run(file);
}
