/**
 * inspect-png.mjs — lee los píxeles de una captura y localiza dónde termina la
 * tarjeta, para distinguir un problema de maquetación de un problema de captura.
 *
 * No abre navegador.
 *
 * Uso: node scripts/inspect-png.mjs .audit/cards-listado.png [filaY]
 */
import sharp from "sharp";

const archivo = process.argv[2] ?? ".audit/cards-listado.png";
const fila = Number(process.argv[3] ?? 120);

const { data, info } = await sharp(archivo)
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
console.log(`imagen: ${width}×${height}, ${channels} canales`);

const pixel = (x, y) => {
  const i = (y * width + x) * channels;
  return [data[i], data[i + 1], data[i + 2]];
};

// Color de fondo de la página (esquina inferior izquierda, fuera de las tarjetas)
const fondo = pixel(4, height - 4);
console.log(`fondo de página en (4,${height - 4}): rgb(${fondo.join(",")})`);

/** Cuenta cuántos píxeles de la fila se alejan del fondo. */
const distinto = (p, q) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) > 12;

let primero = null;
let ultimo = null;
for (let x = 0; x < width; x++) {
  if (distinto(pixel(x, fila), fondo)) {
    if (primero === null) primero = x;
    ultimo = x;
  }
}

console.log(`\nfila y=${fila}: contenido de x=${primero} a x=${ultimo}  (ancho ${ultimo - primero + 1} px)`);
console.log(`¿llega al borde derecho de la ventana (${width} px)? ${ultimo >= width - 110 ? "SÍ" : "NO"}`);

// Perfil de varias filas para ver si todas coinciden
console.log("\nperfil por filas:");
for (const y of [60, 100, 140, 180, 220, 260]) {
  let p0 = null;
  let p1 = null;
  for (let x = 0; x < width; x++) {
    if (distinto(pixel(x, y), fondo)) {
      if (p0 === null) p0 = x;
      p1 = x;
    }
  }
  console.log(`  y=${String(y).padStart(4)}  x ${String(p0).padStart(4)} → ${String(p1).padStart(4)}  (ancho ${p1 !== null ? p1 - p0 + 1 : 0})`);
}
