/**
 * install-instagram-mark.mjs — instala la marca de Instagram aportada por el
 * propietario sobre public/assets/brand/instagram-mark.svg.
 *
 * QUÉ TOCA Y QUÉ NO
 *
 * Solo la CABECERA del SVG: se quitan la declaración XML, el DOCTYPE, el
 * comentario de CorelDRAW, los metadatos y las medidas fijas en mm (que impiden
 * que el icono escale por CSS). El dibujo —trazados, círculo, elipse y colores—
 * se deja intacto.
 *
 * POR QUÉ SE AJUSTA EL viewBox
 *
 * Los tres iconos del navbar se pintan con un lado cuadrado. Si el viewBox de una
 * marca no es cuadrado, el dibujo sale un poco más ancho o más alto que los otros
 * y se nota al ponerlos en fila. El de Instagram era 25,35×24,71 (proporción
 * 1,026): un 2,6% más ancho.
 *
 * Además, un trazo SVG se dibuja centrado en el trazado, así que sobresale la
 * mitad de su grosor. Con un trazo de 0,82 y el marco a 0,41 del borde, el borde
 * del marco cae EXACTAMENTE en el límite del viewBox: cualquier redondeo del
 * navegador lo recorta. El viewBox se ensancha un poco para dar aire al trazo.
 *
 * Uso: node scripts/install-instagram-mark.mjs
 */
import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";

const ORIGEN = resolve(process.cwd(), "public/assets/brand/instagram-marknew.svg");
const DESTINO = resolve(process.cwd(), "public/assets/brand/instagram-mark.svg");
const RESPALDO = resolve(process.cwd(), "public/import-original/otros/instagram-mark-anterior.svg");

/** Aire que se deja alrededor del trazo, en unidades del viewBox. */
const MARGEN = 0.35;

async function main() {
  if (!existsSync(ORIGEN)) {
    console.error(`No se encuentra ${ORIGEN}`);
    process.exit(1);
  }

  const original = await readFile(ORIGEN, "utf8");

  const vbOriginal = /viewBox="([^"]+)"/.exec(original)?.[1].trim().split(/\s+/).map(Number);
  if (!vbOriginal) {
    console.error("El SVG no tiene viewBox");
    process.exit(1);
  }

  const grosor = Number(/stroke-width:\s*([\d.]+)/.exec(original)?.[1] ?? 0);

  /*
   * Centro del dibujo. El viewBox original es 0 0 25.35 24.71, así que el centro
   * está en la mitad de cada lado; el dibujo se centra sobre él.
   */
  const centroX = vbOriginal[0] + vbOriginal[2] / 2;
  const centroY = vbOriginal[1] + vbOriginal[3] / 2;

  // El lado mayor, más el trazo completo y el aire, da un cuadrado que contiene
  // todo el dibujo con holgura.
  const lado = Math.max(vbOriginal[2], vbOriginal[3]) + grosor + MARGEN * 2;
  const x = centroX - lado / 2;
  const y = centroY - lado / 2;

  const vbNuevo = `${redondear(x)} ${redondear(y)} ${redondear(lado)} ${redondear(lado)}`;

  let limpio = original
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<metadata[\s\S]*?\/>/g, "")
    .replace(/\s+width="[^"]*"/g, "")
    .replace(/\s+height="[^"]*"/g, "")
    .replace(/\s+xmlns:xlink="[^"]*"/g, "")
    .replace(/\s+xmlns:xodm="[^"]*"/g, "")
    .replace(/viewBox="[^"]*"/, `viewBox="${vbNuevo}"`)
    .replace(/<g>\s*<\/g>/g, "")
    .replace(/\n{3,}/g, "\n")
    .trim();

  const cabecera = `<!--
  Marca de Instagram aportada por el propietario (CorelDRAW), version 3.

  Limpieza aplicada: sin declaracion XML, sin DOCTYPE, sin comentarios, sin
  metadatos y sin width/height fijos para que escale por CSS. El dibujo
  (trazados, circulo y elipse) es el original, sin tocar.

  viewBox ajustado a CUADRADO (${vbNuevo}, antes ${vbOriginal[2]}x${vbOriginal[3]}):
  los tres iconos del navbar se pintan con un lado cuadrado, asi que un viewBox
  no cuadrado hacia que este saliera un 2,6% mas ancho que Facebook y Booking.
  Ademas el trazo (${grosor}) sobresale ${redondear(grosor / 2)} a cada lado del
  trazado y su borde caia justo en el limite del viewBox: se ensancho para darle
  aire y que no se recorte al redondear el navegador.

  El dibujo es blanco (#FEFEFE). Sobre fondos claros se invierte con un filtro
  CSS desde SocialLinks, asi que no hace falta una segunda version.
-->
`;

  await mkdir(resolve(RESPALDO, ".."), { recursive: true });
  if (existsSync(DESTINO)) {
    await copyFile(DESTINO, RESPALDO);
    console.log("  marca anterior respaldada en public/import-original/otros/");
  }

  await writeFile(DESTINO, `${cabecera}${limpio}\n`, "utf8");

  console.log(`  viewBox: ${vbOriginal[2]}×${vbOriginal[3]} (${(vbOriginal[2] / vbOriginal[3]).toFixed(3)}) → ${vbNuevo} (1.000)`);
  console.log(`  trazo: ${grosor} → sobresale ${redondear(grosor / 2)} a cada lado`);
  console.log(`  instalado en public/assets/brand/instagram-mark.svg`);
}

const redondear = (n) => Math.round(n * 1000) / 1000;

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
