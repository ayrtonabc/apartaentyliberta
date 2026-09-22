/**
 * check-brand-fit.mjs — mide si el dibujo de cada marca llena su viewBox.
 *
 * POR QUÉ IMPORTA
 *
 * Los tres iconos del navbar se dimensionan con un lado cuadrado. Si el dibujo
 * de una marca deja margen dentro de su viewBox, ese icono se ve más pequeño que
 * los otros aunque el CSS diga lo mismo. Rasterizar y recortar el contenido da
 * la proporción real del dibujo frente a la del marco.
 *
 * No abre navegador.
 */
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const MARCAS = [
  ["Facebook", "public/assets/brand/facebook-mark.svg"],
  ["Instagram", "public/assets/brand/instagram-mark.svg"],
  ["Booking", "public/assets/brand/booking-mark.svg"],
];

console.log(
  "marca".padEnd(12) + "viewBox".padEnd(24) + "ratio vb".padEnd(11) + "contenido".padEnd(14) + "ratio dibujo  relleno",
);

for (const [nombre, ruta] of MARCAS) {
  const svg = await readFile(resolve(process.cwd(), ruta), "utf8");
  const vb = /viewBox="([^"]+)"/.exec(svg)?.[1]?.trim().split(/\s+/).map(Number);

  try {
    const { info } = await sharp(Buffer.from(svg), { density: 72, limitInputPixels: false })
      .trim({ threshold: 10 })
      .toBuffer({ resolveWithObject: true });

    const ratioVb = vb ? vb[2] / vb[3] : NaN;
    const ratioDibujo = info.width / info.height;
    // 1.000 = el dibujo llena el marco exactamente
    const relleno = ratioDibujo / ratioVb;

    console.log(
      nombre.padEnd(12) +
        (vb ? `${vb[2]}×${vb[3]}` : "?").padEnd(24) +
        ratioVb.toFixed(3).padEnd(11) +
        `${info.width}×${info.height}`.padEnd(14) +
        ratioDibujo.toFixed(3).padEnd(13) +
        relleno.toFixed(3),
    );
  } catch (error) {
    console.log(`${nombre.padEnd(12)} error: ${error.message}`);
  }
}

console.log(
  "\nrelleno = proporción del dibujo / proporción del viewBox.\n" +
    "1.000 significa que el dibujo toca los cuatro bordes de su marco.",
);
