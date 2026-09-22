/**
 * Atracciones en la zona — extraídas del contenido real del sitio.
 */

export type Attraction = {
  slug: string;
  category: "water" | "land" | "sport" | "food" | "event";
  name: { pl: string; en: string; de: string };
  description: { pl: string; en: string; de: string };
  distanceKm?: number;
  external?: string;
  /**
   * Imagen de la atracción, ruta pública.
   *
   * Se muestra al pasar el ratón por la tarjeta. Solo la tienen las atracciones
   * de las que hay foto: el propietario aportó seis. Las que no la tienen
   * mantienen el texto al pasar el ratón, que es el comportamiento anterior.
   *
   * Los archivos viven en public/assets/attractions/ con el nombre del slug y se
   * generan desde los originales con:
   *   node scripts/import-attraction-images.mjs
   */
  image?: string;
  /** Texto alternativo de esa imagen, por idioma */
  imageAlt?: { pl: string; en: string; de: string };
};

export const attractions: Attraction[] = [
  // Water
  {
    slug: "kanal-ostrodzko-elblaski",
    category: "water",
    name: {
      pl: "Kanał Ostródzko-Elbląski",
      en: "Ostróda–Elbląg Canal",
      de: "Ostróda-Elbląg-Kanal",
    },
    description: {
      pl: "Unikalne na skalę światową pochylnie łączą jeziora Mazur z Zalewem Wiślanym. Rejs łodzią to jedno z najbardziej niezwykłych doświadczeń w Polsce.",
      en: "World-unique inclined planes connecting Masurian lakes with the Vistula Lagoon. A boat trip is one of the most extraordinary experiences in Poland.",
      de: "Weltweit einzigartige Schiffshebewerke, die masurische Seen mit dem Frischen Haff verbinden. Eine Bootsfahrt ist eines der außergewöhnlichsten Erlebnisse in Polen.",
    },
    distanceKm: 25,
    image: "/assets/attractions/kanal-ostrodzko-elblaski.webp",
    imageAlt: {
      pl: "Kanał Ostródzko-Elbląski — pochylnie i śluzy na szlaku wodnym",
      en: "Ostróda–Elbląg Canal — inclined planes and locks",
      de: "Ostróda-Elbląg-Kanal — Schiffshebewerke und Schleusen",
    },
  },
  {
    slug: "jezioro-szelag",
    category: "water",
    name: {
      pl: "Jezioro Szeląg Wielki",
      en: "Lake Szeląg Wielki",
      de: "Szeląg-See",
    },
    description: {
      pl: "Jezioro Natura 2000 z dwoma pomostami, plażą, bogatą fauną i czystą wodą. Można kąpać się, wędkować, pływać SUP, kajakiem lub łodzią motorową.",
      en: "Natura 2000 lake with two docks, a beach, rich fauna, and clean water. Swim, fish, paddleboard, kayak, or motorboat.",
      de: "Natura-2000-See mit zwei Stegen, Strand, reicher Fauna und sauberem Wasser. Schwimmen, Angeln, Stand-Up-Paddling, Kajak oder Motorboot.",
    },
    distanceKm: 0.1,
    image: "/assets/attractions/jezioro-szelag.webp",
    imageAlt: {
      pl: "Jezioro Szeląg Wielki z pomostem i plażą",
      en: "Lake Szeląg Wielki with its dock and beach",
      de: "Szeląg-See mit Steg und Strand",
    },
  },
  {
    slug: "rejs-motorowka",
    category: "water",
    name: {
      pl: "Rejs motorówką z właścicielem",
      en: "Motorboat cruise with the owner",
      de: "Motorbootausflug mit dem Besitzer",
    },
    description: {
      pl: "Właściciel organizuje prywatne rejsy po jeziorze Szeląg i okolicznych akwenach. Do uzgodnienia na miejscu.",
      en: "The owner arranges private cruises on Lake Szeląg and nearby waters. To be agreed on site.",
      de: "Der Besitzer organisiert private Ausflüge auf dem Szeląg-See und den umliegenden Gewässern. Vor Ort zu vereinbaren.",
    },
    image: "/assets/attractions/rejs-motorowka.webp",
    imageAlt: {
      pl: "Rejs motorówką po jeziorze z właścicielem",
      en: "Motorboat trip on the lake with the owner",
      de: "Motorbootfahrt auf dem See mit dem Gastgeber",
    },
  },
  {
    slug: "sup-kajaki",
    category: "water",
    name: {
      pl: "SUP i kajaki w Marina Liberta",
      en: "SUP and kayaks at Marina Liberta",
      de: "SUP und Kajaks in der Marina Liberta",
    },
    description: {
      pl: "Wypożyczalnia sprzętu wodnego na miejscu: deski SUP, kajaki, rowery. 15 zł/h dla gości, 30 zł/h dla osób z zewnątrz.",
      en: "On-site water equipment rental: SUP boards, kayaks, bikes. 15 PLN/h for guests, 30 PLN/h for visitors.",
      de: "Wassersportausrüstung vor Ort: SUP-Boards, Kajaks, Fahrräder. 15 PLN/h für Gäste, 30 PLN/h für externe Besucher.",
    },
    image: "/assets/attractions/sup-kajaki.webp",
    imageAlt: {
      pl: "Deski SUP i kajaki w Marina Liberta",
      en: "SUP boards and kayaks at Marina Liberta",
      de: "SUP-Boards und Kajaks in der Marina Liberta",
    },
  },

  // Land
  {
    slug: "bunkry-stare-jablonki",
    category: "land",
    name: {
      pl: "Bunkry w Starych Jabłonkach",
      en: "Bunkers in Stare Jabłonki",
      de: "Bunker in Stare Jabłonki",
    },
    description: {
      pl: "Historyczne fortyfikacje z okresu II wojny światowej. Miejsce pamięci i fascynujące dla miłośników historii militarnej.",
      en: "Historical fortifications from World War II. A place of memory and fascinating for military history lovers.",
      de: "Historische Befestigungsanlagen aus dem Zweiten Weltkrieg. Ein Ort der Erinnerung und faszinierend für Militärgeschichtsliebhaber.",
    },
    image: "/assets/attractions/bunkry-stare-jablonski.webp",
    imageAlt: {
      pl: "Bunkry z okresu II wojny światowej w Starych Jabłonkach",
      en: "Second World War bunkers in Stare Jabłonki",
      de: "Bunker aus dem Zweiten Weltkrieg in Stare Jabłonki",
    },
  },
  {
    slug: "szlaki-rowerowe",
    category: "land",
    name: {
      pl: "Szlaki rowerowe",
      en: "Cycling trails",
      de: "Radwege",
    },
    description: {
      pl: "Mazury to królestwo rowerzystów. Liczne szlaki wiodą przez lasy, wzdłuż jezior i przez małe wsie z regionalnymi sklepikami.",
      en: "Masuria is a cyclist's kingdom. Numerous trails lead through forests, along lakes, and through small villages with local shops.",
      de: "Masuren ist ein Radfahrerparadies. Zahlreiche Routen führen durch Wälder, entlang von Seen und durch kleine Dörfer mit regionalen Läden.",
    },
    image: "/assets/attractions/szlaki-rowerowe.webp",
    imageAlt: {
      pl: "Szlak rowerowy wśród mazurskich lasów i jezior",
      en: "Cycling trail through Masurian forests and lakes",
      de: "Radweg durch masurische Wälder und Seen",
    },
  },
  {
    slug: "rezerwat-sosny-taborskiej",
    category: "land",
    name: {
      pl: "Rezerwat sosny Taborskiej",
      en: "Taborz Pine Nature Reserve",
      de: "Kiefern-Naturreservat Taborz",
    },
    description: {
      pl: "Chroniony starodrzew sosnowy — warto zobaczyć majestatyczne, wielowiekowe drzewa.",
      en: "Protected old-growth pine forest — see the majestic centuries-old trees.",
      de: "Geschützter alter Kiefernwald — sehen Sie die majestätischen jahrhundertealten Bäume.",
    },
    image: "/assets/attractions/rezerwat-sosny-taborskiej.webp",
    imageAlt: {
      pl: "Stare sosny w rezerwacie Sosny Taborskiej",
      en: "Old pines in the Sosny Taborskie reserve",
      de: "Alte Kiefern im Naturschutzgebiet Sosny Taborskie",
    },
  },
  {
    slug: "jazda-konna",
    category: "land",
    name: {
      pl: "Jazda konna",
      en: "Horse riding",
      de: "Reiten",
    },
    description: {
      pl: "W okolicy działają stadniny oferujące lekcje i przejażdżki po lesie i wzdłuż jezior.",
      en: "Local stables offer lessons and rides through the forest and along the lakes.",
      de: "Lokale Reitställe bieten Unterricht und Ausritte durch den Wald und entlang der Seen.",
    },
    image: "/assets/attractions/jazda-konna.webp",
    imageAlt: {
      pl: "Jeździec na koniu w trakcie przejażdżki",
      en: "A rider on horseback during a ride",
      de: "Ein Reiter zu Pferd während eines Ausritts",
    },
  },

  // Sport
  {
    slug: "strzelnica",
    category: "sport",
    name: {
      pl: "Strzelnica sportowa",
      en: "Sport shooting range",
      de: "Sportschießstand",
    },
    description: {
      pl: "Profesjonalna strzelnica w okolicy. Właściciel organizuje wyjazdy dla gości — z możliwością strzelania z broni palnej i ogniskiem po sesji.",
      en: "Professional shooting range nearby. The owner organizes trips for guests — with firearms and a bonfire after the session.",
      de: "Professioneller Schießstand in der Nähe. Der Besitzer organisiert Ausflüge für Gäste — mit Schusswaffen und Lagerfeuer danach.",
    },
    image: "/assets/attractions/strzelnica.webp",
    imageAlt: {
      pl: "Strzelnica sportowa — stanowiska i tarcze",
      en: "Sports shooting range — lanes and targets",
      de: "Sportschießstand — Bahnen und Ziele",
    },
  },
  {
    slug: "narty-wodne",
    category: "sport",
    name: {
      pl: "Narty wodne w Ostródzie",
      en: "Water skiing in Ostróda",
      de: "Wasserski in Ostróda",
    },
    description: {
      pl: "Wyciąg nart wodnych na jeziorze w Ostródzie, 25 km od Liberta.",
      en: "Water ski lift on the lake in Ostróda, 25 km from Liberta.",
      de: "Wasserski-Lift am See in Ostróda, 25 km von Liberta.",
    },
    distanceKm: 25,
    image: "/assets/attractions/narty-wodne.webp",
    imageAlt: {
      pl: "Narciarz wodny na wyciągu w Ostródzie",
      en: "Water skier on the cable lift in Ostróda",
      de: "Wasserskifahrer am Lift in Ostróda",
    },
  },
  {
    slug: "golf",
    category: "sport",
    name: {
      pl: "Pola golfowe",
      en: "Golf courses",
      de: "Golfplätze",
    },
    description: {
      pl: "Mazury mają kilka pól golfowych. W okolicy Kątna dostępne są kursy dla początkujących i zaawansowanych.",
      en: "Masuria has several golf courses. Near Kątno, courses for beginners and advanced players are available.",
      de: "Masuren hat mehrere Golfplätze. In der Nähe von Kątno gibt es Plätze für Anfänger und Fortgeschrittene.",
    },
    image: "/assets/attractions/golf.webp",
    imageAlt: {
      pl: "Zielone pole golfowe w okolicy Kątna",
      en: "A green golf course near Kątn",
      de: "Ein grüner Golfplatz bei Kątn",
    },
  },
  {
    slug: "pola-grunwaldzkie",
    category: "land",
    name: {
      pl: "Pola Grunwaldzkie",
      en: "Grunwald Battlefield",
      de: "Schlachtfeld von Grunwald",
    },
    description: {
      pl: "Miejsce bitwy z 1410 roku, jednej z największych bitew średniowiecznej Europy. Muzeum i coroczne inscenizacje.",
      en: "Site of the 1410 battle, one of medieval Europe's largest. Museum and annual reenactments.",
      de: "Ort der Schlacht von 1410, eine der größten mittelalterlichen Schlachten Europas. Museum und jährliche Nachstellungen.",
    },
    distanceKm: 50,
    image: "/assets/attractions/pola-grunwaldzkie.webp",
    imageAlt: {
      pl: "Pomnik i pola bitwy pod Grunwaldem",
      en: "The monument and battlefield at Grunwald",
      de: "Denkmal und Schlachtfeld bei Grunwald",
    },
  },

  // Food
  {
    slug: "pajda-mazur",
    category: "food",
    name: {
      pl: "Restauracja Pajda Mazur",
      en: "Restaurant Pajda Mazur",
      de: "Restaurant Pajda Mazur",
    },
    description: {
      pl: "Tradycyjna kuchnia mazurska. Dla gości Liberta: śniadania 30 zł/os, obiady 40 zł/os.",
      en: "Traditional Masurian cuisine. For Liberta guests: breakfast 30 PLN/person, lunch 40 PLN/person.",
      de: "Traditionelle masurische Küche. Für Liberta-Gäste: Frühstück 30 PLN/Person, Mittagessen 40 PLN/Person.",
    },
    image: "/assets/attractions/pajda-mazur.webp",
    imageAlt: {
      pl: "Restauracja Pajda Mazur z tarasem na zewnątrz",
      en: "Restauracja Pajda Mazur with its outdoor terrace",
      de: "Restauracja Pajda Mazur mit Außenterrasse",
    },
  },
  {
    slug: "sielanka",
    category: "food",
    name: {
      pl: "Restauracja Sielanka",
      en: "Restaurant Sielanka",
      de: "Restaurant Sielanka",
    },
    description: {
      pl: "Kuchnia polska w nowoczesnym wydaniu. 10% rabatu dla gości Liberta.",
      en: "Modern Polish cuisine. 10% discount for Liberta guests.",
      de: "Moderne polnische Küche. 10% Rabatt für Liberta-Gäste.",
    },
    image: "/assets/attractions/sielanka.webp",
    imageAlt: {
      pl: "Restauracja Sielanka nad jeziorem",
      en: "Restauracja Sielanka by the lake",
      de: "Restauracja Sielanka am See",
    },
  },
  {
    slug: "krainy-jezior",
    category: "food",
    name: {
      pl: "Catering Krainy Jezior",
      en: "Krainy Jezior Catering",
      de: "Catering Krainy Jezior",
    },
    description: {
      pl: "Catering z menu i menu świątecznego. 15% rabatu dla gości Liberta.",
      en: "Catering with regular and holiday menus. 15% discount for Liberta guests.",
      de: "Catering mit regulärer und Feiertagskarte. 15% Rabatt für Liberta-Gäste.",
    },
  },

  // Events
  {
    slug: "festiwal-sup",
    category: "event",
    name: {
      pl: "Festiwal SUP w Kątnie",
      en: "SUP Festival in Kątno",
      de: "SUP-Festival in Kątno",
    },
    description: {
      pl: "Coroczne wydarzenie na wodzie: wyścigi, szkolenia, konkursy, nagrody. 18 lipca 2026.",
      en: "Annual water event: races, training, contests, prizes. 18 July 2026.",
      de: "Jährliche Wasserveranstaltung: Rennen, Training, Wettbewerbe, Preise. 18. Juli 2026.",
    },
    image: "/assets/attractions/festiwal-sup.webp",
    imageAlt: {
      pl: "Uczestnicy Festiwalu SUP na jeziorze w Kątnie",
      en: "Participants at the SUP Festival on the lake in Kątn",
      de: "Teilnehmer des SUP-Festivals auf dem See in Kątn",
    },
  },
];

export const attractionsByCategory = {
  water: attractions.filter((a) => a.category === "water"),
  land: attractions.filter((a) => a.category === "land"),
  sport: attractions.filter((a) => a.category === "sport"),
  food: attractions.filter((a) => a.category === "food"),
  event: attractions.filter((a) => a.category === "event"),
};
