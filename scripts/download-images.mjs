// scripts/download-images.mjs
// Ejecuta: node scripts/download-images.mjs
// Descarga las imágenes del sitio actual de Liberta a /public/assets/

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");
const ASSETS_DIR = join(ROOT, "public", "assets");

const BASE = "https://apartamentyliberta.pl";

/**
 * Lista completa de imágenes a descargar.
 * Categorizadas por destino en /public/assets/.
 */
const IMAGES = {
  // Logo y branding
  "branding/logo.png": `${BASE}/wp-content/uploads/2020/04/Apartamenty-na-Mazurach-na-jeziorem-Liberta.png`,
  "branding/welcome.png": `${BASE}/wp-content/uploads/2020/05/zapraszamy-na-Mazury.png`,
  "branding/welcome-en.png": `${BASE}/wp-content/uploads/2020/10/welcome.png`,
  "branding/welcome-de.png": `${BASE}/wp-content/uploads/2020/08/podpisDE.png`,
  "branding/podpis.png": `${BASE}/wp-content/uploads/2020/05/podpis.png`,
  "branding/pinezka.png": `${BASE}/wp-content/uploads/2020/04/pinezka.png`,
  "branding/telefon.png": `${BASE}/wp-content/uploads/2020/04/telefon.png`,

  // Iconos redes sociales
  "social/facebook.png": `${BASE}/wp-content/uploads/2020/04/facebook.png`,
  "social/instagram.png": `${BASE}/wp-content/uploads/2020/04/instagram.png`,
  "social/youtube.png": `${BASE}/wp-content/uploads/2020/04/youtube.png`,

  // Hero principal
  "hero/hero-beach.jpg": `${BASE}/wp-content/uploads/2020/05/pi%C4%99kna-pla%C5%BCa-na-Mazurach.jpg`,
  "hero/hero-apartments.jpg": `${BASE}/wp-content/uploads/2020/05/luksusowe-apartamenty-nad-jeziorem.jpg`,
  "hero/hero-lake.jpg": `${BASE}/wp-content/uploads/2020/05/Widok-na-Jezioro-Szel%C4%85g-Wielki-z-aartament%C3%B3w-na-Mazurach..jpg`,

  // Atracciones / editorial
  "editorial/atrakcje.jpg": `${BASE}/wp-content/uploads/2020/05/atrakcje-na-Mazurach.jpg`,
  "editorial/mapa-dojazdu.jpg": `${BASE}/wp-content/uploads/2020/04/mapa-dojazdu-do-Apartament%C3%B3w-na-Mazurach-Liberta.jpg`,

  // Apartamentos (galería completa — reutilizada en las 4 unidades actualmente)
  "apartments/liberta-i/salon-parter.jpg": `${BASE}/wp-content/uploads/2020/05/klimatyczny-salon-na-parterze-w-apartamentach-na-Mazurach.jpg`,
  "apartments/liberta-i/salon-aneks-1.jpg": `${BASE}/wp-content/uploads/2020/05/salon-z-aneksem-w-apartamencie-na-Mazurach.jpg`,
  "apartments/liberta-i/salon-aneks-2.jpg": `${BASE}/wp-content/uploads/2020/05/salon-z-aneksem.jpg`,
  "apartments/liberta-i/kuchnia.jpg": `${BASE}/wp-content/uploads/2020/05/aneks-kuchenny-w-apartamencie-Liberta.jpg`,
  "apartments/liberta-i/sypialnia-parter.jpg": `${BASE}/wp-content/uploads/2020/05/sypialnia-dwuosobowa-na-parterze-a-apartamencie-nad-jeziorem.jpg`,
  "apartments/liberta-i/luksus.jpg": `${BASE}/wp-content/uploads/2020/05/Luksus-w-apartamentach-Liberta.jpg`,
  "apartments/liberta-i/lazienka-parter-1.jpg": `${BASE}/wp-content/uploads/2020/05/nowoczesna-%C5%82azienka-na-parterze-w-apartamentach-na-Mazurach.jpg`,
  "apartments/liberta-i/lazienka-parter-2.jpg": `${BASE}/wp-content/uploads/2020/05/%C5%82azienka-na-parterze-w-apartamencie-nad-jeziorem.jpg`,
  "apartments/liberta-i/lazienka.jpg": `${BASE}/wp-content/uploads/2020/05/%C5%82azienka-w-apartamentach-na-Mazurach.jpg`,
  "apartments/liberta-i/sypialnia-pietro-glowna.jpg": `${BASE}/wp-content/uploads/2020/05/g%C5%82%C3%B3wna-sypialnia-dwuosobowa-na-pi%C4%99trze-apartamentu-nad-jeziorem.jpg`,
  "apartments/liberta-i/sypialnia-pietro-2.jpg": `${BASE}/wp-content/uploads/2020/05/sypialnia-dwuosobowa-na-pi%C4%99trze-apartamentu-na-Mazurach.jpg`,
  "apartments/liberta-i/sypialnia-pietro-3.jpg": `${BASE}/wp-content/uploads/2020/05/sypialnia-z-pojedynczymi-%C5%82%C3%B3%C5%BCkami-na-pi%C4%99trze-apartamentu-na-Mazurach.jpg`,
  "apartments/liberta-i/sypialnia-pietro-4.jpg": `${BASE}/wp-content/uploads/2020/05/sypialnia-z-pojedynczymi-%C5%82%C3%B3%C5%BCkami-na-pi%C4%99trze-apartamentu-nad-jeziorem.jpg`,
  "apartments/liberta-i/lozko-detal.jpg": `${BASE}/wp-content/uploads/2020/05/pojedyncze-%C5%82%C3%B3%C5%BCko-w-sypialni-dwuosobowej-na-pi%C4%99trze-apartamentu-Liberta.jpg`,
  "apartments/liberta-i/bania-goralska.jpg": `${BASE}/wp-content/uploads/2020/05/tradycyjna-g%C3%B3ralska-bania-w-apartamencie-na-Mazurach.jpg`,
  "apartments/liberta-i/taras.jpg": `${BASE}/wp-content/uploads/2020/05/taras-apartamentu-nad-jeziorem.jpg`,
  "apartments/liberta-i/exterior-dzien.jpg": `${BASE}/wp-content/uploads/2020/05/apartamenty-nad-jeziorem.jpg`,
  "apartments/liberta-i/exterior-noc.jpg": `${BASE}/wp-content/uploads/2020/05/apartamenty-na-Mazurach-noc%C4%85.jpg`,

  // Festival SUP 2026
  "events/festiwal-sup-2026.jpg": `${BASE}/wp-content/uploads/2026/05/1000060081.jpg`,
};

