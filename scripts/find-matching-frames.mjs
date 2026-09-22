/**
 * ⚠️ OBSOLETO — ver scripts/VIDEO-README.md
 *
 * Este script existe porque el vídeo del hero se recortaba a 1,5 s y se
 * reproducía en bucle de ida y vuelta, y había que buscar el mejor empalme.
 * El vídeo ya NO se corta (regla del propietario), así que no hay empalme que
 * buscar. El script sigue valiendo para analizar un vídeo cualquiera, pero NO
 * debe usarse para decidir el corte del hero: no hay corte.
 *//**
 * find-matching-frames.mjs — busca dos fotogramas del máster casi idénticos.
 *
 * IDEA
 *
 * Si existe un tramo cuyo fotograma final se parece mucho al inicial, el bucle
 * se cierra solo con un corte normal, sin ida y vuelta y sin fundidos. Eso
 * permitiría un vídeo corto (poco peso) y un bucle sin salto.
 *
 * Se comparan todos los pares de fotogramas separados por la duración buscada y
 * se ordena por similitud.
 *
 * No abre navegador.
 *
 * Uso: node scripts/find-matching-frames.mjs [segundosDeCorte] [paso]
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const run = promisify(execFile);

const ORIGEN = resolve(process.cwd(), "public", "import-original", "herovideo.mp4");
const TMP = resolve(process.cwd(), ".tmp-match");
const DURACION = Number(process.argv[2] ?? 6);
const PASO = Number(process.argv[3] ?? 0.5);
const ANCHO = 240;

async function frame(t) {
  const f = resolve(TMP, `t${String(Math.round(t * 100)).padStart(6, "0")}.png`);
  if (existsSync(f)) return f;
  await run("ffmpeg", ["-y", "-v", "error", "-ss", String(t), "-i", ORIGEN, "-frames:v", "1", "-vf", `scale=${ANCHO}:-2`, f]);
  return f;
}

/** Diferencia media absoluta en escala de grises, normalizada 0-1. */
async function dif(pa, pb) {
  const a = await sharp(pa).greyscale().raw().toBuffer();
  const b = await sharp(pb).greyscale().raw().toBuffer();
  let suma = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) suma += Math.abs(a[i] - b[i]);
  return suma / n / 255;
}

async function main() {
  if (!existsSync(ORIGEN)) {
    console.error(`No se encuentra ${ORIGEN}`);
    process.exit(1);
  }
  await mkdir(TMP, { recursive: true });

  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", ORIGEN,
  ]);
  const dur = Number(stdout.trim());

  console.log(`\n=== pares de fotogramas separados ${DURACION}s (más parecidos primero) ===\n`);

  const pares = [];
  for (let t = 0; t + DURACION <= dur; t += PASO) {
    const [a, b] = await Promise.all([frame(t), frame(t + DURACION)]);
    pares.push({ inicio: t, fin: t + DURACION, dif: await dif(a, b) });
  }

  pares.sort((x, y) => x.dif - y.dif);

  console.log("  inicio   fin    diferencia media");
  for (const p of pares.slice(0, 10)) {
    const marca = p.dif < 0.06 ? " ← muy parecidos" : "";
    console.log(`   ${String(p.inicio).padStart(5)}s  ${String(p.fin).padStart(5)}s    ${p.dif.toFixed(4)}${marca}`);
  }

  const buenos = pares.filter((p) => p.dif < 0.06);
  console.log(
    `\n  pares con diferencia < 0,06: ` +
      (buenos.length ? buenos.map((p) => `${p.inicio}-${p.fin}s`).join(", ") : "ninguno"),
  );

  // Referencia: cuánto cambia un fotograma normal
  const a = await frame(20);
  const b = await frame(20.2);
  console.log(`  referencia (0,2s de movimiento normal): ${(await dif(a, b)).toFixed(4)}`);

  await rm(TMP, { recursive: true, force: true });
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
