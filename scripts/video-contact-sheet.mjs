/**
 * video-contact-sheet.mjs — rejilla de fotogramas del vídeo original.
 *
 * Sirve para elegir qué tramo va al hero sin tener que reproducir el vídeo
 * entero: genera una tira con un fotograma cada N segundos.
 *
 * No abre navegador.
 *
 * Uso: node scripts/video-contact-sheet.mjs [cadaSegundos] [ancho]
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const run = promisify(execFile);

const ORIGEN = resolve(process.cwd(), "public", "herovideo.mp4");
const CADA = Number(process.argv[2] ?? 6);
const ANCHO = Number(process.argv[3] ?? 320);
const SALIDA = resolve(process.cwd(), ".tmp-contacto.png");

async function main() {
  if (!existsSync(ORIGEN)) {
    console.error(`No se encuentra ${ORIGEN}`);
    process.exit(1);
  }

  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    ORIGEN,
  ]);
  const duracion = Math.floor(Number(stdout.trim()));
  const tiempos = [];
  for (let t = 0; t < duracion; t += CADA) tiempos.push(t);

  console.log(`duración ${duracion}s · ${tiempos.length} fotogramas cada ${CADA}s\n`);

  const trozos = [];
  for (const t of tiempos) {
    const tmp = resolve(process.cwd(), `.tmp-f-${t}.png`);
    await run("ffmpeg", ["-y", "-v", "error", "-ss", String(t), "-i", ORIGEN, "-frames:v", "1", "-vf", `scale=${ANCHO}:-2`, tmp]);
    const meta = await sharp(tmp).metadata();
    trozos.push({ t, ruta: tmp, alto: meta.height ?? 180 });
    await rm(tmp, { force: true });
  }

  // Rejilla de 4 columnas con la marca de tiempo dibujada encima
  const COLS = 4;
  const alto = trozos[0].alto;
  const filas = Math.ceil(trozos.length / COLS);

  const compuestos = [];
  for (let i = 0; i < trozos.length; i++) {
    const { data, info } = await sharp(trozos[i].ruta, { failOn: "none" })
      .toBuffer({ resolveWithObject: true })
      .catch(async () => {
        // El archivo ya se borró: se regenera
        await run("ffmpeg", ["-y", "-v", "error", "-ss", String(trozos[i].t), "-i", ORIGEN, "-frames:v", "1", "-vf", `scale=${ANCHO}:-2`, trozos[i].ruta]);
        return sharp(trozos[i].ruta).toBuffer({ resolveWithObject: true });
      });

    const etiqueta = Buffer.from(
      `<svg width="${info.width}" height="26"><rect width="100%" height="26" fill="rgba(0,0,0,0.72)"/><text x="8" y="18" font-family="monospace" font-size="15" fill="#fff">${trozos[i].t}s</text></svg>`,
    );
    const conEtiqueta = await sharp(data)
      .composite([{ input: etiqueta, top: 0, left: 0 }])
      .png()
      .toBuffer();

    compuestos.push({
      input: conEtiqueta,
      left: (i % COLS) * ANCHO,
      top: Math.floor(i / COLS) * (alto + 26) + Math.floor(i / COLS) * 4,
    });
  }

  const lienzo = {
    width: COLS * ANCHO,
    height: filas * (alto + 26) + (filas - 1) * 4,
    channels: 3,
    background: { r: 20, g: 24, b: 22 },
  };

  await sharp({ create: { ...lienzo, channels: 4, background: { r: 20, g: 24, b: 22, alpha: 1 } } })
    .composite(compuestos)
    .png()
    .toFile(SALIDA);

  console.log(`rejilla: ${SALIDA}  (${(await stat(SALIDA)).size / 1024 | 0} KB)`);
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