/**
 * Replicar galería en las 4 unidades (estado actual del sitio WP).
 * Cuando el cliente entregue fotos diferenciadas, actualizar estas rutas.
 */
const APT_NUMBER = 1;
for (let i = APT_NUMBER + 1; i <= 4; i++) {
  // En el futuro: fotos únicas por apartamento
  // Por ahora, las 4 unidades usan el mismo set
  const num = i;
  Object.keys(IMAGES).forEach((path) => {
    if (path.startsWith("apartments/liberta-i/")) {
      const newKey = path.replace("liberta-i/", `liberta-${romanize(num)}/`);
      IMAGES[newKey] = IMAGES[path];
    }
  });
}

function romanize(num) {
  const map = { 1: "i", 2: "ii", 3: "iii", 4: "iv" };
  return map[num] || String(num);
}

async function download(url, dest) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (!response.ok) {
      console.error(`✗ ${response.status} ${url}`);
      return false;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buffer);
    const sizeKB = (buffer.length / 1024).toFixed(1);
    console.log(`✓ ${sizeKB}KB ${url.replace(BASE, "")} → ${dest.replace(ROOT + "\\", "")}`);
    return true;
  } catch (err) {
    console.error(`✗ ${err.message} ${url}`);
    return false;
  }
}

async function main() {
  console.log(`Descargando ${Object.keys(IMAGES).length} imágenes a ${ASSETS_DIR}\n`);
  let ok = 0;
  let fail = 0;
  for (const [relPath, url] of Object.entries(IMAGES)) {
    const dest = join(ASSETS_DIR, relPath);
    if (existsSync(dest)) {
      console.log(`↻ skip ${relPath}`);
      continue;
    }
    const success = await download(url, dest);
    success ? ok++ : fail++;
  }
  console.log(`\n✓ ${ok} descargadas · ✗ ${fail} fallidas · total: ${Object.keys(IMAGES).length}`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
