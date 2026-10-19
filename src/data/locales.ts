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
 *
 * IMPORTANTE — solo se declara un idioma si la página EXISTE de verdad.
 *
 * Antes había entradas para `/regulamin/`, `/polityka-prywatnosci/`,
 * `/festiwal-sup/` y `/okolica/*` en inglés y alemán, pero esas páginas nunca
 * se escribieron: el sitio enlazaba a 58 URLs que devolvían 404 (el selector de
 * idioma y los hreflang las anunciaban como si existieran). Mientras no haya
 * traducción real, la ruta se declara solo en polaco y `translatePath()` hace
 * que el selector lleve a la versión polaca en lugar de a un 404.
 */
export type RouteTranslations = Partial<Record<Locale, string>>;

export const routeMap: Record<string, RouteTranslations> = {
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

  /*
   * Sin traducción publicada todavía.
   *
   * Estas páginas existen solo en polaco. Se declaran con su clave canónica
   * para que `translatePath()` las reconozca (y no las trate como una ruta
   * desconocida a la que hay que anteponer un prefijo), pero sin `en`/`de`:
   * así el selector de idioma lleva a la versión polaca y los hreflang no
   * anuncian traducciones que no existen.
   */
  "/regulamin/": { pl: "/regulamin/" },
  "/polityka-prywatnosci/": { pl: "/polityka-prywatnosci/" },
  "/festiwal-sup/": { pl: "/festiwal-sup/" },
  "/okolica/olsztyn/": { pl: "/okolica/olsztyn/" },
  "/okolica/ostroda/": { pl: "/okolica/ostroda/" },
  "/okolica/olsztynek/": { pl: "/okolica/olsztynek/" },
  "/okolica/katno/": { pl: "/okolica/katno/" },
};

/**
 * Prefijos de sección con páginas de detalle en los tres idiomas:
 * /apartamenty/liberta-i/ ↔ /en/apartments/liberta-i/ ↔ /de/ferienwohnungen/liberta-i/
 *
 * El slug del apartamento se conserva; solo cambia el prefijo de la sección.
 */
const sectionPrefixes: Array<{ sections: Record<Locale, string> }> = [
  {
    sections: { pl: "/apartamenty/", en: "/en/apartments/", de: "/de/ferienwohnungen/" },
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
 * Índice inverso: CUALQUIER URL publicada (en cualquiera de los tres idiomas)
 * → su clave canónica en polaco.
 *
 * Sin esto, `translatePath()` solo entendía rutas en polaco. Al cambiar de
 * idioma desde /en/apartments/ o /de/preise/ no encontraba la equivalencia y
 * devolvía /apartments/ o /de/prices/: 404. El idioma de origen no puede ser
 * una suposición; se resuelve por la URL.
 */
const canonicalIndex: Record<string, string> = (() => {
  const index: Record<string, string> = {};
  for (const [key, translations] of Object.entries(routeMap)) {
    index[normalizePath(key)] = key;
    for (const localized of Object.values(translations)) {
      if (localized) index[normalizePath(localized)] = key;
    }
  }
  return index;
})();

type ResolvedRoute =
  /** Página estática declarada en routeMap (traducida o solo en polaco). */
  | { kind: "static"; canonical: string; translations: RouteTranslations }
  /** Página de detalle: solo cambia el prefijo de la sección. */
  | { kind: "section"; sections: Record<Locale, string>; rest: string }
  /** Ruta no declarada (404, utilidades, rutas futuras). */
  | { kind: "unknown"; canonical: string };

/** Resuelve una URL (en cualquier idioma) a su forma canónica. */
export function resolveRoute(path: string): ResolvedRoute {
  const p = normalizePath(path);

  const canonical = canonicalIndex[p];
  if (canonical) {
    return { kind: "static", canonical, translations: routeMap[canonical] };
  }

  for (const { sections } of sectionPrefixes) {
    for (const locale of locales) {
      const prefix = sections[locale];
      if (p.startsWith(prefix)) {
        return { kind: "section", sections, rest: p.slice(prefix.length) };
      }
    }
  }

  return { kind: "unknown", canonical: p };
}

/**
 * Traduce una ruta de un idioma a otro.
 * - Ruta conocida con traducción → su equivalente exacto
 * - Ruta conocida sin traducción → la versión en polaco (nunca un 404)
 * - Detalle de apartamento → se conserva el slug y cambia el prefijo
 * - Desconocida → se antepone el prefijo del idioma destino
 */
export function translatePath(path: string, target: Locale): string {
  const resolved = resolveRoute(path);

  if (resolved.kind === "static") {
    return (
      resolved.translations[target] ??
      resolved.translations[defaultLocale] ??
      resolved.canonical
    );
  }

  if (resolved.kind === "section") {
    return `${resolved.sections[target]}${resolved.rest}`;
  }

  // Si la ruta ya viene con prefijo de idioma, se quita antes de re-prefijar
  const stripped = resolved.canonical.replace(/^\/(en|de)\//, "/");
  if (stripped !== resolved.canonical) return translatePath(stripped, target);

  return target === defaultLocale
    ? resolved.canonical
    : `${localeMeta[target].prefix}${resolved.canonical}`;
}

/**
 * ¿Esta ruta tiene página propia en ese idioma?
 *
 * Se usa para no anunciar hreflang de traducciones que no existen: Google
 * penaliza alternates que apuntan a 404, y el selector de idioma tampoco debe
 * fingir que hay versión inglesa de, por ejemplo, el reglamento.
 */
export function hasTranslation(path: string, locale: Locale): boolean {
  const resolved = resolveRoute(path);
  if (resolved.kind === "static") return Boolean(resolved.translations[locale]);
  if (resolved.kind === "section") return Boolean(resolved.sections[locale]);
  return false;
}

/** Detecta el idioma a partir del pathname. */
export function localeFromPath(path: string): Locale {
  const first = normalizePath(path).split("/")[1];
  if (first === "en") return "en";
  if (first === "de") return "de";
  return defaultLocale;
}
