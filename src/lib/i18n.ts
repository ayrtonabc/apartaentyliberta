/**
 * i18n — helpers de idioma, rutas y traducciones.
 *
 * La definición de idiomas y el mapa de rutas viven en ~/data/locales.
 * Aquí solo se exponen las funciones que consumen las páginas y componentes.
 */

import pl from "~/data/translations/pl";
import en from "~/data/translations/en";
import de from "~/data/translations/de";
import {
  type Locale,
  locales,
  defaultLocale,
  localeMeta,
  translatePath,
  localeFromPath,
  normalizePath,
} from "~/data/locales";

export { type Locale, locales, defaultLocale, localeMeta, translatePath, normalizePath };
export type { LocaleMeta } from "~/data/locales";

/** El diccionario polaco define la forma canónica de las traducciones. */
export type Translations = typeof pl;

const translations: Record<Locale, Translations> = { pl, en, de } as Record<Locale, Translations>;

/**
 * Diccionario de traducciones para un idioma.
 * Si falta un idioma, cae a polaco.
 */
export function t(locale: Locale): Translations {
  return translations[locale] ?? translations[defaultLocale];
}

/** Detecta el idioma desde la URL de la petición. */
export function getLocaleFromUrl(url: URL): Locale {
  return localeFromPath(url.pathname);
}

/** Prefijo de URL de un idioma ("" para el idioma por defecto). */
export function localePrefix(locale: Locale): string {
  return localeMeta[locale].prefix;
}

/**
 * Construye un enlace interno en el idioma indicado.
 * Se pasa siempre la ruta "canónica" en polaco: localeLink("en", "/cennik/")
 * devuelve "/en/prices/".
 */
export function localeLink(locale: Locale, path: string): string {
  return translatePath(path, locale);
}

/** Ruta canónica (en polaco) a partir de la URL actual, para hreflang. */
export function canonicalPath(url: URL): string {
  const plPath = translatePath(url.pathname, "pl");
  return normalizePath(plPath);
}

/** URL absoluta de un idioma para una ruta canónica polaca. */
export function localizedUrl(
  locale: Locale,
  path: string,
  baseUrl = "https://apartamentyliberta.pl",
): string {
  const localized = translatePath(path, locale);
  return `${baseUrl}${localized}`;
}

/** Alias histórico usado por seo.ts. */
export function canonicalUrl(
  locale: Locale,
  path: string,
  baseUrl = "https://apartamentyliberta.pl",
): string {
  return localizedUrl(locale, path, baseUrl);
}

/** Enlaces alternativos para hreflang, incluido x-default. */
export function alternateLinks(
  path: string,
  baseUrl = "https://apartamentyliberta.pl",
): Array<{ hreflang: string; href: string }> {
  const links = locales.map((locale) => ({
    hreflang: localeMeta[locale].hreflang,
    href: localizedUrl(locale, path, baseUrl),
  }));

  links.push({ hreflang: "x-default", href: localizedUrl(defaultLocale, path, baseUrl) });

  return links;
}

/** ¿La ruta existe como página real en ese idioma? (usado por el selector) */
export function isLocalizedPath(path: string): boolean {
  return Boolean(path);
}
