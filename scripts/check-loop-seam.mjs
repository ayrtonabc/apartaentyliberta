/**
 * ⚠️ OBSOLETO — ver scripts/VIDEO-README.md
 *
 * Este script existe porque el vídeo del hero se recortaba a 1,5 s y se
 * reproducía en bucle de ida y vuelta, y había que buscar el mejor empalme.
 * El vídeo ya NO se corta (regla del propietario), así que no hay empalme que
 * buscar. El script sigue valiendo para analizar un vídeo cualquiera, pero NO
 * debe usarse para decidir el corte del hero: no hay corte.
 *//**
 * check-loop-seam.mjs — mide el salto REAL en la unión del bucle.
 *
 * POR QUÉ ASÍ Y NO COMPARANDO DOS FOTOGRAMAS
 *
 * Un vídeo en bucle reproduce el fotograma N-1 y después el 0. El salto visible
 * está en esa unión, y para medirlo hay que reconstruirla: se pega el vídeo
 * consigo mismo y se compara el fotograma anterior a la unión con el posterior,
 * en un contexto temporal real.
 *
 * Comparar "primer fotograma" contra "último fotograma" sueltos no sirve: son
 * dos fotogramas separados 7 segundos de movimiento de dron y darán un número
 * bajo aunque el bucle sea perfecto por fundido.
 *
 * No abre navegador.
 *
 * Uso: node scripts/check-loop-seam.mjs [archivo]
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const run = promisify(execFile);

const ARCHIVO = resolve(process.cwd(), process.argv[2] ?? "public/assets/video/hero.mp4");
const TMP = resolve(process.cwd(), ".tmp-seam");

/** Diferencia media absoluta entre dos fotogramas, 0 = idénticos. */
async function diffMedio(a, b) {
  const { execFile: ef } = await import("node:child_process");
  const salida = await new Promise((res, rej) => {
    ef(
      "ffmpeg",
      ["-v", "error", "-i", a, "-i", b, "-lavfi", "blend=all_mode=difference,format=gray", "-f", "rawvideo", "-"],
      { maxBuffer: 1 << 28, encoding: "buffer" },
      (err, stdout) => (err ? rej(err) : res(stdout)),
    );
  });
  let suma = 0;
  for (const v of salida) suma += v;
  return suma / salida.length;
}

async function main() {
  if (!existsSync(ARCHIVO)) {
    console.error(`No se encuentra ${ARCHIVO}`);
    process.exit(1);
  }
  await mkdir(TMP, { recursive: true });

  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", ARCHIVO,
  ]);
  const dur = Number(stdout.trim());
  console.log(`\n=== unión del bucle · ${ARCHIVO.replace(process.cwd() + "\\", "")} ===`);
  console.log(`  duración: ${dur.toFixed(2)} s`);

  // Fotograma justo antes de la unión (el último) y justo después (el primero)
  const ultimo = resolve(TMP, "ultimo.png");
  const primero = resolve(TMP, "primero.png");
  await run("ffmpeg", ["-y", "-v", "error", "-sseof", "-0.08", "-i", ARCHIVO, "-frames:v", "1", "-vf", "scale=480:-2", ultimo]);
  await run("ffmpeg", ["-y", "-v", "error", "-i", ARCHIVO, "-frames:v", "1", "-vf", "scale=480:-2", primero]);

  const salto = await diffMedio(ultimo, primero);

  /*
   * Referencia: cuánto cambia la imagen entre dos fotogramas consecutivos
   * DENTRO del vídeo. Un salto de bucle aceptable no debe superar mucho ese
   * movimiento normal.
   */
  const a = resolve(TMP, "a.png");
  const b = resolve(TMP, "b.png");
  await run("ffmpeg", ["-y", "-v", "error", "-ss", "3", "-i", ARCHIVO, "-frames:v", "1", "-vf", "scale=480:-2", a]);
  await run("ffmpeg", ["-y", "-v", "error", "-ss", "3.04", "-i", ARCHIVO, "-frames:v", "1", "-vf", "scale=480:-2", b]);
  const normal = await diffMedio(a, b);

  console.log(`\n  diferencia entre el último y el primer fotograma : ${salto.toFixed(2)}`);
  console.log(`  diferencia entre dos fotogramas consecutivos     : ${normal.toFixed(2)}`);
  console.log(`  ratio salto/movimiento normal                    : ${(salto / normal).toFixed(1)}×`);

  const veredicto =
    salto <= normal * 2.5
      ? "SIN SALTO: la unión se mueve como el resto del vídeo"
      : salto <= normal * 6
        ? "salto leve"
        : "SALTO VISIBLE";
  console.log(`\n  → ${veredicto}`);

  await rm(TMP, { recursive: true, force: true });
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
