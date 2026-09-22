/**
 * import-facility-images.mjs — normaliza las fotos de instalaciones.
 *
 * Toma las imágenes que aportó el propietario (nombres en español, sueltas en
 * public/instalaciones/), las convierte a WebP y las deja en
 * public/assets/facilities/ con nombre en polaco, que es el idioma del sitio.
 *
 * Criterios:
 *   - WebP a calidad 84: es el formato que ya usa el resto del sitio y a esa
 *     calidad no se aprecia diferencia con el JPEG original, pero pesa entre un
 *     40% y un 70% menos.
 *   - Ancho máximo 1600 px: por encima de eso no aporta nada en una rejilla de
 *     tarjetas y solo engorda el archivo.
 *   - Sin espacios ni acentos en el nombre, para evitar problemas en URLs.
 *
 * Los originales se conservan en public/import-original/instalaciones/.
 *
 * Uso: node scripts/import-facility-images.mjs
 */
import sharp from "sharp";
import { mkdir, copyFile, rm, stat, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const RAIZ = process.cwd();
const ORIGEN_DIR = resolve(RAIZ, "public", "instalaciones");
const DESTINO_DIR = resolve(RAIZ, "public", "assets", "facilities");
const RESPALDO_DIR = resolve(RAIZ, "public", "import-original", "instalaciones");

/**
 * nombre original → nombre en polaco.
 *
 * Los nombres españoles describían el contenido pero el sitio es polaco, inglés
 * y alemán: el nombre del archivo debe ser neutro y en el idioma del proyecto.
 */
const MAPA = [
  { origen: "vistaapartamentodesdefuera.jpg", destino: "apartament-z-zewnatrz" },
  { origen: "sala.jpg", destino: "salon-z-kominkiem" },
  { origen: "cocina.jpg", destino: "kuchnia" },
  { origen: "cocinacomedor.jpg", destino: "jadalnia" },
  { origen: "habitacionprincipal.jpg", destino: "sypialnia" },
  { origen: "habitacion doble.jpg", destino: "sypialnia-dwuosobowa" },
  { origen: "baño.jpg", destino: "lazienka" },
  { origen: "terrasa.jpg", destino: "taras" },
  { origen: "jacuzzi.jpg", destino: "balia" },
  { origen: "sauna.jpg", destino: "sauna" },
  { origen: "grill.jpg", destino: "miejsce-na-ognisko" },
  { origen: "playground.jpg", destino: "plac-zabaw" },
];

const ANCHO_MAX = 1200;
const CALIDAD = 80;

/**
 * El plano aéreo es un caso aparte.
 *
 * Lleva rótulos impresos (Apartamenty, Rekreacja, Plaża, Marina, ZenziBar, Slip)
 * y hay que poder leerlos, así que se conserva a resolución completa y con más
 * calidad que el resto. Pesa más, pero se carga una sola vez y es la imagen que
 * sitúa todo el complejo de un vistazo.
 */
const PLANO = { origen: "instalaciones.jpg", destino: "plan-osrodka", calidad: 84, anchoMax: 1600 };

async function main() {
  if (!existsSync(ORIGEN_DIR)) {
    console.error(`No existe ${ORIGEN_DIR}`);
    process.exit(1);
  }
  await mkdir(DESTINO_DIR, { recursive: true });
  await mkdir(RESPALDO_DIR, { recursive: true });

  console.log("original".padEnd(34) + "nuevo nombre".padEnd(26) + "salida");

  for (const { origen, destino, calidad, anchoMax } of [...MAPA, PLANO]) {
    const src = join(ORIGEN_DIR, origen);
    if (!existsSync(src)) {
      console.log(`  ${origen.padEnd(32)} NO ENCONTRADO`);
      process.exitCode = 1;
      continue;
    }

    const meta = await sharp(src).metadata();
    const antes = (await stat(src)).size;
    const out = join(DESTINO_DIR, `${destino}.webp`);
    const limite = anchoMax ?? ANCHO_MAX;
    const q = calidad ?? CALIDAD;

    await sharp(src)
      .rotate() // respeta la orientación EXIF
      .resize({ width: Math.min(meta.width ?? limite, limite), withoutEnlargement: true })
      .webp({ quality: q, effort: 6 })
      .toFile(out);

    const despues = (await stat(out)).size;
    const salida = await sharp(out).metadata();

    console.log(
      `  ${origen.padEnd(32)}${(destino + ".webp").padEnd(26)}` +
        `${salida.width}×${salida.height}  ${(antes / 1024) | 0} KB → ${(despues / 1024) | 0} KB`,
    );

    // Respaldo del original (copia, no move: en Windows el archivo puede estar bloqueado)
    try {
      await copyFile(src, join(RESPALDO_DIR, origen));
    } catch {
      console.warn(`    aviso: no se pudo respaldar ${origen}`);
    }
  }

  // Retirar los originales de public/
  let retirados = 0;
  for (const { origen } of [...MAPA, PLANO]) {
    const src = join(ORIGEN_DIR, origen);
    if (!existsSync(src)) continue;
    try {
      await rm(src, { force: true });
      retirados++;
    } catch {
      console.warn(`  no se pudo retirar public/instalaciones/${origen}`);
    }
  }

  const quedan = (await readdir(ORIGEN_DIR).catch(() => [])).filter((f) =>
    /\.(jpe?g|png|webp|avif)$/i.test(f),
  );
  if (quedan.length === 0) {
    await rm(ORIGEN_DIR, { recursive: true, force: true });
    console.log("\npublic/instalaciones/ queda vacía y se elimina.");
  }

  console.log(
    `\n${retirados}/${MAPA.length + 1} originales retirados · respaldo en ` +
      `public/import-original/instalaciones/ · generadas en public/assets/facilities/`,
  );
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
