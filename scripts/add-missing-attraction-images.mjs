/**
 * add-missing-attraction-images.mjs — enlaza en el dato las fotos que ya están
 * en public/assets/attractions/ pero que no tenían campo `image`.
 *
 * POR QUÉ HACE FALTA
 *
 * El campo `image` se añadió en su día solo a seis atracciones. Las fotos
 * nuevas del propietario se convirtieron y se dejaron en su carpeta con el
 * nombre del slug, pero el dato no las declaraba, así que la página no las veía:
 * quince imágenes en disco y solo cinco filas pintadas. Es el tipo de fallo que
 * no da error, simplemente no muestra nada.
 *
 * El texto alternativo describe lo que se ve en cada foto, no el nombre del
 * archivo.
 *
 * Uso: node scripts/add-missing-attraction-images.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";

const RAIZ = process.cwd();
const DATO = resolve(RAIZ, "src/data/attractions.ts");
const DIR_IMG = resolve(RAIZ, "public/assets/attractions");

/** slug → texto alternativo por idioma (descrito mirando la foto). */
const ALT = {
  "rezerwat-sosny-taborskiej": {
    pl: "Stare sosny w rezerwacie Sosny Taborskiej",
    en: "Old pines in the Sosny Taborskie reserve",
    de: "Alte Kiefern im Naturschutzgebiet Sosny Taborskie",
  },
  "jazda-konna": {
    pl: "Jeździec na koniu w trakcie przejażdżki",
    en: "A rider on horseback during a ride",
    de: "Ein Reiter zu Pferd während eines Ausritts",
  },
  strzelnica: {
    pl: "Strzelnica sportowa — stanowiska i tarcze",
    en: "Sports shooting range — lanes and targets",
    de: "Sportschießstand — Bahnen und Ziele",
  },
  "narty-wodne": {
    pl: "Narciarz wodny na wyciągu w Ostródzie",
    en: "Water skier on the cable lift in Ostróda",
    de: "Wasserskifahrer am Lift in Ostróda",
  },
  golf: {
    pl: "Zielone pole golfowe w okolicy Kątna",
    en: "A green golf course near Kątn",
    de: "Ein grüner Golfplatz bei Kątn",
  },
  "pola-grunwaldzkie": {
    pl: "Pomnik i pola bitwy pod Grunwaldem",
    en: "The monument and battlefield at Grunwald",
    de: "Denkmal und Schlachtfeld bei Grunwald",
  },
  "pajda-mazur": {
    pl: "Restauracja Pajda Mazur z tarasem na zewnątrz",
    en: "Restauracja Pajda Mazur with its outdoor terrace",
    de: "Restauracja Pajda Mazur mit Außenterrasse",
  },
  sielanka: {
    pl: "Restauracja Sielanka nad jeziorem",
    en: "Restauracja Sielanka by the lake",
    de: "Restauracja Sielanka am See",
  },
  "festiwal-sup": {
    pl: "Uczestnicy Festiwalu SUP na jeziorze w Kątnie",
    en: "Participants at the SUP Festival on the lake in Kątn",
    de: "Teilnehmer des SUP-Festivals auf dem See in Kątn",
  },
};

let fuente = await readFile(DATO, "utf8");
let añadidas = 0;

for (const [slug, alt] of Object.entries(ALT)) {
  const archivo = join(DIR_IMG, `${slug}.webp`);
  if (!existsSync(archivo)) {
    console.log(`  ${slug}: no hay archivo, se omite`);
    continue;
  }

  const i = fuente.indexOf(`slug: "${slug}"`);
  if (i < 0) {
    console.log(`  ${slug}: no está en el dato`);
    continue;
  }

  // El objeto de la atracción termina en la siguiente línea "  },"
  const fin = fuente.indexOf("\n  },", i);
  if (fin < 0) {
    console.log(`  ${slug}: no se encontró el cierre`);
    continue;
  }

  // ¿Ya tiene image?
  if (fuente.slice(i, fin).includes("image:")) {
    console.log(`  ${slug}: ya tenía image, se omite`);
    continue;
  }

  const bloque =
    `\n    image: "/assets/attractions/${slug}.webp",` +
    `\n    imageAlt: {` +
    `\n      pl: "${alt.pl}",` +
    `\n      en: "${alt.en}",` +
    `\n      de: "${alt.de}",` +
    `\n    },`;

  fuente = fuente.slice(0, fin) + bloque + fuente.slice(fin);
  añadidas++;
  console.log(`  + image en ${slug}`);
}

await writeFile(DATO, fuente, "utf8");
console.log(`\n${añadidas} atracciones enlazadas con su foto`);
