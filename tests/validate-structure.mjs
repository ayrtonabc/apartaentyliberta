// tests/validate-structure.mjs
// Ejecuta: node tests/validate-structure.mjs
// Valida que la estructura del proyecto sea coherente sin necesidad de build.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

const errors = [];
const warnings = [];
const oks = [];

function check(condition, message, severity = "error") {
  if (condition) oks.push(message);
  else if (severity === "error") errors.push(message);
  else warnings.push(message);
}

const exists = (rel) => existsSync(join(ROOT, rel));
const read = (rel) => readFileSync(join(ROOT, rel), "utf-8");
const readJSON = (rel) => JSON.parse(read(rel));

console.log("🔍 Validando estructura de Apartamenty Liberta\n" + "=".repeat(52));

/* ------------------------------------------------------------------ Config */
console.log("\n📁 Configuración:");
[
  "package.json",
  "astro.config.mjs",
  "tsconfig.json",
  ".env.example",
  ".gitignore",
  "README.md",
].forEach((f) => check(exists(f), f));

const pkg = readJSON("package.json");
["dev", "build", "preview", "start", "test:structure", "test:syntax", "typecheck"].forEach((s) =>
  check(Boolean(pkg.scripts?.[s]), `script "${s}" definido`),
);
check(Boolean(pkg.dependencies?.["@astrojs/sitemap"]), "@astrojs/sitemap instalado");
check(Boolean(pkg.dependencies?.["@astrojs/node"]), "@astrojs/node instalado");
check(Boolean(pkg.dependencies?.zod), "zod instalado");
check(Boolean(pkg.dependencies?.resend), "resend instalado");
check(Boolean(pkg.dependencies?.sharp), "sharp instalado");

/* -------------------------------------------------------------- Estructura */
console.log("\n📂 Estructura:");
[
  "src/pages",
  "src/components",
  "src/layouts",
  "src/data",
  "src/lib",
  "src/styles",
  "src/middleware.ts",
  "server.mjs",
  "public",
  "scripts",
].forEach((dir) => check(exists(dir), dir));

/* --------------------------------------------------------- Páginas críticas */
console.log("\n📄 Páginas PL:");
[
  "src/pages/index.astro",
  "src/pages/cennik.astro",
  "src/pages/lokalizacja/index.astro",
  "src/pages/atrakcje/index.astro",
  "src/pages/rezerwacja.astro",
  "src/pages/opinie.astro",
  "src/pages/faq.astro",
  "src/pages/festiwal-sup.astro",
  "src/pages/regulamin.astro",
  "src/pages/polityka-prywatnosci.astro",
  "src/pages/404.astro",
  "src/pages/apartamenty/index.astro",
  "src/pages/apartamenty/[slug].astro",
  "src/pages/api/booking.ts",
  "src/pages/api/availability.ts",
].forEach((page) => check(exists(page), page));

console.log("\n🌍 Páginas EN/DE:");
[
  "src/pages/en/index.astro",
  "src/pages/en/apartments/index.astro",
  "src/pages/en/apartments/[slug].astro",
  "src/pages/en/prices.astro",
  "src/pages/en/booking.astro",
  "src/pages/en/location.astro",
  "src/pages/en/attractions.astro",
  "src/pages/en/reviews.astro",
  "src/pages/en/faq.astro",
  "src/pages/de/index.astro",
  "src/pages/de/ferienwohnungen/index.astro",
  "src/pages/de/ferienwohnungen/[slug].astro",
  "src/pages/de/preise.astro",
  "src/pages/de/reservierung.astro",
  "src/pages/de/lage.astro",
  "src/pages/de/attraktionen.astro",
  "src/pages/de/bewertungen.astro",
  "src/pages/de/faq.astro",
].forEach((page) => check(exists(page), page));

console.log("\n📍 Páginas SEO local:");
[
  "src/pages/okolica/katno.astro",
  "src/pages/okolica/olsztyn.astro",
  "src/pages/okolica/olsztynek.astro",
  "src/pages/okolica/ostroda.astro",
].forEach((page) => check(exists(page), page));

/* ------------------------------------------------------------- Componentes */
console.log("\n🧩 Componentes:");
[
  "src/layouts/BaseLayout.astro",
  "src/components/layout/Header.astro",
  "src/components/layout/Footer.astro",
  "src/components/layout/MobileCTA.astro",
  "src/components/layout/LanguageSwitcher.astro",
  "src/components/ui/Flag.astro",
  "src/components/ui/Icon.astro",
  "src/components/ui/SmartImage.astro",
  "src/components/ui/PageHero.astro",
  "src/components/ui/SectionHeading.astro",
  "src/components/content/ApartmentCard.astro",
  "src/components/content/BookingForm.astro",
  "src/components/content/ContactBlock.astro",
  "src/components/content/Gallery.astro",
  "src/components/content/FaqSection.astro",
  "src/components/content/Testimonials.astro",
  "src/components/sections/Hero.astro",
  "src/components/sections/TrustStrip.astro",
  "src/components/sections/AmenitiesShowcase.astro",
  "src/components/content/AttractionRow.astro",
  "src/components/sections/HomeContent.astro",
  "src/components/sections/ApartmentDetail.astro",
  "src/components/sections/ApartmentsIndex.astro",
  "src/components/sections/CtaBand.astro",
].forEach((comp) => check(exists(comp), comp));

