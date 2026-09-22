/**
 * encode-hero-video.mjs — ⚠️ NO EJECUTAR SIN PERMISO DEL PROPIETARIO.
 *
 * ============================================================================
 * EL VÍDEO DEL HERO LO GESTIONA EL DUEÑO DEL SITIO.
 * ============================================================================
 *
 * `public/assets/video/hero.mp4` es un archivo que el propietario reemplaza
 * cuando exporta su propia versión a medida. **Este script lo sobrescribe**, así
 * que ejecutarlo pisa su trabajo.
 *
 * Ha pasado varias veces: el archivo aparecía con una duración distinta y yo lo
 * "arreglaba" recodificándolo, cuando en realidad estaba viendo una exportación
 * suya a medio terminar. Instrucción literal del propietario: "deja de tocar eso,
 * déjame a mí encontrar la mejor solución".
 *
 * Así que este script queda como HERRAMIENTA MANUAL, no como parte del flujo. No
 * lo llama ningún `npm run`, ningún test y ningún paso de build.
 *
 * Si el propietario te pide expresamente recodificar, adelante. Si no, NO.
 *
 * ---------------------------------------------------------------------------
 * Qué hace, si algún día se usa
 * ---------------------------------------------------------------------------
 *
 * Produce, a partir de `public/import-original/herovideo.mp4`:
 *   public/assets/video/hero.mp4          H.264 1080p, sin audio, completo
 *   public/assets/video/hero-movil.mp4    H.264 960px, para pantallas pequeñas
 *   public/assets/video/hero-poster.webp  primer fotograma, para el poster
 *
 * Notas de la codificación, por si sirven:
 *
 *   - NO corta el vídeo. Hubo una versión que lo recortaba a 1,5 s y lo reproducía
 *     en bucle de ida y vuelta para ahorrar peso; el propietario lo rechazó porque
 *     el plano enseña el complejo entero.
 *   - Sin audio: el hero va silenciado y algunos navegadores bloquean el autoplay
 *     si el archivo trae sonido.
 *   - `+faststart` mueve el índice del MP4 al principio, así el navegador
 *     reproduce antes de descargar el archivo completo. Es lo que de verdad hace
 *     que "cargue rápido" con un archivo grande.
 *   - 25 fps en vez de 50: es un plano de dron lento y el navegador decodifica la
 *     mitad de fotogramas.
 *
 * Uso: node scripts/encode-hero-video.mjs [ancho] [crf]
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, stat, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";

const run = promisify(execFile);

/**
 * El máster del vídeo NO vive en public/, sino en el respaldo.
 *
 * Es un archivo de 10,8 MB que ningún visitante descarga; dejarlo en public/ lo
 * copiaría al despliegue en cada build. Se busca en los dos sitios para que el
 * script funcione tanto si el vídeo se acaba de subir como si ya se archivó.
 */
const CANDIDATOS = [
  resolve(process.cwd(), "public", "herovideo.mp4"),
  resolve(process.cwd(), "public", "import-original", "herovideo.mp4"),
];
const ORIGEN = CANDIDATOS.find((p) => existsSync(p)) ?? CANDIDATOS[0];

const DESTINO = resolve(process.cwd(), "public", "assets", "video");

/** 1920 = el ancho nativo del máster. No se baja en escritorio. */
const ANCHO = Number(process.argv[2] ?? 1920);
const CRF = Number(process.argv[3] ?? 34);
/** Ancho de la variante para móvil */
const ANCHO_MOVIL = 960;
const CRF_MOVIL = 30;

const kb = async (ruta) => Math.round((await stat(ruta)).size / 1024);

async function ffmpeg(args) {
  await run("ffmpeg", ["-y", "-v", "error", ...args], { maxBuffer: 1 << 28 });
}

/**
 * Codifica el vídeo COMPLETO, sin cortarlo.
 *
 * Los fotogramas bajan de 50 a 25 fps: es un plano de dron lento y a 25 fps se
 * ve igual, además de que el navegador decodifica la mitad de fotogramas.
 */
async function h264Completo(destino, ancho, crf) {
  await ffmpeg([
    "-i", ORIGEN,
    "-an",
    "-vf", `fps=25,scale=${ancho}:-2`,
    "-c:v", "libx264",
    "-profile:v", "high",
    "-level", "4.1",
    "-pix_fmt", "yuv420p",
    "-preset", "slow",
    "-crf", String(crf),
    "-movflags", "+faststart",
    destino,
  ]);
}

/** Duración en segundos, para comprobar que no se ha cortado nada. */
async function duracion(ruta) {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    ruta,
  ]);
  return Number(stdout.trim());
}

async function main() {
  if (!existsSync(ORIGEN)) {
    console.error(`No se encuentra ${ORIGEN}`);
    process.exit(1);
  }
  await mkdir(DESTINO, { recursive: true });

  const mp4 = join(DESTINO, "hero.mp4");
  const mp4Movil = join(DESTINO, "hero-movil.mp4");
  const poster = join(DESTINO, "hero-poster.webp");

  const durOriginal = await duracion(ORIGEN);

  console.log(`origen: ${ORIGEN}`);
  console.log(`COMPLETO: ${durOriginal.toFixed(2)}s, sin cortar, sin audio`);
  console.log(`escritorio ${ANCHO}px crf ${CRF} · móvil ${ANCHO_MOVIL}px crf ${CRF_MOVIL}\n`);

  await h264Completo(mp4, ANCHO, CRF);
  console.log(`  hero.mp4          ${await kb(mp4)} KB  (${ANCHO}px, crf ${CRF}, completo)`);

  await h264Completo(mp4Movil, ANCHO_MOVIL, CRF_MOVIL);
  console.log(`  hero-movil.mp4    ${await kb(mp4Movil)} KB  (${ANCHO_MOVIL}px, crf ${CRF_MOVIL}, completo)`);

  const tmp = join(DESTINO, ".poster.png");
  await ffmpeg(["-i", ORIGEN, "-frames:v", "1", "-vf", `scale=${ANCHO}:-2`, tmp]);
  await sharp(tmp).webp({ quality: 86 }).toFile(poster);
  await rm(tmp, { force: true });
  console.log(`  hero-poster.webp  ${await kb(poster)} KB`);

  /*
   * Comprobación de que NO se ha cortado. Es la regla que el propietario puso y
   * la que este script incumplía: si algún día alguien vuelve a añadir un `-t`,
   * esto lo canta.
   */
  const durEscritorio = await duracion(mp4);
  const durMovil = await duracion(mp4Movil);
  const tolerancia = 0.5; // el reencode puede mover algún fotograma

  console.log(`\n  duración original: ${durOriginal.toFixed(2)}s`);
  console.log(`  duración salida:   ${durEscritorio.toFixed(2)}s (escritorio) · ${durMovil.toFixed(2)}s (móvil)`);

  if (Math.abs(durEscritorio - durOriginal) > tolerancia || Math.abs(durMovil - durOriginal) > tolerancia) {
    console.error("\n  ✗ EL VÍDEO SE HA CORTADO. Revisa los argumentos de ffmpeg.");
    process.exitCode = 1;
  } else {
    console.log("  ✓ duración completa conservada");
  }

  const original = await kb(ORIGEN);
  console.log(
    `\nmáster: ${original} KB → escritorio ${await kb(mp4)} KB · móvil ${await kb(mp4Movil)} KB`,
  );
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
