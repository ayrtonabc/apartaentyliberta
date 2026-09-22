/**
 * Instalaciones del complejo — contenido de la página /apartamenty/.
 *
 * POR QUÉ ESTE ARCHIVO EXISTE
 *
 * Los cuatro apartamentos son idénticos en metraje, distribución y
 * equipamiento: lo único que cambia es la vista desde el taras. Eso significa
 * que la página de apartamentos no puede diferenciarse contando cada unidad
 * cuatro veces. Lo que sí diferencia la estancia es el complejo: la balia, la
 * sauna, el taras cubierto, el fuego junto al lago.
 *
 * De ahí que este bloque describa lo COMPARTIDO, con las fotos de detalle que
 * aportó el propietario.
 *
 * Las descripciones están escritas a partir de lo que se ve en cada fotografía,
 * no del nombre del archivo. Si se cambia una imagen, hay que revisar su texto:
 * describir algo que no aparece en la foto es la forma más rápida de que el
 * visitante desconfíe.
 *
 * Las imágenes viven en public/assets/facilities/ y se generan con:
 *   node scripts/import-facility-images.mjs
 */

export type Facility = {
  /** Nombre del archivo en public/assets/facilities/, sin extensión */
  slug: string;
  name: { pl: string; en: string; de: string };
  description: { pl: string; en: string; de: string };
  /** Texto alternativo de la imagen */
  alt: { pl: string; en: string; de: string };
  /**
   * Peso visual en la rejilla. `feature` ocupa el doble de ancho en pantallas
   * grandes: se reserva para lo que de verdad diferencia la estancia, para que
   * la rejilla no se lea como una lista plana de doce cosas iguales.
   */
  size?: "feature";
};

