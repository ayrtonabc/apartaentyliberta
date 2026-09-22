/**
 * list-apartment-highlights.mjs — imprime los highlights de cada apartamento.
 *
 * Sirve para comprobar si las tarjetas pueden decir algo distinto entre sí o si
 * todas repiten lo mismo. No abre navegador.
 */
import { apartments } from "../src/data/apartments.ts";

for (const a of apartments) {
  console.log(`\n${a.id}  (${a.names.pl})`);
  for (const [i, h] of a.highlights.pl.entries()) {
    console.log(`  ${i + 1}. ${h}`);
  }
}

// Cuántos highlights son idénticos entre apartamentos
const porTexto = new Map();
for (const a of apartments) {
  for (const h of a.highlights.pl) {
    porTexto.set(h, (porTexto.get(h) ?? 0) + 1);
  }
}

console.log("\n--- repetidos entre apartamentos ---");
let repetidos = 0;
for (const [texto, veces] of porTexto) {
  if (veces > 1) {
    repetidos++;
    console.log(`  ${veces}×  ${texto}`);
  }
}
console.log(`\n  highlights distintos en total: ${porTexto.size}`);
console.log(`  textos repetidos en más de un apartamento: ${repetidos}`);
