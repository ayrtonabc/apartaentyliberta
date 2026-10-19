/**
 * scripts/build-vercel.mjs
 * ----------------------------------------------------------------------------
 * Wrapper de build para Vercel. Igual que `npm run build` pero fuerza
 * `process.env.VERCEL = "1"` antes de invocar a Astro.
 *
 * ¿Por qué?
 *
 * En `astro.config.mjs` elegimos el adapter según `process.env.VERCEL`:
 *
 *   VERCEL=1 → @astrojs/vercel (genera funciones serverless y .vercel/output)
 *   si no    → @astrojs/node standalone (para `node ./server.mjs` local)
 *
 * Vercel CI ya pone `VERCEL=1` automáticamente al ejecutar builds, pero
 * este wrapper garantiza que también funciona en builds manuales o en
 * otros CIs. Si Astro detecta `VERCEL=1`, construye para Vercel; si no,
 * para Node.
 *
 * Mantiene la cadena prebuild/postbuild de `package.json`.
 */
process.env.VERCEL = "1";

import { spawnSync } from "node:child_process";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCmd, ["run", "build"], {
  stdio: "inherit",
  env: process.env,
  /*
   * En Windows `npm` es `npm.cmd`, y `spawnSync` con `shell: false` no puede
   * ejecutar un `.cmd`: el proceso fallaba antes de arrancar y el wrapper
   * devolvía 1 SIN imprimir nada. Con `shell: true` funciona en Windows; en
   * Linux/Mac el shell también resuelve el binario sin problema.
   */
  shell: process.platform === "win32",
});

if (result.error) {
  console.error("No se pudo lanzar el build:", result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
