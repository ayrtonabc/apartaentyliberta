/**
 * ⚠️ OBSOLETO — ver scripts/VIDEO-README.md
 *
 * Este script existe porque el vídeo del hero se recortaba a 1,5 s y se
 * reproducía en bucle de ida y vuelta, y había que buscar el mejor empalme.
 * El vídeo ya NO se corta (regla del propietario), así que no hay empalme que
 * buscar. El script sigue valiendo para analizar un vídeo cualquiera, pero NO
 * debe usarse para decidir el corte del hero: no hay corte.
 *//**
 * find-seamless-loop.mjs — busca el tramo del máster que loopea sin salto.
 *
 * PROBLEMA
 *
 * Un vídeo en bucle con `loop` vuelve al primer fotograma de golpe. Si el dron
 * se ha desplazado mucho durante el corte, ese salto se ve como un corte seco.
 * Medir "brillo" no basta: hay que comparar la imagen de verdad.
 *
 * MÉTODO
 *
 * Para cada ventana posible se compara el PRIMER fotograma con el ÚLTIMO usando
 * SSIM (similitud estructural, 1.0 = idénticos). Cuanto más alto, menos se nota
 * el empalme. Se combina con la limpieza del plano (poca tierra removida) para
 * elegir un tramo que además se vea bien.
 *
 * No abre navegador.
 *
 * Uso: node scripts/find-seamless-loop.mjs [segundos] [pasoInicio]
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { rm, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const run = promisify(execFile);

const ORIGEN = resolve(process.cwd(), "public", "import-original", "herovideo.mp4");
const TMP = resolve(process.cwd(), ".tmp-loop");
const VENTANA = Number(process.argv[2] ?? 6);
/** Cada cuántos segundos se prueba a empezar */
const PASO = Number(process.argv[3] ?? 2);
const ANCHO = 480;

/** SSIM aproximado entre dos buffers en escala de grises. */
async function ssim(a, b) {
  const { data: da, info } = await sharp(a).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { data: db } = await sharp(b).greyscale().raw().toBuffer({ resolveWithObject: true });

  const n = info.width * info.height;
  let sumaA = 0;
  let sumaB = 0;
  for (let i = 0; i < n; i++) {
    sumaA += da[i];
    sumaB += db[i];
  }
  const ma = sumaA / n;
  const mb = sumaB / n;

  let va = 0;
  let vb = 0;
  let cov = 0;
  for (let i = 0; i < n; i++) {
    const x = da[i] - ma;
    const y = db[i] - mb;
    va += x * x;
    vb += y * y;
    cov += x * y;
  }
  va /= n;
  vb /= n;
  cov /= n;

  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  return ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
}

/** Proporción de terreno removido (beige claro), que es lo que afea el plano. */
async function tierra(buf) {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  let cuenta = 0;
  const n = info.width * info.height;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > 130 && g > 115 && b < 125 && r >= b + 18) cuenta++;
  }
  return cuenta / n;
}

async function frame(t) {
  const f = resolve(TMP, `t${String(Math.round(t * 10)).padStart(5, "0")}.png`);
  if (existsSync(f) && (await stat(f)).size > 0) return f;
  await run("ffmpeg", ["-y", "-v", "error", "-ss", String(t), "-i", ORIGEN, "-frames:v", "1", "-vf", `scale=${ANCHO}:-2`, f]);
  return f;
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
  const duracion = Math.floor(Number(stdout.trim()));

  console.log(`\n=== buscando bucle sin salto · ventana ${VENTANA}s · paso ${PASO}s ===\n`);

  const resultados = [];

  for (let inicio = 0; inicio + VENTANA <= duracion; inicio += PASO) {
    const fin = inicio + VENTANA - 0.04; // último fotograma antes del corte
    const [fa, fb] = await Promise.all([frame(inicio), frame(fin)]);

    const similitud = await ssim(fa, fb);
    const suciedad = ((await tierra(fa)) + (await tierra(fb))) / 2;

    resultados.push({ inicio, fin: inicio + VENTANA, similitud, suciedad });
  }

  // Ordena por empalme (más alto mejor) y descarta lo que tenga mucha obra
  resultados.sort((a, b) => b.similitud - a.similitud);

  console.log("  inicio-fin   empalme(SSIM)   tierra");
  for (const r of resultados.slice(0, 10)) {
    const marca = r.similitud > 0.75 ? " ← bueno" : "";
    console.log(
      `   ${String(r.inicio).padStart(3)}s-${String(r.fin).padStart(3)}s` +
        `      ${r.similitud.toFixed(3)}          ${(r.suciedad * 100).toFixed(1)}%${marca}`,
    );
  }

  const buenos = resultados.filter((r) => r.similitud > 0.75 && r.suciedad < 0.02);
  console.log(
    `\n  tramos con empalme bueno (>0.75) y poca obra (<2%): ` +
      (buenos.length ? buenos.map((r) => `${r.inicio}-${r.fin}s`).join(", ") : "ninguno"),
  );

  await rm(TMP, { recursive: true, force: true });
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
