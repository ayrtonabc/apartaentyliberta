/**
 * Apartment data — 4 unidades.
 * En el sitio actual las 4 unidades son visualmente idénticas;
 * aquí estructuramos los datos para que el nuevo sitio pueda
 * presentar cada unidad con su propio contenido (cuando el cliente
 * confirme si hay diferencias reales).
 */

export type Apartment = {
  id: "liberta-i" | "liberta-ii" | "liberta-iii" | "liberta-iv";
  number: 1 | 2 | 3 | 4;
  names: {
    pl: string;
    en: string;
    de: string;
  };
  slugs: {
    pl: string;
    en: string;
    de: string;
  };
  highlights: {
    pl: string[];
    en: string[];
    de: string[];
  };
  description: {
    pl: string;
    en: string;
    de: string;
  };
  specs: {
    sizeM2: number;
    sleeps: number;
    extraSleeps: number;
    bedrooms: number;
    bathrooms: number;
    distanceToLakeM: number;
  };
  amenitiesKeys: string[];
  layout: {
    pl: string[];
    en: string[];
    de: string[];
  };
  pricing: {
    highSeasonPLN: number;
    lowSeasonPLN: number;
  };
  /**
   * Set curado de fotos por apartamento. Como el sitio WP actual
   * tiene el mismo set de 18 fotos para las 4 unidades, rotamos
   * el orden y elegimos distintos protagonistas para que cada
   * apartamento tenga su propia "personalidad" visual.
   * Cuando el cliente entregue fotos únicas por apartamento,
   * solo se actualiza este campo.
   */
  photos: {
    hero: string;
    layout: string;
    gallery: string[];
  };
};

