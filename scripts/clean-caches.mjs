/**
 * clean-caches.mjs
 * Limpia caches de Astro/Vite que pueden quedar atrapadas con errores
 * de parseo viejos (por ejemplo, despues de arreglar un escape roto
 * mientras el dev server estaba corriendo).
 *
 * Uso:
 *   npm run clean          # solo limpia
 *   npm run fresh          # limpia y arranca dev
 *
 * Lo que elimina:
 *   - node_modules/.vite       (cache de Vite)
 *   - node_modules/.astro      (cache de Astro)
 *   - .astro                   (output/cache de Astro en la raiz)
 *   - dist                     (build output)
 *
 * NO toca:
 *   - node_modules (deps)
 *   - public/ (assets)
 *   - .env / .env.* (secrets)
 */
import { rmSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const targets = [
  'node_modules/.vite',
  'node_modules/.astro',
  '.astro',
  'dist',
];

let removed = 0;
let skipped = 0;

for (const rel of targets) {
  const abs = resolve(root, rel);
  if (existsSync(abs)) {
    try {
      rmSync(abs, { recursive: true, force: true });
      console.log(`[clean] removed ${rel}`);
      removed++;
    } catch (err) {
      console.error(`[clean] FAILED to remove ${rel}:`, err.message);
      skipped++;
    }
  } else {
    console.log(`[clean] skip   ${rel} (does not exist)`);
    skipped++;
  }
}

console.log(`\n[clean] done. ${removed} removed, ${skipped} skipped.`);
console.log('[clean] next: npm run dev   (or: npm run fresh)');
