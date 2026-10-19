/**
 * import-new-photos.mjs
 * ----------------------------------------------------------------------------
 * Importa las fotos nuevas del propietario (escritorio) al proyecto.
 *
 *   Carpeta origen: C:\Users\Ayrton\Desktop\apartamenty liberta fotos
 *     domku A  → Liberta I     (domek A)
 *     domek b  → Liberta II    (domek b)
 *     domek C  → Liberta III   (domek C)
 *     (domek d → Liberta IV: pendiente, aún no las ha enviado)
 *     zdjecia sauna ogniski → instalaciones compartidas
 *
 * QUÉ HACE
 *   1. Convierte a JPEG sRGB (las PNG de iPhone vienen en Display P3: sin esto
 *      los naranjas y verdes salen subidos en navegadores que no interpretan
 *      el perfil).
 *   2. Normaliza el tamaño (máx. 1600 px de lado mayor) y quita metadatos.
 *   3. Escribe con NOMBRES SEMÁNTICOS ya existentes (`salon-parter.jpg`,
 *      `bania-goralska.jpg`…): los textos alternativos de ApartmentDetail y
 *      ApartmentCard están indexados por ese nombre.
 *   4. Borra los originales antiguos de I, II y III que ya no se usan, y sus
 *      variantes responsivas (se regeneran en `prebuild`).
 *   5. NO toca Liberta IV.
 *
 * Uso: node scripts/import-new-photos.mjs [ruta-origen]
 */
import sharp from "sharp";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ORIGEN =
  process.argv[2] ?? "C:\\Users\\Ayrton\\Desktop\\apartamenty liberta fotos";
const ROOT = process.cwd();
const PUBLIC = resolve(ROOT, "public");
const APT_DIR = join(PUBLIC, "assets", "apartments");
const FAC_DIR = join(PUBLIC, "assets", "facilities");
const RESP_DIR = join(PUBLIC, "assets", "responsive");

/** Lado mayor al que se normaliza. 1600 cubre el ancho máximo de los srcset. */
const MAX_EDGE = 1600;
const QUALITY = 84;

/**
 * Mapa de importación.
 *
 * `hero` marca la foto principal de la ficha. Se elige SIEMPRE una foto
 * horizontal y emocional: la tarjeta y el hero de la ficha son formatos anchos,
 * y una vertical se recorta por el centro hasta perder el encuadre.
 */
const PLAN = {
  "domku A": {
    apartment: "liberta-i",
    photos: {
      // HERO: balia al atardecer (horizontal, es la foto que vende el sitio)
      "bania-goralska.jpg": "image00002(1).png",
      "exterior-dzien.jpg": "image00001.png",
      "salon-parter.jpg": "image00003.png",
      "kuchnia.jpg": "image00004(1).png",
      "sypialnia-pietro-1.jpg": "image00001(1).png",
      "sypialnia-pietro-2.jpg": "image00002(2).png",
      "sypialnia-pietro-3.jpg": "image00003(1).png",
      "sypialnia-pietro-4.jpg": "image00004(2).png",
    },
    // Duplicados del envío (misma escena repetida): no se importan
    ignore: ["image00002.png", "image00004.png"],
  },
  "domek b": {
    apartment: "liberta-ii",
    photos: {
      // HERO: terraza cubierta con el lago al fondo
      "taras.jpg": "9363.jpg",
      "taras-widok.jpg": "9364.jpg",
      "salon-parter.jpg": "9361.jpg",
      "salon-aneks-1.jpg": "9367.jpg",
      "kuchnia.jpg": "9365.jpg",
      "lazienka.jpg": "9366.jpg",
      "sypialnia-pietro-1.jpg": "9368.jpg",
      "sypialnia-pietro-2.jpg": "9369.jpg",
    },
    ignore: ["9360(2).jpg"],
  },
  "domek C": {
    apartment: "liberta-iii",
    photos: {
      // HERO: terraza al atardecer
      "taras.jpg": "image00011.png",
      "exterior-dzien.jpg": "image00001.png",
      "bania-goralska.jpg": "image00002.png",
      "salon-parter.jpg": "image00003.png",
      "kuchnia.jpg": "image00004.png",
      "kominek.jpg": "image00005.png",
      "sypialnia-pietro-1.jpg": "image00007.png",
      "sypialnia-pietro-2.jpg": "image00009.png",
      "sypialnia-pietro-3.jpg": "image00010.png",
    },
  },
};

