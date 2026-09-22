/**
 * audit-attraction-images.mjs — cruza los slugs del dato con las imágenes que
 * hay realmente y con las entradas del manifiesto.
 *
 * Sirve para saber cuántas filas debería tener la página y cuáles se quedan sin
 * foto. No abre navegador.
 */
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";

const RAIZ = process.cwd();
const DATO = resolve(RAIZ, "src/data/attractions.ts");
const DIR_IMG = resolve(RAIZ, "public/assets/attractions");

const fuente = await readFile(DATO, "utf8");

/** Todos los slug del tipo, en orden de aparición. */
const slugs = [...fuente.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]);
/** Los que además declaran `image:` */
const conCampoImagen = [...fuente.matchAll(/slug:\s*"([^"]+)"[\s\S]*?image:\s*"([^"]+)"/g)].map((m) => m[1]);

const archivos = (await readdir(DIR_IMG)).filter((f) => f.endsWith(".webp")).map((f) => f.replace(".webp", ""));

const manifiesto = JSON.parse(await readFile(resolve(RAIZ, "src/data/image-manifest.json"), "utf8"));
const enManifiesto = Object.keys(manifiesto)
  .filter((k) => k.startsWith("assets/attractions/"))
  .map((k) => k.replace("assets/attractions/", "").replace(".webp", ""));

console.log(`slugs en src/data/attractions.ts : ${slugs.length}`);
console.log(`  de esos, declaran image:        : ${conCampoImagen.length}`);
console.log(`archivos .webp en assets/attractions: ${archivos.length}`);
console.log(`entradas en el manifiesto         : ${enManifiesto.length}`);

console.log("\n--- slug por slug ---");
let filasPosibles = 0;
for (const s of slugs) {
  const tieneArchivo = archivos.includes(s);
  const declara = conCampoImagen.includes(s);
  const manifesto = enManifiesto.includes(s);
  const usara = declara && tieneArchivo && manifesto;
  if (usara) filasPosibles++;
  console.log(
    `  ${(usara ? "✓" : "·").padEnd(2)} ${s.padEnd(30)}` +
      ` campo=${declara ? "sí" : "NO"}  archivo=${tieneArchivo ? "sí" : "NO"}  manifiesto=${manifesto ? "sí" : "NO"}`,
  );
}

console.log(`\nfilas con imagen que puede pintar la página: ${filasPosibles}`);
console.log(
  `+ servicios del complejo (5) = ${filasPosibles + 5} filas esperadas en /atrakcje/`,
);

const huerfanos = archivos.filter((a) => !slugs.includes(a));
if (huerfanos.length) console.log(`\narchivos sin slug que los use: ${huerfanos.join(", ")}`);
