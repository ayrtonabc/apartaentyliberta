/**
 * ⚠️ OBSOLETO — ver scripts/VIDEO-README.md
 *
 * Este script existe porque el vídeo del hero se recortaba a 1,5 s y se
 * reproducía en bucle de ida y vuelta, y había que buscar el mejor empalme.
 * El vídeo ya NO se corta (regla del propietario), así que no hay empalme que
 * buscar. El script sigue valiendo para analizar un vídeo cualquiera, pero NO
 * debe usarse para decidir el corte del hero: no hay corte.
 *//**
 * tune-loop-crossfade.mjs — elige la duración del fundido del bucle.
 *
 * El fundido del final con el principio hace que el bucle no dé un salto, pero
 * si es demasiado corto la mitad del fundido sigue mezclando fotogramas
 * lejanos y el salto se nota; si es demasiado largo, el vídeo pasa demasiado
 * tiempo en transición y parece que se queda atascado.
 *
 * Aquí se prueban varias duraciones y se mide el salto real en la unión con
 * scripts/check-loop-seam.mjs.
 *
 * No abre navegador.
 *
 * Uso: node scripts/tune-loop-crossfade.mjs [segundosDeCorte] [inicio] [ancho]
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { stat, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const run = promisify(execFile);

const ORIGEN = resolve(process.cwd(), "public", "import-original", "herovideo.mp4");
const DURACION = Number(process.argv[2] ?? 8);
const INICIO = Number(process.argv[3] ?? 33);
const ANCHO = Number(process.argv[4] ?? 1920);

const FUNDIDOS = [1, 1.5, 2, 2.5, 3];

async function main() {
  if (!existsSync(ORIGEN)) {
    console.error(`No se encuentra ${ORIGEN}`);
    process.exit(1);
  }

  console.log(`\n=== fundido del bucle · corte ${INICIO}-${INICIO + DURACION}s ===\n`);
  console.log("  fundido   peso    salto/movimiento normal");

  for (const T of FUNDIDOS) {
    const cuerpo = DURACION - T;
    const salida = resolve(process.cwd(), `.tmp-xf-${T}.mp4`);

    const filtro =
      `[0:v]fps=25,scale=${ANCHO}:-2,split=2[a][b];` +
      `[a]trim=start=0:end=${cuerpo},setpts=PTS-STARTPTS[main];` +
      `[b]trim=start=${cuerpo}:end=${DURACION},setpts=PTS-STARTPTS[tail];` +
      `[main][tail]xfade=transition=fade:duration=${T}:offset=${cuerpo - T}[out]`;

    try {
      await run(
        "ffmpeg",
        [
          "-y", "-v", "error",
          "-ss", String(INICIO), "-t", String(DURACION),
          "-i", ORIGEN,
          "-an",
          "-filter_complex", filtro,
          "-map", "[out]",
          "-c:v", "libx264", "-profile:v", "high", "-level", "4.1",
          "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "25",
          "-movflags", "+faststart",
          salida,
        ],
        { maxBuffer: 1 << 28 },
      );
    } catch (error) {
      console.log(`  ${T}s  → falló: ${error.message.split("\n")[0]}`);
      continue;
    }

    const kb = Math.round((await stat(salida)).size / 1024);

    let ratio = "?";
    try {
      const { stdout } = await run("node", ["scripts/check-loop-seam.mjs", salida.replace(process.cwd() + "\\", "")], {
        cwd: process.cwd(),
      });
      const m = /ratio salto\/movimiento normal\s*:\s*([0-9.]+)/.exec(stdout);
      if (m) ratio = m[1];
    } catch {
      /* se deja como ? */
    }

    console.log(`  ${String(T).padEnd(8)}  ${String(kb).padStart(5)} KB   ${ratio}×`);
    await rm(salida, { force: true });
  }

  console.log("\n  Referencia: 1× sería un fotograma más de movimiento normal;");
  console.log("  por debajo de ~2,5× el salto no se percibe.");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
