/**
 * Format utilities for prices, dates, numbers, coordinates.
 */

import { site } from "~/data/site";

/**
 * Format a number as PLN currency.
 * 700 → "700 zł"
 * 1234.5 → "1 234,50 zł"
 */
export function formatPLN(value: number, options: { withDecimals?: boolean } = {}): string {
  const formatter = new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: options.withDecimals ? 2 : 0,
    maximumFractionDigits: options.withDecimals ? 2 : 0,
  });
  return formatter.format(value);
}

/**
 * Format a price range.
 * { low: 700, high: 900 } → "od 700 zł / 900 zł / noc"
 */
export function formatPriceRange(low: number, high: number, suffix = "/ noc"): string {
  return `${formatPLN(low)}–${formatPLN(high)} ${suffix}`;
}

/**
 * Format a date for display.
 * Uses Polish conventions.
 */
export function formatDate(date: Date | string, locale: "pl" | "en" | "de" = "pl"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale === "pl" ? "pl-PL" : locale === "de" ? "de-DE" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Format coordinates for display.
 * 53.7034, 20.0778 → `53°42'12.1" N, 20°04'40.8" E`
 */
export function formatCoordinates(lat: number, lng: number): { lat: string; lng: string } {
  function toDMS(deg: number, isLat: boolean): string {
    const abs = Math.abs(deg);
    const d = Math.floor(abs);
    const minFloat = (abs - d) * 60;
    const m = Math.floor(minFloat);
    const s = ((minFloat - m) * 60).toFixed(1);
    const dir = isLat ? (deg >= 0 ? "N" : "S") : (deg >= 0 ? "E" : "W");
    return `${d}°${m.toString().padStart(2, "0")}'${s.padStart(4, "0")}" ${dir}`;
  }
  return {
    lat: toDMS(lat, true),
    lng: toDMS(lng, false),
  };
}

/**
 * Format a phone number for tel: link.
 * 668 157 409 → +48668157409
 */
export function formatTelLink(phone: string): string {
  return phone.replace(/[\s\-()]/g, "");
}

/**
 * Format a number of guests.
 * 1 → "1 osoba"
 * 6 → "6 osób"
 */
export function formatGuests(n: number, locale: "pl" | "en" | "de" = "pl"): string {
  if (locale === "pl") {
    if (n === 1) return "1 osoba";
    if (n >= 2 && n <= 4) return `${n} osoby`;
    return `${n} osób`;
  }
  if (locale === "de") {
    return n === 1 ? "1 Person" : `${n} Personen`;
  }
  return n === 1 ? "1 guest" : `${n} guests`;
}

/**
 * Get the full address string for schema.org.
 */
export function fullAddress(): string {
  return `${site.address.locality}, ${site.address.region}, ${site.address.country}`;
}