/* -------------------------------------------------------------------- Data */
console.log("\n📊 Data:");
[
  "src/data/site.ts",
  "src/data/apartments.ts",
  "src/data/amenities.ts",
  "src/data/attractions.ts",
  "src/data/locales.ts",
  "src/data/faq.ts",
  "src/data/reviews.ts",
  "src/data/icons.ts",
  "src/data/image-manifest.json",
  "src/data/translations/pl.ts",
  "src/data/translations/en.ts",
  "src/data/translations/de.ts",
].forEach((f) => check(exists(f), f));

/* ------------------------------------------------------------------ Styles */
console.log("\n🎨 Styles:");
[
  "src/styles/global.css",
  "src/styles/tokens.css",
  "src/styles/base.css",
  "src/styles/typography.css",
  "src/styles/layout.css",
  "src/styles/components.css",
  "src/styles/utilities.css",
].forEach((f) => check(exists(f), f));

/* --------------------------------------------------------------- Public/SEO */
console.log("\n🌐 Public y SEO:");
[
  "public/robots.txt",
  "public/favicon.png",
  "public/og-default.jpg",
  "public/og-apartments.jpg",
  "public/og-location.jpg",
  "public/og-attractions.jpg",
  "public/og-terrace.jpg",
].forEach((f) => check(exists(f), f));

/**
 * El favicon debe ser un único archivo.
 *
 * Tener varias fuentes (svg + ico + png en otra carpeta) hacía que el
 * navegador eligiera una u otra según el caso y el resultado fuera
 * inconsistente. Se comprueba que solo exista public/favicon.png y que el
 * layout lo declare.
 */