export const apartments: Apartment[] = [
  {
    id: "liberta-i",
    number: 1,
    photos: {
      hero: "exterior-dzien.jpg",
      layout: "salon-parter.jpg",
      gallery: [
        "sypialnia-parter.jpg",
        "sypialnia-pietro-1.jpg",
        "kuchnia.jpg",
        "lazienka.jpg",
        "bania-goralska.jpg",
        "taras.jpg",
      ],
    },
    names: {
      pl: "Apartament Liberta I",
      en: "Apartment Liberta I",
      de: "Ferienwohnung Liberta I",
    },
    slugs: {
      pl: "liberta-i",
      en: "liberta-i",
      de: "liberta-i",
    },
    highlights: {
      pl: [
        "Zachód słońca nad jeziorem z tarasu",
        "Prywatna bania góralska w ogrodzie",
        "Salon z widokiem na wodę i kominkiem",
      ],
      en: [
        "Lake sunset view from the terrace",
        "Private wooden hot tub in the garden",
        "Lake-view living room with fireplace",
      ],
      de: [
        "Sonnenuntergang über dem See von der Terrasse",
        "Privater Holz-Hot-Tub im Garten",
        "Wohnzimmer mit Seeblick und Kamin",
      ],
    },
    description: {
      pl: "Apartament Liberta I to 80 m² komfortu na dwóch piętrach. Na parterze salon z widokiem na jezioro, kompletna kuchnia, łazienka i sypialnia. Na piętrze dwa kolejne pokoje. Taras 25 m² z meblami, murowanym grillem i widokiem, którego nie da się zapomnieć. W ogrodzie prywatna bania góralska, podgrzewana, gotowa na wieczorne kąpiele pod gwiazdami.",
      en: "Apartment Liberta I offers 80 m² of comfort on two floors. Downstairs: a lake-view living room, full kitchen, bathroom, and one bedroom. Upstairs: two more bedrooms. The 25 m² terrace with garden furniture, a built-in grill, and a view you won't forget. In the garden, a private heated wooden hot tub ready for starlit evenings.",
      de: "Ferienwohnung Liberta I bietet 80 m² Komfort auf zwei Etagen. Unten: Wohnzimmer mit Seeblick, komplette Küche, Badezimmer und ein Schlafzimmer. Oben: zwei weitere Schlafzimmer. Die 25 m² große Terrasse mit Gartenmöbeln, gemauertem Grill und einem unvergesslichen Blick. Im Garten ein privater beheizter Holz-Hot-Tub für sternenklare Abende.",
    },
    specs: {
      sizeM2: 80,
      sleeps: 6,
      extraSleeps: 2,
      bedrooms: 3,
      bathrooms: 1,
      distanceToLakeM: 105,
    },
    amenitiesKeys: [
      "wifi", "ac", "heating", "fireplace", "kitchen", "oven", "stove",
      "microwave", "toaster", "kettle", "fridge", "tv", "netflix", "linens",
      "towels", "hairdryer", "iron", "terrace", "grill", "hottub", "sunbeds",
      "parking", "lakeview", "pets-no", "playground", "badminton", "bikes",
      "books", "boardgames", "outdoorfireplace", "bar", "stream"
    ],
    layout: {
      pl: [
        "Parter: salon z kuchnią i widokiem na jezioro, łazienka, sypialnia",
        "Piętro: 2 osobne sypialnie",
        "Możliwość dostawki dla 2 dodatkowych osób w salonie",
      ],
      en: [
        "Ground floor: living room with kitchen and lake view, bathroom, bedroom",
        "Upstairs: 2 separate bedrooms",
        "Sofa bed in the living room for 2 extra guests",
      ],
      de: [
        "Erdgeschoss: Wohnzimmer mit Küche und Seeblick, Badezimmer, Schlafzimmer",
        "Obergeschoss: 2 separate Schlafzimmer",
        "Schlafcouch im Wohnzimmer für 2 zusätzliche Gäste",
      ],
    },
    pricing: {
      highSeasonPLN: 900,
      lowSeasonPLN: 700,
    },
  },
  {
    id: "liberta-ii",
    number: 2,
    photos: {
      hero: "taras.jpg",
      layout: "luksus.jpg",
      gallery: [
        "salon-aneks-1.jpg",
        "sypialnia-pietro-1.jpg",
        "salon-aneks-2.jpg",
        "lazienka-parter-1.jpg",
        "exterior-dzien.jpg",
        "sypialnia-pietro-2.jpg",
        "exterior-noc.jpg",
      ],
    },
    names: {
      pl: "Apartament Liberta II",
      en: "Apartment Liberta II",
      de: "Ferienwohnung Liberta II",
    },
    slugs: {
      pl: "liberta-ii",
      en: "liberta-ii",
      de: "liberta-ii",
    },
    highlights: {
      pl: [
        "Bezpośredni widok na plażę i pomost",
        "Spokojna strona kompleksu, prywatność",
        "Bania z hydromasażem przy tarasie",
      ],
      en: [
        "Direct view of the beach and dock",
        "Quiet side of the complex, full privacy",
        "Hot tub with hydromassage next to the terrace",
      ],
      de: [
        "Direkter Blick auf den Strand und Steg",
        "Ruhige Seite der Anlage, volle Privatsphäre",
        "Hot Tub mit Hydromassage neben der Terrasse",
      ],
    },
    description: {
      pl: "Apartament Liberta II położony jest po spokojniejszej stronie kompleksu, z bezpośrednim widokiem na plażę i pomost. Wnętrze o powierzchni 80 m² na dwóch piętrach — komfortowe, jasne, pachnące drewnem. Taras z murowanym grillem, ogród z balią góralską. Idealny dla par i rodzin szukających ciszy oraz kontaktu z naturą.",
      en: "Apartment Liberta II sits on the quieter side of the complex, with a direct view of the beach and dock. The 80 m² interior across two floors is comfortable, bright, and smells of wood. Terrace with built-in grill, garden with wooden hot tub. Perfect for couples and families seeking quiet and contact with nature.",
      de: "Ferienwohnung Liberta II liegt auf der ruhigeren Seite der Anlage mit direktem Blick auf Strand und Steg. Das 80 m² große Interieur auf zwei Etagen ist komfortabel, hell und duftet nach Holz. Terrasse mit gemauertem Grill, Garten mit Holz-Hot-Tub. Perfekt für Paare und Familien, die Ruhe und Naturkontakt suchen.",
    },
    specs: {
      sizeM2: 80,
      sleeps: 6,
      extraSleeps: 2,
      bedrooms: 3,
      bathrooms: 1,
      distanceToLakeM: 105,
    },
    amenitiesKeys: [
      "wifi", "ac", "heating", "fireplace", "kitchen", "oven", "stove",
      "microwave", "toaster", "kettle", "fridge", "tv", "netflix", "linens",
      "towels", "hairdryer", "iron", "terrace", "grill", "hottub", "sunbeds",
      "parking", "lakeview", "pets-no", "playground", "badminton", "bikes",
      "books", "boardgames", "outdoorfireplace", "bar", "stream"
    ],
    layout: {
      pl: [
        "Parter: salon z kuchnią i widokiem na jezioro, łazienka, sypialnia",
        "Piętro: 2 osobne sypialnie",
        "Możliwość dostawki dla 2 dodatkowych osób w salonie",
      ],
      en: [
        "Ground floor: living room with kitchen and lake view, bathroom, bedroom",
        "Upstairs: 2 separate bedrooms",
        "Sofa bed in the living room for 2 extra guests",
      ],
      de: [
        "Erdgeschoss: Wohnzimmer mit Küche und Seeblick, Badezimmer, Schlafzimmer",
        "Obergeschoss: 2 separate Schlafzimmer",
        "Schlafcouch im Wohnzimmer für 2 zusätzliche Gäste",
      ],
    },
    pricing: {
      highSeasonPLN: 900,
      lowSeasonPLN: 700,
    },
  },
  {
    id: "liberta-iii",
    number: 3,
    photos: {
      hero: "salon-parter.jpg",
      layout: "salon-aneks-2.jpg",
      gallery: [
        "sypialnia-pietro-2.jpg",
        "sypialnia-pietro-3.jpg",
        "sypialnia-pietro-4.jpg",
        "lazienka-parter-2.jpg",
        "luksus.jpg",
        "lozko-detal.jpg",
      ],
    },
    names: {
      pl: "Apartament Liberta III",
      en: "Apartment Liberta III",
      de: "Ferienwohnung Liberta III",
    },
    slugs: {
      pl: "liberta-iii",
      en: "liberta-iii",
      de: "liberta-iii",
    },
    highlights: {
      pl: [
        "Najbardziej zaciszny apartament w kompleksie",
        "Taras z widokiem na zachód słońca",
        "Duży ogród z balią góralską",
      ],
      en: [
        "The most secluded apartment in the complex",
        "Terrace with sunset view",
        "Large garden with wooden hot tub",
      ],
      de: [
        "Die abgelegenste Wohnung der Anlage",
        "Terrasse mit Sonnenuntergangsblick",
        "Großer Garten mit Holz-Hot-Tub",
      ],
    },
    description: {
      pl: "Apartament Liberta III to nasz najbardziej zaciszny apartament — dla tych, którzy cenią prywatność. 80 m² na dwóch piętrach, duży ogród z balią góralską, taras z widokiem na zachód słońca. W środku klimatyzacja, kominek, Netflix, szybkie WiFi. Miejsce na rodzinny obiad, poranną kawę z widokiem na wodę i wieczorne rozmowy przy kominku.",
      en: "Apartment Liberta III is our most secluded apartment — for those who value privacy. 80 m² on two floors, a large garden with a wooden hot tub, a terrace with a sunset view. Inside: air conditioning, fireplace, Netflix, fast WiFi. A place for family dinners, morning coffee overlooking the water, and evening talks by the fireplace.",
      de: "Ferienwohnung Liberta III ist unsere abgelegenste Wohnung — für alle, die Privatsphäre schätzen. 80 m² auf zwei Etagen, großer Garten mit Holz-Hot-Tub, Terrasse mit Sonnenuntergangsblick. Innen: Klimaanlage, Kamin, Netflix, schnelles WLAN. Ein Ort für Familienessen, Morgenkaffee mit Seeblick und abendliche Gespräche am Kamin.",
    },
    specs: {
      sizeM2: 80,
      sleeps: 6,
      extraSleeps: 2,
      bedrooms: 3,
      bathrooms: 1,
      distanceToLakeM: 105,
    },
    amenitiesKeys: [
      "wifi", "ac", "heating", "fireplace", "kitchen", "oven", "stove",
      "microwave", "toaster", "kettle", "fridge", "tv", "netflix", "linens",
      "towels", "hairdryer", "iron", "terrace", "grill", "hottub", "sunbeds",
      "parking", "lakeview", "pets-no", "playground", "badminton", "bikes",
      "books", "boardgames", "outdoorfireplace", "bar", "stream"
    ],
    layout: {
      pl: [
        "Parter: salon z kuchnią i widokiem na jezioro, łazienka, sypialnia",
        "Piętro: 2 osobne sypialnie",
        "Możliwość dostawki dla 2 dodatkowych osób w salonie",
      ],
      en: [
        "Ground floor: living room with kitchen and lake view, bathroom, bedroom",
        "Upstairs: 2 separate bedrooms",
        "Sofa bed in the living room for 2 extra guests",
      ],
      de: [
        "Erdgeschoss: Wohnzimmer mit Küche und Seeblick, Badezimmer, Schlafzimmer",
        "Obergeschoss: 2 separate Schlafzimmer",
        "Schlafcouch im Wohnzimmer für 2 zusätzliche Gäste",
      ],
    },
    pricing: {
      highSeasonPLN: 900,
      lowSeasonPLN: 700,
    },
  },
  {
    id: "liberta-iv",
    number: 4,
    photos: {
      hero: "exterior-noc.jpg",
      layout: "exterior-dzien.jpg",
      gallery: [
        "sypialnia-pietro-3.jpg",
        "sypialnia-pietro-4.jpg",
        "sypialnia-parter.jpg",
        "bania-goralska.jpg",
        "kuchnia.jpg",
        "salon-parter.jpg",
      ],
    },
    names: {
      pl: "Apartament Liberta IV",
      en: "Apartment Liberta IV",
      de: "Ferienwohnung Liberta IV",
    },
    slugs: {
      pl: "liberta-iv",
      en: "liberta-iv",
      de: "liberta-iv",
    },
    highlights: {
      pl: [
        "Najbliżej plaży i pomostów",
        "Idealny dla rodzin z dziećmi",
        "Taras z balią w bezpośrednim sąsiedztwie",
      ],
      en: [
        "Closest to the beach and docks",
        "Ideal for families with children",
        "Terrace with the hot tub right next to it",
      ],
      de: [
        "Am nächsten zum Strand und zu den Stegen",
        "Ideal für Familien mit Kindern",
        "Terrasse mit dem Hot Tub direkt daneben",
      ],
    },
    description: {
      pl: "Apartament Liberta IV to nasz rodzinny apartament — najbliżej plaży, z bezpośrednim dostępem do pomostów. 80 m² na dwóch piętrach, 3 sypialnie dla 6 osób, taras z balią w bezpośrednim sąsiedztwie. Poranne kąpiele w jeziorze, plaża dla dzieci, wieczory przy grillu. Wszystko, czego potrzebuje rodzina, w jednym miejscu.",
      en: "Apartment Liberta IV is our family apartment — closest to the beach, with direct access to the docks. 80 m² on two floors, 3 bedrooms for 6 guests, terrace with the hot tub right next to it. Morning swims in the lake, beach for the kids, evenings at the grill. Everything a family needs in one place.",
      de: "Ferienwohnung Liberta IV ist unsere Familienwohnung — am nächsten zum Strand, mit direktem Zugang zu den Stegen. 80 m² auf zwei Etagen, 3 Schlafzimmer für 6 Personen, Terrasse mit dem Hot Tub direkt daneben. Morgenschwimmen im See, Strand für Kinder, Abende am Grill. Alles, was eine Familie braucht, an einem Ort.",
    },
    specs: {
      sizeM2: 80,
      sleeps: 6,
      extraSleeps: 2,
      bedrooms: 3,
      bathrooms: 1,
      distanceToLakeM: 105,
    },
    amenitiesKeys: [
      "wifi", "ac", "heating", "fireplace", "kitchen", "oven", "stove",
      "microwave", "toaster", "kettle", "fridge", "tv", "netflix", "linens",
      "towels", "hairdryer", "iron", "terrace", "grill", "hottub", "sunbeds",
      "parking", "lakeview", "pets-no", "playground", "badminton", "bikes",
      "books", "boardgames", "outdoorfireplace", "bar", "stream"
    ],
    layout: {
      pl: [
        "Parter: salon z kuchnią i widokiem na jezioro, łazienka, sypialnia",
        "Piętro: 2 osobne sypialnie",
        "Możliwość dostawki dla 2 dodatkowych osób w salonie",
      ],
      en: [
        "Ground floor: living room with kitchen and lake view, bathroom, bedroom",
        "Upstairs: 2 separate bedrooms",
        "Sofa bed in the living room for 2 extra guests",
      ],
      de: [
        "Erdgeschoss: Wohnzimmer mit Küche und Seeblick, Badezimmer, Schlafzimmer",
        "Obergeschoss: 2 separate Schlafzimmer",
        "Schlafcouch im Wohnzimmer für 2 zusätzliche Gäste",
      ],
    },
    pricing: {
      highSeasonPLN: 900,
      lowSeasonPLN: 700,
    },
  },
];

/**
 * Get apartment by ID.
 */
export function getApartment(id: Apartment["id"]): Apartment | undefined {
  return apartments.find((a) => a.id === id);
}

/**
 * Get apartment by number.
 */
export function getApartmentByNumber(n: number): Apartment | undefined {
  return apartments.find((a) => a.number === n);
}
