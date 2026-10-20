/**
 * booking.ts — enlaces profundos a Booking.com, sin API.
 *
 * El cliente no quiere un motor de reservas propio: la reserva se cierra en
 * Booking.com. Aquí se construye la URL oficial con los parámetros que Booking
 * entiende (`checkin`, `checkout`, `group_adults`, `group_children`,
 * `no_rooms`). No se llama a ninguna API ni se guardan fechas en el servidor.
 *
 * La URL base es la ficha directa del alojamiento (la misma a la que redirige
 * el enlace corto del propietario). Se usa la variante de idioma del sitio para
 * que el huésped no aterrice en una ficha en otro idioma.
 */
import type { Locale } from "~/lib/i18n";

const PROPERTY = {
  pl: "https://www.booking.com/hotel/pl/apartamenty-liberta.pl.html",
  en: "https://www.booking.com/hotel/pl/apartamenty-liberta.en-gb.html",
  de: "https://www.booking.com/hotel/pl/apartamenty-liberta.de.html",
} as const;

export type BookingParams = {
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  children?: number;
  rooms?: number;
};

/** Fecha ISO válida; descarta parámetros basura de la URL. */
function validDate(value: string | null | undefined): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

/** Ficha limpia, sin parámetros de búsqueda, para sameAs y ReserveAction. */
export function bookingProfileUrl(locale: Locale): string {
  return PROPERTY[locale];
}

export function bookingUrl(locale: Locale, params: BookingParams = {}): string {
  const url = new URL(PROPERTY[locale]);

  const checkIn = validDate(params.checkIn);
  const checkOut = validDate(params.checkOut);
  if (checkIn) url.searchParams.set("checkin", checkIn);
  if (checkOut) url.searchParams.set("checkout", checkOut);

  if (params.guests && params.guests > 0) {
    url.searchParams.set("group_adults", String(Math.min(params.guests, 8)));
  }
  if (params.children && params.children > 0) {
    url.searchParams.set("group_children", String(Math.min(params.children, 6)));
  }
  url.searchParams.set("no_rooms", String(params.rooms && params.rooms > 0 ? params.rooms : 1));
  url.searchParams.set("selected_currency", "PLN");

  return url.toString();
}