const faviconFiles = [];
(function scanFavicons(rel) {
  const abs = join(ROOT, rel);
  let entries;
  try {
    entries = readdirSync(abs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const childRel = `${rel}/${entry.name}`;
    if (entry.isDirectory()) scanFavicons(childRel);
    else if (/favicon/i.test(entry.name)) faviconFiles.push(childRel);
  }
})("public");

check(
  faviconFiles.length === 1 && faviconFiles[0] === "public/favicon.png",
  `un único favicon y en la raíz de public (encontrados: ${faviconFiles.join(", ") || "ninguno"})`,
);

const baseLayout = read("src/layouts/BaseLayout.astro");
check(baseLayout.includes('href="/favicon.png"'), "el layout declara /favicon.png");
check(
  !/favicon\.(svg|ico)/.test(baseLayout.replace(/<!--[\s\S]*?-->/g, "")),
  "el layout no declara favicons antiguos (svg/ico)",
);

/**
 * Vídeo del hero — EL PROPIETARIO LO GESTIONA ÉL.
 *
 * `public/assets/video/hero.mp4` es un archivo que el dueño del sitio reemplaza
 * cuando exporta su propia versión a medida. **Nadie debe regenerarlo por su
 * cuenta**: hubo un tiempo en que este repositorio lo recodificaba (cortándolo a
 * 1,5 s y haciendo un bucle de ida y vuelta) y eso pisaba su trabajo.
 *
 * Por eso aquí NO se comprueba ni la duración ni el peso: cualquier valor que
 * eligiera él haría fallar la comprobación, y un test que da errores falsos sobre
 * algo que gestiona otra persona es peor que no tenerlo.
 *
 * Tampoco se avisa del audio, aunque el `<video>` no lo necesite: la etiqueta
 * lleva `muted`, así que la política de autoplay de los navegadores se cumple
 * igual y la pista no rompe nada. Avisar de eso sería meter ruido en los tests por
 * un detalle que no afecta.
 *
 * Lo único que se comprueba es lo que sí rompería la reproducción y depende del
 * código de la web, no de su export:
 *   1. Que exista la variante de móvil (la usa el <video> en pantallas pequeñas).
 *   2. Que exista el póster (se pinta mientras el vídeo carga).
 */
const VIDEO_HERO = "public/assets/video/hero.mp4";

if (exists(VIDEO_HERO)) {
  check(exists("public/assets/video/hero-movil.mp4"), "existe la variante móvil del vídeo");
  check(exists("public/assets/video/hero-poster.webp"), "existe el poster del vídeo");
}

/* -------------------------------------------------------------------- Lib */
console.log("\n🔧 Lib:");
["src/lib/i18n.ts", "src/lib/format.ts", "src/lib/seo.ts", "src/lib/availability.ts", "src/env.d.ts"].forEach(
  (f) => check(exists(f), f),
);

/* ---------------------------------------------------------------- Conteos */
console.log("\n🔢 Conteo de datos:");

const apartmentsContent = read("src/data/apartments.ts");
const aptCount = (apartmentsContent.match(/^ {4}id: "liberta-/gm) || []).length;
check(aptCount === 4, `4 apartamentos en data (encontrados: ${aptCount})`);

const amenitiesContent = read("src/data/amenities.ts");
const amCount = (amenitiesContent.match(/key: "/g) || []).length;
check(amCount >= 20, `${amCount} amenidades definidas (mín 20)`);

const attractionsContent = read("src/data/attractions.ts");
const atCount = (attractionsContent.match(/slug: "/g) || []).length;
check(atCount >= 15, `${atCount} atracciones definidas (mín 15)`);

const faqContent = read("src/data/faq.ts");
const faqCount = (faqContent.match(/question: f\.q/g) || []).length;
check(faqCount >= 10, `${faqCount} preguntas frecuentes (mín 10)`);

/* -------------------------------------------------------- Traducciones */
console.log("\n🌐 Traducciones balanceadas:");

/** Extrae las claves de primer nivel de un diccionario de traducciones. */
function topLevelKeys(content) {
  const start = content.indexOf("{", content.indexOf("const "));
  if (start === -1) return [];
  let depth = 0;
  let end = start;
  for (let i = start; i < content.length; i++) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = content.slice(start + 1, end);
  // Solo claves con sangría de 2 espacios (nivel superior del objeto)
  return [...body.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]);
}

const dicts = {
  pl: topLevelKeys(read("src/data/translations/pl.ts")),
  en: topLevelKeys(read("src/data/translations/en.ts")),
  de: topLevelKeys(read("src/data/translations/de.ts")),
};

check(dicts.pl.length >= 20, `PL define ${dicts.pl.length} secciones`);
check(
  JSON.stringify(dicts.pl) === JSON.stringify(dicts.en),
  `PL/EN top-level keys coinciden (${dicts.pl.length})`,
);
check(
  JSON.stringify(dicts.pl) === JSON.stringify(dicts.de),
  `PL/DE top-level keys coinciden (${dicts.pl.length})`,
);

if (JSON.stringify(dicts.pl) !== JSON.stringify(dicts.en)) {
  warnings.push(`PL: ${dicts.pl.join(",")}`);
  warnings.push(`EN: ${dicts.en.join(",")}`);
}
if (JSON.stringify(dicts.pl) !== JSON.stringify(dicts.de)) {
  warnings.push(`DE: ${dicts.de.join(",")}`);
}

/* --------------------------------------------------- Contaminación de idioma */
console.log("\n🚫 Contaminación de idioma en páginas EN/DE:");
const spanishInBody = /huéspedes|reseñas|verificadas|Carrusel|Opiniones de|habitación|Sobre nosotros|nuestros huéspedes/;
const polishLeaks = /Zobacz apartamenty|Sprawdź dostępność|Zadzwoń|Opinie gości|Wszystkie opinie/;

/** Quita comentarios de bloque y de línea: solo interesa el texto visible. */
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

for (const [lang, dir] of [
  ["EN", "src/pages/en"],
  ["DE", "src/pages/de"],
]) {
  const files = [];
  (function walk(d) {
    for (const entry of readdirSync(join(ROOT, d), { withFileTypes: true })) {
      const rel = `${d}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (entry.name.endsWith(".astro")) files.push(rel);
    }
  })(dir);

  const offenders = files.filter((f) => {
    const c = stripComments(read(f));
    return spanishInBody.test(c) || polishLeaks.test(c);
  });

  check(offenders.length === 0, `Sin textos en español/polaco incrustados en ${lang} (${files.length} archivos)`);
  offenders.forEach((f) => warnings.push(`posible texto sin traducir: ${f}`));
}

/* ------------------------------------------------------------------ Resumen */
console.log("\n" + "=".repeat(52));
console.log("📊 Resumen:");
console.log(`  ✓ OK:     ${oks.length}`);
console.log(`  ⚠ Warn:   ${warnings.length}`);
console.log(`  ✗ Errors: ${errors.length}`);
console.log("=".repeat(52));

if (warnings.length > 0) {
  console.log("\n⚠ Advertencias:");
  warnings.forEach((w) => console.log(`  - ${w}`));
}

if (errors.length > 0) {
  console.log("\n✗ Errores:");
  errors.forEach((e) => console.log(`  - ${e}`));
  process.exit(1);
}

console.log("\n✅ Estructura del proyecto OK");
