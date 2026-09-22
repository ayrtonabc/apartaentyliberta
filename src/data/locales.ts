/**
 * Locales y mapa de rutas — fuente única de verdad para i18n.
 *
 * Mantener aquí TODAS las equivalencias de rutas entre idiomas evita el clásico
 * bug de que /en/ y /de/ enlacen a URLs en polaco (y con ello canonicals y
 * hreflang incorrectos, que es lo que penaliza el SEO).
 */

export type Locale = "pl" | "en" | "de";

export const defaultLocale: Locale = "pl";
export const locales: Locale[] = ["pl", "en", "de"];

export type LocaleMeta = {
  code: Locale;
  /** Código ISO para banderas y <html> */
  region: string;
  /** Nombre del idioma en ese idioma */
  nativeName: string;
  /** Nombre del idioma en inglés */
  englishName: string;
  /** Abreviatura de 2 letras para el chip */
  short: string;
  /** Etiqueta hreflang completa */
  hreflang: string;
  /** Etiqueta og:locale */
  ogLocale: string;
  /** Locale BCP-47 para Intl */
  intl: string;
  /** Prefijo de URL ("" para el idioma por defecto) */
  prefix: string;
};

export const localeMeta: Record<Locale, LocaleMeta> = {
  pl: {
    code: "pl",
    region: "pl",
    nativeName: "Polski",
    englishName: "Polish",
    short: "PL",
    hreflang: "pl-PL",
    ogLocale: "pl_PL",
    intl: "pl-PL",
    prefix: "",
  },
  en: {
    code: "en",
    region: "en",
    nativeName: "English",
    englishName: "English",
    short: "EN",
    hreflang: "en-GB",
    ogLocale: "en_GB",
    intl: "en-GB",
    prefix: "/en",
  },
  de: {
    code: "de",
    region: "de",
    nativeName: "Deutsch",
    englishName: "German",
    short: "DE",
    hreflang: "de-DE",
    ogLocale: "de_DE",
    intl: "de-DE",
    prefix: "/de",
  },
};

/**
 * Equivalencias de rutas estáticas entre idiomas.
 * La clave es la ruta en polaco (idioma canónico del contenido).
 */
export const routeMap: Record<string, Record<Locale, string>> = {
  "/": { pl: "/", en: "/en/", de: "/de/" },
  "/apartamenty/": {
    pl: "/apartamenty/",
    en: "/en/apartments/",
    de: "/de/ferienwohnungen/",
  },
  "/cennik/": { pl: "/cennik/", en: "/en/prices/", de: "/de/preise/" },
  "/lokalizacja/": { pl: "/lokalizacja/", en: "/en/location/", de: "/de/lage/" },
  "/atrakcje/": { pl: "/atrakcje/", en: "/en/attractions/", de: "/de/attraktionen/" },
  "/rezerwacja/": { pl: "/rezerwacja/", en: "/en/booking/", de: "/de/reservierung/" },
  /*
   * Página de resultados de la búsqueda del hero. Es una subruta de la reserva,
   * así que se declara aparte para que localeLink() resuelva los tres idiomas.
   */
  "/rezerwacja/wyniki/": {
    pl: "/rezerwacja/wyniki/",
    en: "/en/booking/results/",
    de: "/de/reservierung/ergebnisse/",
  },
  "/opinie/": { pl: "/opinie/", en: "/en/reviews/", de: "/de/bewertungen/" },
  "/faq/": { pl: "/faq/", en: "/en/faq/", de: "/de/faq/" },
  "/galeria/": { pl: "/galeria/", en: "/en/gallery/", de: "/de/galerie/" },
  "/regulamin/": { pl: "/regulamin/", en: "/en/terms/", de: "/de/agb/" },
  "/polityka-prywatnosci/": {
    pl: "/polityka-prywatnosci/",
    en: "/en/privacy/",
    de: "/de/datenschutz/",
  },
  "/festiwal-sup/": {
    pl: "/festiwal-sup/",
    en: "/en/sup-festival/",
    de: "/de/sup-festival/",
  },
  "/okolica/olsztyn/": {
    pl: "/okolica/olsztyn/",
    en: "/en/area/olsztyn/",
    de: "/de/umgebung/olsztyn/",
  },
  "/okolica/ostroda/": {
    pl: "/okolica/ostroda/",
    en: "/en/area/ostroda/",
    de: "/de/umgebung/ostroda/",
  },
  "/okolica/olsztynek/": {
    pl: "/okolica/olsztynek/",
    en: "/en/area/olsztynek/",
    de: "/de/umgebung/olsztynek/",
  },
  "/okolica/katno/": {
    pl: "/okolica/katno/",
    en: "/en/area/katno/",
    de: "/de/umgebung/katno/",
  },
};

/** Prefijos de sección por idioma: /apartamenty/liberta-i/ ↔ /en/apartments/liberta-i/ */
const sectionPrefixes: Array<{ key: string; sections: Record<Locale, string> }> = [
  {
    key: "/apartamenty/",
    sections: { pl: "/apartamenty/", en: "/en/apartments/", de: "/de/ferienwohnungen/" },
  },
  {
    key: "/okolica/",
    sections: { pl: "/okolica/", en: "/en/area/", de: "/de/umgebung/" },
  },
];

/** Normaliza una ruta para poder compararla (siempre con barra final). */
export function normalizePath(path: string): string {
  if (!path) return "/";
  const clean = path.split("?")[0].split("#")[0];
  const withSlash = clean.startsWith("/") ? clean : `/${clean}`;
  if (withSlash === "/") return "/";
  return withSlash.endsWith("/") ? withSlash : `${withSlash}/`;
}

/**
 * Traduce una ruta de un idioma a otro.
 * - Rutas conocidas → equivalencia exacta
 * - Rutas de detalle (/apartamenty/liberta-i/) → se conserva el slug
 * - Desconocidas → se antepone el prefijo del idioma destino
 */
export function translatePath(path: string, target: Locale): string {
  const p = normalizePath(path);

  const exact = routeMap[p];
  if (exact) return exact[target];

  for (const { key, sections } of sectionPrefixes) {
    if (p.startsWith(key)) {
      const rest = p.slice(key.length);
      return `${sections[target]}${rest}`;
    }
  }

  // Si la ruta ya viene con prefijo de idioma, se quita antes de re-prefijar
  const stripped = p.replace(/^\/(en|de)\//, "/");
  const strippedExact = routeMap[stripped];
  if (strippedExact) return strippedExact[target];

  for (const { key, sections } of sectionPrefixes) {
    if (stripped.startsWith(key)) {
      const rest = stripped.slice(key.length);
      return `${sections[target]}${rest}`;
    }
  }

  return target === defaultLocale ? stripped : `${localeMeta[target].prefix}${stripped}`;
}

/** Detecta el idioma a partir del pathname. */
export function localeFromPath(path: string): Locale {
  const first = normalizePath(path).split("/")[1];
  if (first === "en") return "en";
  if (first === "de") return "de";
  return defaultLocale;
}
