/**
 * build-complex-photos.mjs — escribe el array `complexPhotos` del mosaico de la
 * portada con las 15 fotos en el orden que exige la retícula.
 *
 * El ORDEN decide el tamaño de cada foto: PhotoGallery coloca cada hueco con
 * `grid-area` por POSICIÓN (ver el comentario de la retícula en PhotoGallery.astro).
 * Las posiciones 2, 3 y 6 son los tres huecos verticales; la 4, la 8 y la 13 son
 * las bandas apaisadas.
 *
 * Uso: node scripts/build-complex-photos.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ARCHIVO = resolve(process.cwd(), "src/components/sections/HomeContent.astro");

/**
 * Las 15 fotos EN EL ORDEN DE LA RETÍCULA.
 *
 * `hueco` es solo documentación; el tamaño real lo pone el CSS por posición.
 */
const FOTOS = [
  {
    n: 1, archivo: "apartament-z-zewnatrz", variante: 1100, hueco: "big 6x2",
    alt: {
      pl: "Kompleks Apartamentów Liberta z zewnątrz, oświetlone tarasy wieczorem",
      de: "Die Anlage Apartamenty Liberta von außen, beleuchtete Terrassen am Abend",
      en: "The Apartamenty Liberta complex from outside, terraces lit in the evening",
    },
  },
  {
    n: 2, archivo: "sauna", variante: 1086, hueco: "tall 3x2 - vertical 0,75",
    alt: {
      pl: "Sauna w formie beczki z widokiem na jezioro",
      de: "Fasssauna mit Blick auf den See",
      en: "Barrel sauna with a view of the lake",
    },
  },
  {
    n: 3, archivo: "kuchnia", variante: 1086, hueco: "tall 3x2 - vertical 0,75",
    alt: {
      pl: "Kuchnia z wyspą, drewnianym blatem i stołem",
      de: "Küche mit Kochinsel, Holzplatte und Tisch",
      en: "Kitchen with an island, wooden worktop and table",
    },
  },
  {
    n: 4, archivo: "lake", variante: 1400, hueco: "wide 6x1 - la más apaisada (1,80)",
    alt: {
      pl: "Paddleboardy na Jeziorze Szeląg Wielki o zachodzie słońca",
      de: "Stand-Up-Paddler auf dem Szeląg-See bei Sonnenuntergang",
      en: "Paddleboarders on Lake Szeląg Wielki at sunset",
    },
  },
  {
    n: 5, archivo: "salon-z-kominkiem", variante: 1100, hueco: "base 3x1",
    alt: {
      pl: "Salon z kominkiem na drewno i kanapą",
      de: "Wohnzimmer mit Holzofen und Sofa",
      en: "Living room with a wood-burning fireplace and sofa",
    },
  },
  {
    n: 6, archivo: "play", variante: 1400, hueco: "tall 3x2 - vertical 0,75",
    alt: {
      pl: "Siatkówka plażowa na piasku o zachodzie słońca",
      de: "Beachvolleyball im Sand bei Sonnenuntergang",
      en: "Beach volleyball on the sand at sunset",
    },
  },
  {
    n: 7, archivo: "balia", variante: 1080, hueco: "base 3x1",
    alt: {
      pl: "Balia góralska z hydromasażem o zachodzie słońca",
      de: "Holz-Hot-Tub mit Hydromassage bei Sonnenuntergang",
      en: "Wooden hot tub with hydromassage at sunset",
    },
  },
  {
    n: 8, archivo: "miejsce-na-ognisko", variante: 1100, hueco: "wide 6x1",
    alt: {
      pl: "Zadaszony taras z meblami i widokiem na jezioro",
      de: "Überdachte Terrasse mit Möbeln und Seeblick",
      en: "Covered terrace with furniture and a lake view",
    },
  },
  {
    n: 9, archivo: "lazienka", variante: 1100, hueco: "base 3x1",
    alt: {
      pl: "Łazienka z prysznicem walk-in i podwieszanym sedesem",
      de: "Badezimmer mit Walk-in-Dusche und wandhängendem WC",
      en: "Bathroom with a walk-in shower and a wall-hung toilet",
    },
  },
  {
    n: 10, archivo: "sypialnia", variante: 1086, hueco: "base 3x1",
    alt: {
      pl: "Sypialnia z łóżkiem małżeńskim i drewnianym sufitem",
      de: "Schlafzimmer mit Doppelbett und Holzdecke",
      en: "Bedroom with a double bed and wooden ceiling",
    },
  },
  {
    n: 11, archivo: "jadalnia", variante: 1100, hueco: "base 3x1",
    alt: {
      pl: "Jadalnia otwarta na salon, z dużym stołem",
      de: "Essbereich, offen zum Wohnzimmer, mit großem Tisch",
      en: "Dining area open to the living room, with a large table",
    },
  },
  {
    n: 12, archivo: "plac-zabaw", variante: 1080, hueco: "base 3x1",
    alt: {
      pl: "Drewniany plac zabaw na trawie przy jeziorze",
      de: "Holzspielplatz auf der Wiese am See",
      en: "Wooden playground on the grass by the lake",
    },
  },
  {
    n: 13, archivo: "taras", variante: 1100, hueco: "base 3x1",
    alt: {
      pl: "Ognisko nad brzegiem jeziora o zachodzie słońca",
      de: "Feuerstelle am Seeufer bei Sonnenuntergang",
      en: "Fire pit on the lake shore at sunset",
    },
  },
  {
    n: 14, archivo: "sypialnia-dwuosobowa", variante: 1100, hueco: "base 3x1",
    alt: {
      pl: "Druga sypialnia z dwoma osobnymi łóżkami",
      de: "Zweites Schlafzimmer mit zwei Einzelbetten",
      en: "Second bedroom with two single beds",
    },
  },
  {
    n: 15, archivo: "plan-osrodka", variante: 1400, hueco: "base 3x1",
    alt: {
      pl: "Plan kompleksu z lotu ptaka z oznaczonymi strefami",
      de: "Lageplan der Anlage aus der Luft mit markierten Bereichen",
      en: "Aerial site plan of the complex with marked areas",
    },
  },
];

