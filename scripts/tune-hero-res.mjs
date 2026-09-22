/**
 * tune-hero-res.mjs — busca resolución y CRF que dejen el vídeo completo
 * (56 s, sin cortar) por debajo de 6 MB sin destrozar la calidad.
 *
 * CONTEXTO
 *
 * El máster son 11,36 MB a 1483 kbps, 1920×1080 y 50 fps. Recodificar a la misma
 * resolución sale MÁS pesado que el máster (17,5 MB con CRF 26): el original ya
 * está muy ajustado, así que a igual resolución no hay nada que rascar.
 *
 * Lo único que baja el peso de verdad es reducir resolución. Esta prueba mide el
 * coste en calidad de cada escalón para poder elegir con datos.
 *
 * No abre navegador.
 *
 * Uso: node scripts/tune-hero-res.mjs
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { stat, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const run = promisify(execFile);
const ORIGEN = resolve(process.cwd(), "public", "import-original", "herovideo.mp4");

/** Ancho → CRF a probar. El CRF sube cuando baja la resolución. */
const PRUEBAS = [
  { ancho: 1920, crf: 32 },
  { ancho: 1920, crf: 34 },
  { ancho: 1600, crf: 30 },
  { ancho: 1600, crf: 32 },
  { ancho: 1280, crf: 28 },
  { ancho: 1280, crf: 30 },
  { ancho: 1280, crf: 32 },
  { ancho: 960, crf: 28 },
  { ancho: 960, crf: 30 },
];

async function main() {
  if (!existsSync(ORIGEN)) {
    console.error(`No se encuentra ${ORIGEN}`);
    process.exit(1);
  }

  console.log("  ancho   crf   peso      bitrate   PSNR      SSIM");

  const resultados = [];

  for (const p of PRUEBAS) {
    const salida = resolve(process.cwd(), ".tmp-res.mp4");

    /*
     * La PSNR se mide contra el máster escalado al MISMO tamaño, no contra el
     * máster a 1920. Comparar resoluciones distintas daría una cifra inventada:
     * parte de la diferencia sería el reescalado, no la compresión.
     */
    const ref = resolve(process.cwd(), `.tmp-ref-${p.ancho}.mp4`);
    if (!existsSync(ref)) {
      await run(
        "ffmpeg",
        ["-y", "-v", "error", "-i", ORIGEN, "-an", "-vf", `scale=${p.ancho}:-2`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "8", "-pix_fmt", "yuv420p", ref],
        { maxBuffer: 1 << 28 },
      );
    }

    try {
      await run(
        "ffmpeg",
        [
          "-y", "-v", "error",
          "-i", ORIGEN,
          "-an",
          "-vf", `fps=25,scale=${p.ancho}:-2`,
          "-c:v", "libx264",
          "-profile:v", "high",
          "-level", "4.1",
          "-pix_fmt", "yuv420p",
          "-preset", "slow",
          "-crf", String(p.crf),
          "-movflags", "+faststart",
          salida,
        ],
        { maxBuffer: 1 << 28 },
      );
    } catch (error) {
      console.log(`  ${p.ancho}  crf ${p.crf}  falló: ${error.message.split("\n")[0]}`);
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
      `  ${String(p.ancho).padEnd(6)}  ${String(p.crf).padEnd(4)}  ${String(kb).padStart(6)} KB  ${String(bitrate).padStart(5)} kbps  ${String(psnr).padStart(7)}  ${ssim}`,
    );

    resultados.push({ ...p, kb, psnr: Number(psnr), ssim: Number(ssim) });
    await rm(salida, { force: true });
  }

  // Limpieza de referencias
  for (const p of PRUEBAS) {
    await rm(resolve(process.cwd(), `.tmp-ref-${p.ancho}.mp4`), { force: true });
  }

  const bajo6 = resultados.filter((r) => r.kb <= 6000 && Number.isFinite(r.psnr));
  bajo6.sort((a, b) => b.psnr - a.psnr);

  console.log("\n  opciones por debajo de 6 MB, de mejor a peor calidad:");
  for (const r of bajo6) {
    console.log(`    ${r.ancho}px · crf ${r.crf} → ${r.kb} KB · ${r.psnr} dB · SSIM ${r.ssim}`);
  }
  if (bajo6.length === 0) console.log("    ninguna");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
