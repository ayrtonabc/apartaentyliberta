/**
 * measure-mark-files.mjs — mide la proporción real del contenido de cada marca.
 *
 * Comprueba si el trazado llena su viewBox o si tiene padding interno: dos
 * iconos con el mismo CSS pueden verse de tamaños distintos por eso.
 *
 * No abre navegador.
 */
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const MARKS = [
  ["Facebook", "public/assets/brand/facebook-mark.svg"],
  ["Booking", "public/assets/brand/booking-mark.svg"],
];

console.log("marca".padEnd(12) + "viewBox".padEnd(20) + "contenido".padEnd(14) + "relleno".padEnd(12) + "proporción");

for (const [nombre, ruta] of MARKS) {
  const svg = await readFile(ruta, "utf8");
  const vbMatch = /viewBox="([^"]+)"/.exec(svg);
  const vb = vbMatch ? vbMatch[1].trim().split(/\s+/).map(Number) : null;

  try {
    const { info } = await sharp(Buffer.from(svg), { density: 400 })
      .trim({ threshold: 8 })
      .toBuffer({ resolveWithObject: true });

    // Cuánto del viewBox ocupa el contenido (0-1)
    const relleno = vb ? (info.width / info.height / (vb[2] / vb[3])).toFixed(3) : "—";

    console.log(
      nombre.padEnd(12) +
        (vb ? `${vb[2]}×${vb[3]}` : "?").padEnd(20) +
        `${info.width}×${info.height}`.padEnd(14) +
        String(relleno).padEnd(12) +
        (info.width / info.height).toFixed(3),
    );
  } catch (error) {
    console.log(`${nombre.padEnd(12)} error: ${error.message}`);
  }
}

console.log(
  "\n'proporción' = ancho/alto del contenido. Si dos marcas dan proporciones " +
    "distintas,\ncon la misma altura CSS se verán de anchos distintos.",
);
