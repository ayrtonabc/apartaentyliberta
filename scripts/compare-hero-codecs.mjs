/**
 * compare-hero-codecs.mjs — compara códecs y calidades para el vídeo del hero.
 *
 * Mide, para cada combinación, el peso y la calidad real (PSNR y SSIM) contra el
 * máster decodificado a la misma resolución. Sirve para elegir con números en
 * lugar de por intuición: interesa la opción que dé más calidad por KB.
 *
 * No abre navegador.
 *
 * Uso: node scripts/compare-hero-codecs.mjs [segundos] [inicio] [ancho]
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { stat, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const run = promisify(execFile);

const ORIGEN = resolve(process.cwd(), "public", "import-original", "herovideo.mp4");
const DURACION = Number(process.argv[2] ?? 1.5);
const INICIO = Number(process.argv[3] ?? 33);
const ANCHO = Number(process.argv[4] ?? 1920);

const FILTRO =
  `[0:v]fps=25,scale=${ANCHO}:-2,split=2[fwd][rev];` +
  `[rev]reverse[revout];` +
  `[fwd][revout]concat=n=2:v=1:a=0[out]`;

/** Opciones a probar. */
const OPCIONES = [
  { nombre: "h264 crf25 (actual)", enc: "libx264", args: ["-preset", "veryslow", "-crf", "25"] },
  { nombre: "h264 crf22", enc: "libx264", args: ["-preset", "veryslow", "-crf", "22"] },
  { nombre: "h264 crf20", enc: "libx264", args: ["-preset", "veryslow", "-crf", "20"] },
  { nombre: "av1 svt crf30", enc: "libsvtav1", args: ["-preset", "6", "-crf", "30"] },
  { nombre: "av1 svt crf28", enc: "libsvtav1", args: ["-preset", "6", "-crf", "28"] },
  { nombre: "av1 svt crf26", enc: "libsvtav1", args: ["-preset", "6", "-crf", "26"] },
];

async function main() {
  if (!existsSync(ORIGEN)) {
    console.error(`No se encuentra ${ORIGEN}`);
    process.exit(1);
  }

  // Referencia casi sin pérdida, con la MISMA duración y estructura que la salida
  const ref = resolve(process.cwd(), ".tmp-ref-pp.mp4");
  console.log("generando referencia…");
  await run(
    "ffmpeg",
    [
      "-y", "-v", "error",
      "-ss", String(INICIO), "-t", String(DURACION), "-i", ORIGEN,
      "-an", "-filter_complex", FILTRO, "-map", "[out]",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "8",
      "-pix_fmt", "yuv420p", ref,
    ],
    { maxBuffer: 1 << 28 },
  );

  console.log(`\n=== comparación de códecs · ${ANCHO}px · ${DURACION}s por sentido ===\n`);
  console.log("  opción                 peso     PSNR      SSIM");

  const resultados = [];

  for (const o of OPCIONES) {
    const salida = resolve(process.cwd(), ".tmp-cmp.mp4");
    try {
      await run(
        "ffmpeg",
        [
          "-y", "-v", "error",
          "-ss", String(INICIO), "-t", String(DURACION), "-i", ORIGEN,
          "-an", "-filter_complex", FILTRO, "-map", "[out]",
          "-c:v", o.enc, ...o.args,
          "-pix_fmt", "yuv420p", "-movflags", "+faststart", salida,
        ],
        { maxBuffer: 1 << 28 },
      );
    } catch (error) {
      console.log(`  ${o.nombre.padEnd(22)} falló: ${error.message.split("\n")[0]}`);
      continue;
    }

    const kb = Math.round((await stat(salida)).size / 1024);

    const psnrOut = await run("ffmpeg", ["-i", salida, "-i", ref, "-lavfi", "psnr", "-f", "null", "-"], {
      maxBuffer: 1 << 28,
    }).catch((e) => ({ stderr: e.stderr ?? "" }));
    const ssimOut = await run("ffmpeg", ["-i", salida, "-i", ref, "-lavfi", "ssim", "-f", "null", "-"], {
      maxBuffer: 1 << 28,
    }).catch((e) => ({ stderr: e.stderr ?? "" }));

    const psnr = /average:([0-9.]+)/.exec(psnrOut.stderr ?? "")?.[1] ?? "?";
    const ssim = /All:([0-9.]+)/.exec(ssimOut.stderr ?? "")?.[1] ?? "?";

    console.log(
      `  ${o.nombre.padEnd(22)} ${String(kb).padStart(5)} KB   ${String(psnr).padStart(6)}   ${ssim}`,
    );

    resultados.push({ nombre: o.nombre, kb, psnr: Number(psnr), ssim: Number(ssim) });
    await rm(salida, { force: true });
  }

  await rm(ref, { force: true });

  // Mejor relación calidad/peso: calidad por KB
  const validos = resultados.filter((r) => Number.isFinite(r.psnr));
  validos.sort((a, b) => b.psnr / Math.log(b.kb) - a.psnr / Math.log(a.kb));

  if (validos.length) {
    console.log(`\n  mejor calidad por KB: ${validos[0].nombre} (${validos[0].kb} KB, ${validos[0].psnr} dB)`);
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