export const facilities: Facility[] = [
  {
    slug: "apartament-z-zewnatrz",
    size: "feature",
    name: {
      pl: "Cztery apartamenty w jednym budynku",
      en: "Four apartments in one building",
      de: "Vier Ferienwohnungen in einem Gebäude",
    },
    description: {
      pl: "Każdy apartament ma własne wejście z tarasu, więc nie mijacie się w korytarzu ani nie dzielicie niczyjej ściany. Wieczorem cały kompleks jest podświetlony, a między tarasami rosną trawy i młode drzewka.",
      en: "Each apartment has its own entrance from the terrace, so you never share a corridor or a wall. In the evening the whole complex is lit up, with ornamental grasses and young trees between the terraces.",
      de: "Jede Wohnung hat einen eigenen Zugang von der Terrasse — kein gemeinsamer Flur, keine geteilte Wand. Abends ist die ganze Anlage beleuchtet, zwischen den Terrassen wachsen Ziergräser und junge Bäume.",
    },
    alt: {
      pl: "Apartamenty Liberta o zmierzchu, z podświetlonymi tarasami",
      en: "Apartamenty Liberta at dusk with lit terraces",
      de: "Apartamenty Liberta in der Dämmerung mit beleuchteten Terrassen",
    },
  },
  {
    slug: "salon-z-kominkiem",
    name: {
      pl: "Salon z kominkiem",
      en: "Living room with a fireplace",
      de: "Wohnzimmer mit Kamin",
    },
    description: {
      pl: "Część dzienna z kominkiem na drewno, kanapą i widokiem na jezioro przez przeszklenie. Drewno czeka przygotowane przy kominku.",
      en: "The living area has a wood-burning fireplace, a sofa and a lake view through the glazing. Firewood is left ready by the fireplace.",
      de: "Der Wohnbereich hat einen Holzofen, ein Sofa und Seeblick durch die Verglasung. Brennholz liegt am Kamin bereit.",
    },
    alt: {
      pl: "Salon apartamentu z kominkiem na drewno i widokiem na jezioro",
      en: "Apartment living room with a wood-burning fireplace and lake view",
      de: "Wohnzimmer der Ferienwohnung mit Holzofen und Seeblick",
    },
  },
  {
    slug: "kuchnia",
    name: { pl: "Kuchnia", en: "Kitchen", de: "Küche" },
    description: {
      pl: "W pełni wyposażona: płyta, piekarnik, zmywarka, lodówka i ekspres. Wyspa z drewnianym blatem i stół dla sześciu osób.",
      en: "Fully equipped: hob, oven, dishwasher, fridge and coffee machine. An island with a wooden worktop and a table for six.",
      de: "Voll ausgestattet: Herd, Backofen, Geschirrspüler, Kühlschrank und Kaffeemaschine. Eine Kochinsel mit Holzplatte und ein Tisch für sechs.",
    },
    alt: {
      pl: "Kuchnia z wyspą i drewnianym blatem",
      en: "Kitchen with an island and wooden worktop",
      de: "Küche mit Kochinsel und Holzplatte",
    },
  },
  {
    slug: "jadalnia",
    name: { pl: "Jadalnia", en: "Dining area", de: "Essbereich" },
    description: {
      pl: "Otwarta na salon i kuchnię, z dużym stołem i sofą w kącie. Światło wpada tu przez cały dzień.",
      en: "Open to the living room and kitchen, with a large table and a sofa in the corner. Light comes in all day.",
      de: "Offen zum Wohnzimmer und zur Küche, mit großem Tisch und einer Sofaecke. Hier fällt den ganzen Tag Licht ein.",
    },
    alt: {
      pl: "Jadalnia otwarta na salon, z dużym stołem dla sześciu osób",
      en: "Dining area open to the living room, with a large table for six",
      de: "Essbereich, offen zum Wohnzimmer, mit großem Tisch für sechs",
    },
  },
  {
    slug: "sypialnia",
    name: {
      pl: "Sypialnia z muralem",
      en: "Bedroom with a mural",
      de: "Schlafzimmer mit Wandbild",
    },
    description: {
      pl: "Łóżko małżeńskie, drewniany sufit i mural z jeziorem na ścianie. Rolety zaciemniające na oknach.",
      en: "A double bed, a wooden ceiling and a lake mural on the wall. Blackout blinds on the windows.",
      de: "Doppelbett, Holzdecke und ein Seemotiv an der Wand. Verdunkelungsrollos an den Fenstern.",
    },
    alt: {
      pl: "Sypialnia z łóżkiem małżeńskim i muralem z jeziorem",
      en: "Bedroom with a double bed and a lake mural",
      de: "Schlafzimmer mit Doppelbett und Seemotiv",
    },
  },
  {
    slug: "sypialnia-dwuosobowa",
    name: {
      pl: "Druga sypialnia",
      en: "Second bedroom",
      de: "Zweites Schlafzimmer",
    },
    description: {
      pl: "Dwa osobne łóżka, które można zestawić. W obu sypialniach jest skos dachu i drewniane belki.",
      en: "Two single beds that can be pushed together. Both bedrooms have a sloped wooden ceiling.",
      de: "Zwei Einzelbetten, die sich zusammenstellen lassen. Beide Schlafzimmer haben eine Holzschräge.",
    },
    alt: {
      pl: "Druga sypialnia z dwoma osobnymi łóżkami pod skosem",
      en: "Second bedroom with two single beds under a sloped ceiling",
      de: "Zweites Schlafzimmer mit zwei Einzelbetten unter der Dachschräge",
    },
  },
  {
    slug: "lazienka",
    name: { pl: "Łazienka", en: "Bathroom", de: "Badezimmer" },
    description: {
      pl: "Prysznic typu walk-in bez brodzika, podwieszany sedes, umywalka nablatowa i podgrzewany ręcznik. W każdym apartamencie są dwie łazienki.",
      en: "A walk-in shower without a tray, a wall-hung toilet, a countertop basin and a heated towel rail. Every apartment has two bathrooms.",
      de: "Bodengleiche Walk-in-Dusche, wandhängendes WC, Aufsatzwaschbecken und Handtuchheizkörper. Jede Wohnung hat zwei Badezimmer.",
    },
    alt: {
      pl: "Łazienka z prysznicem walk-in i podwieszanym sedesem",
      en: "Bathroom with a walk-in shower and a wall-hung toilet",
      de: "Badezimmer mit Walk-in-Dusche und wandhängendem WC",
    },
  },
  {
    slug: "taras",
    size: "feature",
    name: {
      pl: "Zadaszony taras z widokiem",
      en: "Covered terrace with a view",
      de: "Überdachte Terrasse mit Aussicht",
    },
    description: {
      pl: "Drewniane zadaszenie, szklana balustrada i meble wypoczynkowe zwrócone w stronę jeziora. Deszcz nie przeszkadza, a wieczorem taras jest oświetlony.",
      en: "A wooden roof, a glass balustrade and lounge furniture facing the lake. Rain does not get in the way, and the terrace is lit in the evening.",
      de: "Holzüberdachung, Glasgeländer und Sitzmöbel mit Blick auf den See. Regen stört nicht, abends ist die Terrasse beleuchtet.",
    },
    alt: {
      pl: "Zadaszony taras z meblami i widokiem na jezioro",
      en: "Covered terrace with furniture and a lake view",
      de: "Überdachte Terrasse mit Möbeln und Seeblick",
    },
  },
  {
    slug: "balia",
    size: "feature",
    name: {
      pl: "Prywatna balia góralska",
      en: "Private wooden hot tub",
      de: "Privater Holz-Hot-Tub",
    },
    description: {
      pl: "Bania z drewna opalana drewnem, ustawiona tak, żeby patrzeć na jezioro. Ogrzewa się na Wasze przybycie — wystarczy powiedzieć, o której chcecie wejść.",
      en: "A wood-fired wooden hot tub positioned to look out over the lake. It is heated for your arrival — just tell us when you want to get in.",
      de: "Ein holzbefeuerter Hot Tub aus Holz, ausgerichtet auf den See. Er wird zu Ihrer Ankunft geheizt — sagen Sie uns einfach, wann Sie hineinmöchten.",
    },
    alt: {
      pl: "Balia góralska z hydromasażem o zachodzie słońca nad jeziorem",
      en: "Wooden hot tub with hydromassage at sunset over the lake",
      de: "Holz-Hot-Tub mit Hydromassage bei Sonnenuntergang am See",
    },
  },
  {
    slug: "sauna",
    name: { pl: "Sauna", en: "Sauna", de: "Sauna" },
    description: {
      pl: "Sauna w formie beczki z panoramiczną szybą skierowaną na wodę. Mieści cztery osoby. Dostępna na życzenie.",
      en: "A barrel sauna with a panoramic window facing the water. It seats four. Available on request.",
      de: "Eine Fasssauna mit Panoramafenster zum Wasser. Platz für vier Personen. Auf Anfrage.",
    },
    alt: {
      pl: "Sauna w formie beczki z panoramicznym widokiem na jezioro",
      en: "Barrel sauna with a panoramic view of the lake",
      de: "Fasssauna mit Panoramablick auf den See",
    },
  },
  {
    slug: "miejsce-na-ognisko",
    name: {
      pl: "Ognisko nad jeziorem",
      en: "Fire pit by the lake",
      de: "Feuerstelle am See",
    },
    description: {
      pl: "Palenisko kilka kroków od brzegu, z widokiem na zachód słońca. Drewno i kije na kiełbaski zapewniamy my.",
      en: "A fire pit a few steps from the shore, facing the sunset. We provide the wood and the sticks for sausages.",
      de: "Eine Feuerstelle wenige Schritte vom Ufer, mit Blick auf den Sonnenuntergang. Holz und Stecken für Würstchen stellen wir.",
    },
    alt: {
      pl: "Ognisko nad brzegiem jeziora o zachodzie słońca",
      en: "Fire pit on the lake shore at sunset",
      de: "Feuerstelle am Seeufer bei Sonnenuntergang",
    },
  },
  {
    slug: "plac-zabaw",
    name: { pl: "Plac zabaw", en: "Playground", de: "Spielplatz" },
    description: {
      pl: "Drewniany plac zabaw z wieżą, zjeżdżalnią i huśtawkami, na trawie między apartamentami a plażą. Widoczny z tarasu, więc dzieci są na oku.",
      en: "A wooden playground with a tower, a slide and swings, on the grass between the apartments and the beach. Visible from the terrace, so children stay in sight.",
      de: "Ein Holzspielplatz mit Turm, Rutsche und Schaukeln, auf der Wiese zwischen den Wohnungen und dem Strand. Von der Terrasse aus einsehbar.",
    },
    alt: {
      pl: "Drewniany plac zabaw na trawie przy jeziorze",
      en: "Wooden playground on the grass by the lake",
      de: "Holzspielplatz auf der Wiese am See",
    },
  },
];
