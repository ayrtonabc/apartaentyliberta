/**
 * ⚠️ OBSOLETO — ver scripts/VIDEO-README.md
 *
 * Este script existe porque el vídeo del hero se recortaba a 1,5 s y se
 * reproducía en bucle de ida y vuelta, y había que buscar el mejor empalme.
 * El vídeo ya NO se corta (regla del propietario), así que no hay empalme que
 * buscar. El script sigue valiendo para analizar un vídeo cualquiera, pero NO
 * debe usarse para decidir el corte del hero: no hay corte.
 *//**
 * find-best-hero-loop.mjs — busca el mejor tramo del máster para el bucle del hero.
 *
 * POR QUÉ
 *
 * El máster dura 56 s de dron y no todo vale: hay un tramo con obras y material
 * de construcción, y la marca de agua del propietario está en una esquina fija,
 * así que no se puede evitar recortando. Lo que sí se puede elegir es el tramo
 * que se ve mejor y que además loopea sin salto.
 *
 * Mide dos cosas por cada fotograma:
 *   - "limpieza": cuánta superficie ocupa el terreno removido (tonos tierra
 *     claros y saturados), que es lo que afea el plano.
 *   - "salto de bucle": diferencia entre el primer y el último fotograma de una
 *     ventana, para elegir una que empalme sin corte visible.
 *
 * No abre navegador.
 *
 * Uso: node scripts/find-best-hero-loop.mjs [segundosDeVentana]
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const run = promisify(execFile);

const ORIGEN = resolve(process.cwd(), "public", "import-original", "herovideo.mp4");
const TMP = resolve(process.cwd(), ".tmp-frames");
const VENTANA = Number(process.argv[2] ?? 8);
const PASO = 1;
const ANCHO = 320;

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

  // Extrae un fotograma por segundo
  const tiempos = [];
  for (let t = 0; t < duracion; t += PASO) tiempos.push(t);

  const datos = [];
  for (const t of tiempos) {
    const f = resolve(TMP, `f${String(t).padStart(3, "0")}.png`);
    await run("ffmpeg", ["-y", "-v", "error", "-ss", String(t), "-i", ORIGEN, "-frames:v", "1", "-vf", `scale=${ANCHO}:-2`, f]);

    const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
    const n = info.width * info.height;

    /*
     * "Tierra removida": píxeles claros y poco saturados hacia el amarillo.
     * El terreno de obra es beige claro; el lago es verde-azul oscuro y el
     * bosque verde oscuro, así que el criterio separa bien.
     */
    let tierra = 0;
    let suma = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      suma += (r + g + b) / 3;
      if (r > 130 && g > 115 && b < 125 && r >= b + 18) tierra++;
    }

    datos.push({ t, tierra: tierra / n, brillo: suma / n / 255 });
  }

  console.log(`\n=== análisis de ${duracion}s del máster (ventana de ${VENTANA}s) ===\n`);
  console.log("  segundo  tierra  brillo");
  for (const d of datos) {
    const barra = "█".repeat(Math.round(d.tierra * 40));
    console.log(`   ${String(d.t).padStart(4)}    ${(d.tierra * 100).toFixed(1).padStart(5)}%  ${d.brillo.toFixed(3)}  ${barra}`);
  }

  // Ventanas: media de "tierra" y salto de bucle
  const ventanas = [];
  for (let i = 0; i + VENTANA <= datos.length; i++) {
    const trozo = datos.slice(i, i + VENTANA);
    const tierraMedia = trozo.reduce((a, d) => a + d.tierra, 0) / trozo.length;
    const tierraMax = Math.max(...trozo.map((d) => d.tierra));
    // Salto: diferencia de brillo y de "tierra" entre el primer y el último fotograma
    const salto = Math.abs(trozo[0].brillo - trozo[trozo.length - 1].brillo) + Math.abs(trozo[0].tierra - trozo[trozo.length - 1].tierra);
    ventanas.push({ inicio: trozo[0].t, tierraMedia, tierraMax, salto });
  }

  ventanas.sort((a, b) => a.tierraMedia + a.salto * 2 - (b.tierraMedia + b.salto * 2));

  console.log("\n=== mejores ventanas (menos obra y menos salto al loopear) ===\n");
  console.log("  inicio  tierra media  tierra máx  salto");
  for (const v of ventanas.slice(0, 8)) {
    console.log(
      `   ${String(v.inicio).padStart(4)}s      ${(v.tierraMedia * 100).toFixed(1).padStart(5)}%` +
        `       ${(v.tierraMax * 100).toFixed(1).padStart(5)}%   ${v.salto.toFixed(4)}`,
    );
  }

  await rm(TMP, { recursive: true, force: true });
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
