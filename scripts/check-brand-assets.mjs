/**
 * check-brand-assets.mjs — comprueba los logos de marca tal como se sirven.
 *
 * AISLAMIENTO: no abre ningún navegador. Solo consulta el HTML servido.
 *
 * Uso: node scripts/check-brand-assets.mjs [puerto]
 */
const PORT = process.argv[2] ?? "8080";
const BASE = `http://localhost:${PORT}`;

const pages = [
  { label: "home", path: "/" },
  { label: "opinie", path: "/opinie/" },
];

async function main() {
  for (const page of pages) {
    const html = await (await fetch(`${BASE}${page.path}`)).text();

    console.log(`\n=== ${page.label} ===`);

    // Logos de marca (RatingSource)
    const logos = [...html.matchAll(/<img[^>]*assets\/brand\/[^>]*>/g)].map((m) =>
      m[0].replace(/\s+/g, " "),
    );
    if (logos.length === 0) console.log("  (sin logos de marca)");
    logos.forEach((l) => console.log("  " + l));

    // Iconos sociales del navbar y del pie: se identifican por su href
    for (const net of ["facebook", "instagram", "booking"]) {
      const re = new RegExp(`<a[^>]*href=([^ >]*${net}[^ >]*)[^>]*>(.*?)</a>`, "gs");
      const hit = re.exec(html);
      if (!hit) {
        console.log(`  ${net.padEnd(10)} — no encontrado`);
        continue;
      }
      const inner = hit[2];
      const tieneSvg = /<svg/.test(inner);
      const tieneImg = /<img/.test(inner);
      // Extrae fill/stroke del svg para ver si es sólido o de contorno
      const svg = /<svg([^>]*)>/.exec(inner);
      const attrs = svg ? svg[1].replace(/\s+/g, " ").trim() : "";
      console.log(
        `  ${net.padEnd(10)} svg=${tieneSvg} img=${tieneImg}` + (attrs ? `  ${attrs}` : ""),
      );
    }
  }
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exitCode = 1;
});
