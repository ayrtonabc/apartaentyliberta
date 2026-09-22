/**
 * tune-hero-full.mjs — elige el mejor equilibrio peso/calidad para el vídeo
 * completo del hero (sin cortarlo).
 *
 * CONTEXTO
 *
 * El vídeo del hero es el máster del propietario: 56 s, 1920×1080, 50 fps, con
 * audio. Antes se cortaba a 3 s y se hacía un bucle de ida y vuelta para que
 * pesara poco, pero eso enseña solo un fragmento del complejo. La regla ahora es
 * NO cortarlo: se mantiene la duración y la resolución, y se optimiza el peso
 * con el códec, quitando el audio y eligiendo bien el CRF.
 *
 * Qué mide y por qué así:
 *   - PSNR y SSIM contra el máster SIN audio, a la misma resolución. Es la única
 *     comparación honesta: no vale comparar contra un recorte ni contra otra
 *     resolución.
 *   - El bitrate resultante, que es lo que de verdad decide si carga rápido.
 *
 * No abre navegador.
 *
 * Uso: node scripts/tune-hero-full.mjs
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { stat, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const run = promisify(execFile);

const ORIGEN = resolve(process.cwd(), "public", "import-original", "herovideo.mp4");

/**
 * A 56 s el CRF alto es obligatorio: con CRF 22 (el que usaba el bucle de 3 s,
 * donde el peso daba igual) el archivo se iría a decenas de MB.
 */
const OPCIONES = [
  { nombre: "crf 26", args: ["-preset", "slow", "-crf", "26"] },
  { nombre: "crf 28", args: ["-preset", "slow", "-crf", "28"] },
  { nombre: "crf 30", args: ["-preset", "slow", "-crf", "30"] },
  { nombre: "crf 32", args: ["-preset", "slow", "-crf", "32"] },
  
  
];

async function main() {
  if (!existsSync(ORIGEN)) {
    console.error(`No se encuentra ${ORIGEN}`);
    process.exit(1);
  }

  // Referencia: el máster sin audio. Así la comparación es contra lo mismo.
  const ref = resolve(process.cwd(), ".tmp-ref-full.mp4");
  console.log("generando referencia (máster sin audio)…");
  await run(
    "ffmpeg",
    ["-y", "-v", "error", "-i", ORIGEN, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "8", "-pix_fmt", "yuv420p", ref],
    { maxBuffer: 1 << 28 },
  );

  const kbRef = Math.round((await stat(ref)).size / 1024);
  console.log(`referencia: ${kbRef} KB\n`);

  console.log("  opción                peso      bitrate   PSNR      SSIM");
  const resultados = [];

  for (const o of OPCIONES) {
    const salida = resolve(process.cwd(), ".tmp-full.mp4");
    const ancho = o.ancho ?? 1920;

    const args = [
      "-y", "-v", "error",
      "-i", ORIGEN,
      "-an", // el vídeo de fondo no necesita audio
      "-vf", `scale=${ancho}:-2`,
    ];

    if (o.av1) {
      args.push("-c:v", "libsvtav1", "-preset", "6", "-crf", "34");
    } else {
      args.push("-c:v", "libx264", ...o.args);
    }

    args.push("-pix_fmt", "yuv420p", "-movflags", "+faststart", salida);

    try {
      await run("ffmpeg", args, { maxBuffer: 1 << 28 });
    } catch (error) {
      console.log(`  ${o.nombre.padEnd(22)} falló: ${error.message.split("\n")[0]}`);
      continue;
    }

    const kb = Math.round((await stat(salida)).size / 1024);
    const bitrate = Math.round((kb * 8) / 56);

    const psnrOut = await run("ffmpeg", ["-i", salida, "-i", ref, "-lavfi", "psnr", "-f", "null", "-"], {
      maxBuffer: 1 << 28,
    }).catch((e) => ({ stderr: e.stderr ?? "" }));
    const ssimOut = await run("ffmpeg", ["-i", salida, "-i", ref, "-lavfi", "ssim", "-f", "null", "-"], {
      maxBuffer: 1 << 28,
    }).catch((e) => ({ stderr: e.stderr ?? "" }));

    const psnr = /average:([0-9.]+)/.exec(psnrOut.stderr ?? "")?.[1] ?? "?";
    const ssim = /All:([0-9.]+)/.exec(ssimOut.stderr ?? "")?.[1] ?? "?";

    console.log(
      `  ${o.nombre.padEnd(22)} ${String(kb).padStart(6)} KB  ${String(bitrate).padStart(5)} kbps  ${String(psnr).padStart(7)}  ${ssim}`,
    );

    resultados.push({ nombre: o.nombre, kb, psnr: Number(psnr), ssim: Number(ssim) });
    await rm(salida, { force: true });
  }

  await rm(ref, { force: true });

  console.log("\n  Referencia de lo que se sirve hoy en webs de este tipo:");
  console.log("    · un fondo de hero de 56 s entre 3 y 6 MB es razonable");
  console.log("    · por encima de 8 MB empieza a castigar la carga en móvil");

  const buenos = resultados.filter((r) => r.kb <= 6000 && Number.isFinite(r.psnr));
  if (buenos.length) {
    buenos.sort((a, b) => b.psnr - a.psnr);
    console.log(`\n  mejor opción por debajo de 6 MB: ${buenos[0].nombre} (${buenos[0].kb} KB, ${buenos[0].psnr} dB)`);
  } else {
    console.log("\n  ninguna opción baja de 6 MB");
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