/** Instalaciones compartidas: el nombre final conserva el slug de facilities.ts. */
const FACILITIES = {
  // Sauna de barril con ventanal al lago (mujer sentada, atardecer)
  "sauna.webp": "zdjecia sauna ogniski/image00002.png",
  // Ognisko al atardecer junto al agua
  "miejsce-na-ognisko.webp": "zdjecia sauna ogniski/image00006.png",
};

/** Variantes responsivas generadas (no son fuente: se borran y se regeneran). */
async function clearResponsive(apartment) {
  const dir = join(RESP_DIR, "assets", "apartments", apartment);
  if (!existsSync(dir)) return 0;
  const files = await readdir(dir).catch(() => []);
  await rm(dir, { recursive: true, force: true });
  return files.length;
}

async function convert(srcPath, outPath) {
  await mkdir(resolve(outPath, ".."), { recursive: true });
  const ext = outPath.endsWith(".webp") ? "webp" : "jpeg";
  let img = sharp(srcPath).rotate().toColourspace("srgb");
  const meta = await img.metadata();
  const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
  if (longEdge > MAX_EDGE) {
    img = img.resize({
      width: meta.width >= meta.height ? MAX_EDGE : undefined,
      height: meta.height > meta.width ? MAX_EDGE : undefined,
      withoutEnlargement: true,
      kernel: "lanczos3",
    });
  }
  const info = await (ext === "webp"
    ? img.webp({ quality: QUALITY - 4, effort: 5 }).toFile(outPath)
    : img.jpeg({ quality: QUALITY, mozjpeg: true, chromaSubsampling: "4:4:4" }).toFile(outPath));
  const kb = Math.round(info.size / 1024);
  const out = await sharp(outPath).metadata();
  return { kb, width: out.width, height: out.height };
}

async function main() {
  if (!existsSync(ORIGEN)) {
    console.error(`✗ No existe la carpeta de origen: ${ORIGEN}`);
    process.exit(1);
  }

  let total = 0;
  let totalKb = 0;

  for (const [folder, plan] of Object.entries(PLAN)) {
    const srcDir = join(ORIGEN, folder);
    if (!existsSync(srcDir)) {
      console.warn(`⚠ Falta la carpeta "${folder}" — se omite`);
      continue;
    }
    const outDir = join(APT_DIR, plan.apartment);
    await mkdir(outDir, { recursive: true });

    console.log(`\n### ${folder} → ${plan.apartment}`);
    const keep = new Set(Object.keys(plan.photos));

    for (const [target, source] of Object.entries(plan.photos)) {
      const src = join(srcDir, source);
      if (!existsSync(src)) {
        console.warn(`  ⚠ falta ${source}`);
        continue;
      }
      const out = join(outDir, target);
      const r = await convert(src, out);
      total++;
      totalKb += r.kb;
      console.log(`  ✓ ${target.padEnd(26)} ← ${source.padEnd(20)} ${r.width}×${r.height}  ${r.kb} KB`);
    }

    // Limpieza: originales antiguos que ya no forman parte de este apartamento
    const existing = await readdir(outDir);
    for (const file of existing) {
      if (!/\.(jpe?g|png|webp)$/i.test(file)) continue;
      if (keep.has(file)) continue;
      await rm(join(outDir, file), { force: true });
      console.log(`  − ${file} (obsoleto, eliminado)`);
    }

    const removed = await clearResponsive(plan.apartment);
    if (removed) console.log(`  ⟳ ${removed} variantes responsivas borradas (se regeneran en prebuild)`);
  }

  console.log("\n### Instalaciones compartidas");
  await mkdir(FAC_DIR, { recursive: true });
  for (const [target, source] of Object.entries(FACILITIES)) {
    const src = join(ORIGEN, source);
    if (!existsSync(src)) {
      console.warn(`  ⚠ falta ${source}`);
      continue;
    }
    const out = join(FAC_DIR, target);
    const r = await convert(src, out);
    total++;
    totalKb += r.kb;
    console.log(`  ✓ ${target.padEnd(26)} ← ${source.padEnd(34)} ${r.width}×${r.height}  ${r.kb} KB`);
  }

  const removedFac = await clearResponsive("__facilities__");
  void removedFac;

  console.log(
    `\n${total} fotos importadas · ${Math.round(totalKb / 1024 * 10) / 10} MB en total`,
  );
  console.log("Siguiente paso: npm run images:responsive  (regenera srcset + LQIP)");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
