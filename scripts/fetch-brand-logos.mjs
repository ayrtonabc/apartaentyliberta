/**
 * fetch-brand-logos.mjs
 * ----------------------------------------------------------------------------
 * Descarga los logotipos de marca que se muestran junto a las valoraciones
 * (Google y Booking.com) y los guarda optimizados en public/assets/brand/.
 *
 * Por qué descargarlos y no dibujarlos: son marcas registradas con trazados
 * concretos. Reproducirlos "a ojo" da un resultado parecido pero incorrecto, y
 * en una web de cliente eso se nota. Se toman de Wikimedia Commons, que aloja
 * las versiones vectoriales oficiales.
 *
 * El script limpia metadatos de Inkscape y redondea los trazados para reducir
 * el peso, y quita el `width`/`height` fijos para que escalen por CSS.
 *
 * Uso: node scripts/fetch-brand-logos.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const OUT_DIR = resolve(process.cwd(), "public", "assets", "brand");

const SOURCES = [
  {
    name: "google-g.svg",
    url: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg",
    /** Conserva viewBox y los cuatro colores corporativos; nada más. */
    note: 'Google "G" mark (4 colores oficiales)',
  },
  {
    name: "booking.svg",
    url: "https://upload.wikimedia.org/wikipedia/commons/b/be/Booking.com_logo.svg",
    note: "Booking.com wordmark (azul corporativo)",
  },
];

/** Reduce el SVG al mínimo: sin metadatos, sin comentarios, sin atributos fijos. */
function tidySvg(raw) {
  let svg = raw;

  // Fuera el preámbulo XML y los comentarios
  svg = svg.replace(/<\?xml[\s\S]*?\?>/g, "");
  svg = svg.replace(/<!--[\s\S]*?-->/g, "");
  // Fuera metadatos de editor
  svg = svg.replace(/<metadata[\s\S]*?<\/metadata>/g, "");
  svg = svg.replace(/<sodipodi:namedview[\s\S]*?\/>/g, "");
  svg = svg.replace(/<defs[\s\S]*?<\/defs>/g, (block) =>
    // Los defs solo se conservan si contienen un clipPath realmente usado
    /clipPath/.test(block) ? block : "",
  );

  // El SVG debe escalar por CSS: fuera width/height del elemento raíz
  svg = svg.replace(/(<svg\b[^>]*?)\s+width="[^"]*"/i, "$1");
  svg = svg.replace(/(<svg\b[^>]*?)\s+height="[^"]*"/i, "$1");

  // Colapsa espacios y saltos de línea sobrantes
  svg = svg.replace(/>\s+</g, "><").replace(/\s{2,}/g, " ").trim();

  return svg;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  for (const source of SOURCES) {
    const response = await fetch(source.url);
    if (!response.ok) {
      console.error(`✗ ${source.name}: HTTP ${response.status}`);
      process.exitCode = 1;
      continue;
    }

    const raw = await response.text();
    const svg = tidySvg(raw);
    const target = join(OUT_DIR, source.name);
    await writeFile(target, svg, "utf8");

    const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? "(sin viewBox)";
    console.log(
      `✓ ${source.name.padEnd(16)} ${String(svg.length).padStart(6)} B  viewBox=${viewBox}  · ${source.note}`,
    );
  }

  console.log("\nMarcas registradas de sus titulares. Uso meramente identificativo del canal.");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
