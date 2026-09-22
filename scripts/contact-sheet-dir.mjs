/**
 * contact-sheet-dir.mjs — rejilla de todas las fotos de una carpeta.
 *
 * Sirve para revisar de un vistazo un lote de fotos que aporta el cliente y
 * escribir descripciones ajustadas a lo que se ve, en lugar de suponerlo por el
 * nombre del archivo.
 *
 * No abre navegador.
 *
 * Uso: node scripts/contact-sheet-dir.mjs <carpeta> [ancho] [salida]
 */
import sharp from "sharp";
import { readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";

const DIR = resolve(process.cwd(), process.argv[2] ?? "public/instalaciones");
const ANCHO = Number(process.argv[3] ?? 300);
const SALIDA = resolve(process.cwd(), process.argv[4] ?? ".tmp-contacto.png");
const COLS = 4;

async function main() {
  if (!existsSync(DIR)) {
    console.error(`No existe ${DIR}`);
    process.exit(1);
  }

  const archivos = (await readdir(DIR)).filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f)).sort();
  if (archivos.length === 0) {
    console.error("La carpeta no tiene imágenes");
    process.exit(1);
  }

  const trozos = [];
  let alto = 0;

  for (let i = 0; i < archivos.length; i++) {
    const { data, info } = await sharp(join(DIR, archivos[i]))
      .resize({ width: ANCHO })
      .toBuffer({ resolveWithObject: true });
    alto = info.height;

    const nombre = archivos[i].replace(/\.[a-z0-9]+$/i, "");
    const etiqueta = Buffer.from(
      `<svg width="${info.width}" height="24">` +
        `<rect width="100%" height="24" fill="rgba(0,0,0,0.78)"/>` +
        `<text x="6" y="17" font-family="monospace" font-size="13" fill="#fff">${nombre}</text>` +
        `</svg>`,
    );

    const conEtiqueta = await sharp(data)
      .composite([{ input: etiqueta, top: 0, left: 0 }])
      .png()
      .toBuffer();

    const fila = Math.floor(i / COLS);
    trozos.push({ input: conEtiqueta, left: (i % COLS) * ANCHO, top: fila * (alto + 28) });
  }

  const filas = Math.ceil(archivos.length / COLS);
  const lienzoAlto = filas * (alto + 28) + 4;

  await sharp({
    create: {
      width: COLS * ANCHO,
      height: lienzoAlto,
      channels: 4,
      background: { r: 18, g: 22, b: 20, alpha: 1 },
    },
  })
    .composite(trozos)
    .png()
    .toFile(SALIDA);

  console.log(
    `${archivos.length} fotos de ${DIR.replace(process.cwd(), "")} → ${SALIDA.replace(process.cwd() + "\\", "")}` +
      `  (${Math.round((await stat(SALIDA)).size / 1024)} KB, ${COLS * ANCHO}×${lienzoAlto})`,
  );
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
