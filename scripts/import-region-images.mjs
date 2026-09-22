/**
 * import-region-images.mjs — normaliza las fotos de la página /atrakcje/.
 *
 * Toma las imágenes con nombres en español (o sueltos, como
 * "rezerwat-sosny-taborskiej-009-scaled") y las deja en
 * public/assets/attractions/ con nombre en polaco, en WebP.
 *
 * POR QUÉ ESTE SCRIPT Y NO UNA CONVERSIÓN A MANO
 *
 *   - Los nombres originales mezclan idiomas y llevan sufijos de CMS
 *     ("-009-scaled"). En una URL pública eso se nota.
 *   - Varios archivos son JPEG de 1 MB. En WebP y con el ancho ajustado al uso
 *     real (tarjeta de ~560 px) bajan a una fracción.
 *   - El ancho se recorta a 1200 px: por encima de eso no aporta nada a doble
 *     columna y solo engorda el archivo. El ahorro real está ahí, no en el
 *     formato: los JPEG ya venían comprimidos.
 *
 * Los originales se conservan en public/import-original/atracciones/.
 *
 * Uso: node scripts/import-region-images.mjs
 */
import sharp from "sharp";
import { mkdir, copyFile, rm, stat, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const RAIZ = process.cwd();
const ORIGEN_DIR = resolve(RAIZ, "public", "atracciones");
const DESTINO_DIR = resolve(RAIZ, "public", "assets", "attractions");
const RESPALDO_DIR = resolve(RAIZ, "public", "import-original", "atracciones");

/**
 * nombre original → slug, que es lo que enlaza src/data/attractions.ts.
 *
 * Son los 13 archivos que hay realmente en public/atracciones/. Dos de ellos ya
 * tenían foto en public/assets/attractions/ (los szlaki rowerowe y el rejs): la
 * imagen del propietario sustituye a la que había, porque es una foto del sitio
 * real y no de banco.
 *
 * Cinco atracciones se quedan sin foto porque no hay archivo:
 *   bunkry-stare-jablonski, plaza-pomosty, wyciag-nart-wodnych (ya tenía),
 *   catering-kraina-jezior y wypozyczalnia-kajakow-rowerow.
 */
const MAPA = [
  { origen: "rejs motorówką z właścicielem.jpg", destino: "rejs-motorowka" },
  { origen: "SUP, kajaki i rowery.jpg", destino: "sup-kajaki" },
  { origen: "Rowery dla gości.jpg", destino: "szlaki-rowerowe" },
  { origen: "rezerwat-sosny-taborskiej-009-scaled.jpg", destino: "rezerwat-sosny-taborskiej" },
  { origen: "Jazda konna.jpg", destino: "jazda-konna" },
  { origen: "Strzelnica sportowa.jpg", destino: "strzelnica" },
  { origen: "Narty wodne w Ostródzie.jpg", destino: "narty-wodne" },
  { origen: "Pola golfowe.jpg", destino: "golf" },
  { origen: "Pola Grunwaldzkie.jpg", destino: "pola-grunwaldzkie" },
  { origen: "Restauracja Pajda Mazur.jpg", destino: "pajda-mazur" },
  { origen: "Wesele-w-Sielance-4.jpg", destino: "sielanka" },
  { origen: "Ognisko i grill.webp", destino: "ognisko-i-grill" },
  { origen: "Festiwal SUP w Kątnie.jpg", destino: "festiwal-sup" },
];

const ANCHO_MAX = 1200;
const CALIDAD = 80;

async function main() {
  if (!existsSync(ORIGEN_DIR)) {
    console.error(`No existe ${ORIGEN_DIR}`);
    process.exit(1);
  }
  await mkdir(DESTINO_DIR, { recursive: true });
  await mkdir(RESPALDO_DIR, { recursive: true });

  console.log("original".padEnd(46) + "slug".padEnd(30) + "salida");

  let hechas = 0;
  const faltan = [];

  for (const { origen, destino } of MAPA) {
    const src = join(ORIGEN_DIR, origen);
    if (!existsSync(src)) {
      faltan.push(origen);
      continue;
    }

    const meta = await sharp(src).metadata();
    const antes = (await stat(src)).size;
    const out = join(DESTINO_DIR, `${destino}.webp`);

    await sharp(src)
      .rotate()
      .resize({ width: Math.min(meta.width ?? ANCHO_MAX, ANCHO_MAX), withoutEnlargement: true })
      .webp({ quality: CALIDAD, effort: 6 })
      .toFile(out);

    const despues = (await stat(out)).size;
    const salida = await sharp(out).metadata();
    hechas++;

    console.log(
      `  ${origen.slice(0, 44).padEnd(44)}${(destino + ".webp").padEnd(30)}` +
        `${salida.width}×${salida.height}  ${(antes / 1024) | 0} KB → ${(despues / 1024) | 0} KB`,
    );

    try {
      await copyFile(src, join(RESPALDO_DIR, origen));
    } catch {
      console.warn(`    aviso: no se pudo respaldar ${origen}`);
    }
  }

  if (faltan.length) {
    console.log(`\n  no encontrados (${faltan.length}): ${faltan.join(", ")}`);
  }

  // Retirar los originales de public/
  for (const { origen } of MAPA) {
    const src = join(ORIGEN_DIR, origen);
    if (!existsSync(src)) continue;
    try {
      await rm(src, { force: true });
    } catch {
      console.warn(`  no se pudo retirar public/atracciones/${origen}`);
    }
  }

  const quedan = (await readdir(ORIGEN_DIR).catch(() => [])).filter((f) =>
    /\.(jpe?g|png|webp|avif)$/i.test(f),
  );
  if (quedan.length === 0) {
    await rm(ORIGEN_DIR, { recursive: true, force: true });
    console.log("\npublic/atracciones/ queda vacía y se elimina.");
  } else {
    console.log(`\nquedan sin mapear en public/atracciones/: ${quedan.join(", ")}`);
  }

  console.log(
    `\n${hechas}/${MAPA.length} convertidas · respaldo en public/import-original/atracciones/`,
  );
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