const bloque = FOTOS.map((f) =>
  [
    `  // ${f.n}. ${f.hueco}`,
    "  {",
    `    src: \`\${facilities}/${f.archivo}.webp\`,`,
    `    full: "/assets/responsive/assets/facilities/${f.archivo}-${f.variante}.webp",`,
    "    alt:",
    '      locale === "pl"',
    `        ? ${JSON.stringify(f.alt.pl)}`,
    '        : locale === "de"',
    `          ? ${JSON.stringify(f.alt.de)}`,
    `          : ${JSON.stringify(f.alt.en)},`,
    "  },",
  ].join("\n"),
).join("\n");

const NUEVO = `const complexPhotos = [
  /*
   * LAS 15 FOTOS DEL MOSAICO, EN EL ORDEN DE LA RETÍCULA.
   *
   * El ORDEN MANDA: PhotoGallery le asigna a cada hueco un grid-area por POSICIÓN,
   * así que mover una foto de sitio cambia su tamaño. Las posiciones 2, 3 y 6 son
   * los huecos verticales; la 4, la 8 y la 13 son las bandas apaisadas.
   *
   * Ese reparto NO es estético: depende de la proporción de cada archivo, medida en
   * scripts/ratio-facilities.mjs. Las tres verticales del set (0,75) van a los
   * huecos de 0,65; en una celda base (1,33) perderían la mitad de la imagen por
   * los lados. Las apaisadas van a las bandas de 2,72.
   *
   * Y la composición tampoco se eligió a ojo: se buscó con
   * scripts/solve-mosaic.mjs, que prueba por backtracking qué combinaciones de
   * piezas (big 6x2, tall 3x2, wide 6x1, base 3x1) caben en una retícula de 12x6
   * sin dejar huecos. Con 14 fotos ninguna combinación con tres verticales se puede
   * colocar; con 15 sí, y esa es la que está.
   *
   * Los cuatro intentos anteriores, hechos a ojo, dejaron huecos. El mapa de
   * ocupación se comprueba con scripts/verify-mosaic-grid.mjs.
   */
${bloque}
];`;

const contenido = await readFile(ARCHIVO, "utf8");
const inicio = contenido.indexOf("const complexPhotos = [");
const fin = contenido.indexOf("\n];", inicio);

if (inicio < 0 || fin < 0) {
  console.error("No se encontró el array complexPhotos");
  process.exit(1);
}

await writeFile(ARCHIVO, contenido.slice(0, inicio) + NUEVO + contenido.slice(fin + 3), "utf8");

console.log(`  fotos: ${FOTOS.length}`);
console.log(`  repetidas: ${FOTOS.length - new Set(FOTOS.map((f) => f.archivo)).size}`);
console.log(`  verticales en 2, 3 y 6: ${[2, 3, 6].map((n) => FOTOS[n - 1].archivo).join(", ")}`);
console.log(`  bandas en 4, 8 y 13: ${[4, 8, 13].map((n) => FOTOS[n - 1].archivo).join(", ")}`);
