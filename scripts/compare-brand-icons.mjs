/**
 * compare-brand-icons.mjs — renderiza las marcas al tamaño real del navbar.
 *
 * POR QUÉ
 *
 * Medir el viewBox no dice cómo se ve el icono: a 17 px, un trazo grueso pesa
 * más que uno fino aunque ocupen el mismo cuadrado. Aquí se rasterizan las tres
 * marcas al tamaño exacto al que se muestran y se amplían para poder juzgarlas.
 *
 * No abre navegador.
 *
 * Uso: node scripts/compare-brand-icons.mjs [alturaPx] [zoom]
 */
import sharp from "sharp";
import { resolve } from "node:path";

const ALTURA = Number(process.argv[2] ?? 17);
const ZOOM = Number(process.argv[3] ?? 8);

const MARCAS = [
  ["facebook", "public/assets/brand/facebook-mark.svg"],
  ["instagram-actual", "public/assets/brand/instagram-mark.svg"],
  ["instagram-NUEVO", "public/assets/brand/instagram-marknew.svg"],
  ["booking", "public/assets/brand/booking-mark.svg"],
];

async function main() {
  const trozos = [];
  let x = 30;
  const alto = ALTURA * ZOOM;

  for (const [nombre, ruta] of MARCAS) {
    // Se rasteriza a la altura real y luego se amplía para verlo
    const buf = await sharp(resolve(process.cwd(), ruta), { density: 200, limitInputPixels: false })
      .resize({ height: alto, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer({ resolveWithObject: true });

    console.log(`  ${nombre.padEnd(10)} renderizado ${buf.info.width}×${buf.info.height} (altura real ${ALTURA} px)`);

    trozos.push({ input: buf.data, left: x, top: 60 });
    x += buf.info.width + 40;
  }

  const ancho = x + 10;

  await sharp({
    create: { width: ancho, height: alto + 120, channels: 4, background: { r: 12, g: 20, b: 17, alpha: 1 } },
  })
    .composite(trozos)
    .png()
    .toFile(resolve(process.cwd(), ".tmp-marcas.png"));

  console.log(`\n  comparación a ${ZOOM}× del tamaño real: .tmp-marcas.png (${ancho}×${alto + 120})`);
  console.log("  orden: facebook · instagram · booking");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
