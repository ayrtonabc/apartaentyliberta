/**
 * Amenities — equipamiento y servicios de cada apartamento.
 * Iconos dibujados inline en AmenityGrid (slug propio, sin dependencias).
 */

import type { IconName } from "~/data/icons";

export type Amenity = {
  key: string;
  labels: {
    pl: string;
    en: string;
    de: string;
  };
  icon: IconName;
};

export const amenities: Amenity[] = [
  { key: "wifi", icon: "wifi", labels: { pl: "Bezpłatne WiFi", en: "Free WiFi", de: "Kostenloses WLAN" } },
  { key: "ac", icon: "wind", labels: { pl: "Klimatyzacja", en: "Air conditioning", de: "Klimaanlage" } },
  { key: "heating", icon: "thermometer", labels: { pl: "Ogrzewanie", en: "Heating", de: "Heizung" } },
  { key: "fireplace", icon: "flame", labels: { pl: "Kominek na drewno", en: "Wood-burning stove", de: "Holzofen" } },
  { key: "kitchen", icon: "utensils", labels: { pl: "W pełni wyposażona kuchnia", en: "Fully equipped kitchen", de: "Voll ausgestattete Küche" } },
  { key: "oven", icon: "oven", labels: { pl: "Piekarnik", en: "Oven", de: "Backofen" } },
  { key: "microwave", icon: "microwave", labels: { pl: "Mikrofalówka", en: "Microwave", de: "Mikrowelle" } },
  { key: "toaster", icon: "toaster", labels: { pl: "Toster", en: "Toaster", de: "Toaster" } },
  { key: "kettle", icon: "kettle", labels: { pl: "Czajnik elektryczny", en: "Electric kettle", de: "Wasserkocher" } },
  { key: "fridge", icon: "fridge", labels: { pl: "Lodówka", en: "Refrigerator", de: "Kühlschrank" } },
  { key: "stove", icon: "stove", labels: { pl: "Płyta indukcyjna", en: "Induction hob", de: "Induktionskochfeld" } },
  { key: "tv", icon: "tv", labels: { pl: "Telewizor Smart TV", en: "Smart TV", de: "Smart-TV" } },
  { key: "netflix", icon: "play", labels: { pl: "Netflix i streaming", en: "Netflix and streaming", de: "Netflix und Streaming" } },
  { key: "linens", icon: "bed", labels: { pl: "Pościel i ręczniki", en: "Linen and towels", de: "Bettwäsche und Handtücher" } },
  { key: "towels", icon: "bath", labels: { pl: "Ręczniki", en: "Towels", de: "Handtücher" } },
  { key: "hairdryer", icon: "hairdryer", labels: { pl: "Suszarka do włosów", en: "Hairdryer", de: "Haartrockner" } },
  { key: "iron", icon: "iron", labels: { pl: "Żelazko i deska", en: "Iron and board", de: "Bügeleisen und Brett" } },
  { key: "washer", icon: "washer", labels: { pl: "Pralka", en: "Washing machine", de: "Waschmaschine" } },
  { key: "terrace", icon: "terrace", labels: { pl: "Zadaszony taras", en: "Covered terrace", de: "Überdachte Terrasse" } },
  { key: "grill", icon: "grill", labels: { pl: "Murowany grill", en: "Built-in BBQ", de: "Gemauerter Grill" } },
  { key: "hottub", icon: "hottub", labels: { pl: "Balia góralska", en: "Wooden hot tub", de: "Holz-Hot-Tub" } },
  { key: "sunbeds", icon: "sun", labels: { pl: "Leżaki", en: "Sun loungers", de: "Liegestühle" } },
  { key: "parking", icon: "parking", labels: { pl: "Parking przy apartamencie", en: "Parking at the apartment", de: "Parkplatz am Apartment" } },
  { key: "lakeview", icon: "lake", labels: { pl: "Widok na jezioro", en: "Lake view", de: "Seeblick" } },
  { key: "pets-no", icon: "no-pets", labels: { pl: "Zwierzęta niedozwolone", en: "No pets", de: "Keine Haustiere" } },
  { key: "playground", icon: "playground", labels: { pl: "Plac zabaw dla dzieci", en: "Kids playground", de: "Kinderspielplatz" } },
  { key: "badminton", icon: "badminton", labels: { pl: "Sprzęt do badmintona", en: "Badminton gear", de: "Badminton-Ausrüstung" } },
  { key: "bikes", icon: "bike", labels: { pl: "Rowery dla gości", en: "Bikes for guests", de: "Fahrräder für Gäste" } },
  { key: "books", icon: "book", labels: { pl: "Książki i gry dla dzieci", en: "Books and kids games", de: "Bücher und Kinderspiele" } },
  { key: "boardgames", icon: "boardgame", labels: { pl: "Gry planszowe", en: "Board games", de: "Brettspiele" } },
  { key: "outdoorfireplace", icon: "firepit", labels: { pl: "Miejsce na ognisko", en: "Fire pit", de: "Feuerstelle" } },
  { key: "bar", icon: "bar", labels: { pl: "Bar plażowy", en: "Beach bar", de: "Strandbar" } },
];

export function getAmenity(key: string): Amenity | undefined {
  return amenities.find((a) => a.key === key);
}

export function getAmenities(keys: string[]): Amenity[] {
  return keys
    .map((key) => amenities.find((a) => a.key === key))
    .filter((a): a is Amenity => Boolean(a));
}
