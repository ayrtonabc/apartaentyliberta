/**
 * Reviews — opiniones reales de huéspedes.
 *
 * Fuentes públicas: Booking.com (9,9/10 · 18 opiniones) y Google (4,9/5 · 160
 * opiniones). Los datos de cada tarjeta viven en `reviews-imported.ts`: solo
 * nombre, puntuación, comentario y plataforma. Sin fechas, país ni tipo de
 * estancia, a petición del propietario.
 *
 * Los textos están en polaco. Las reseñas de Google llegaron en español
 * (traducción del navegador del propietario) y se tradujeron al polaco; la
 * única excepción es la reseña neerlandesa de Jirg, que se conserva en su
 * idioma original. Cada `<blockquote>` declara su `lang`.
 *
 * `rating` está siempre normalizado sobre la escala indicada en `ratingScale`.
 * La tarjeta lo convierte a 5 estrellas (Booking 9,0 → 4,5 estrellas).
 */

import { importedReviews, type ImportedReview } from "./reviews-imported";

export type ReviewSource = "booking" | "google";

export type Review = ImportedReview & {
  id: string;
  /** Sale en el carrusel de la portada */
  highlight?: boolean;
};

/**
 * Índices (en el orden de `reviews-imported.ts`) que se destacan en la portada.
 *
 * Se eligen a mano, no por nota: la primera tanda de Google incluye una reseña
 * de 1/5 (Mir Ela) y destacarla automáticamente habría puesto una queja en la
 * portada. Los tres primeros de Booking son 10/10, 10/10 y 10/10.
 *
 * El inicio de Booking se calcula, no se escribe: si mañana se añaden más
 * opiniones de Google, los índices fijos dejarían de señalar las de Booking.
 */
const bookingStart = importedReviews.findIndex((review) => review.source === "booking");
const HIGHLIGHTS = new Set([
  0,
  1,
  4,
  ...(bookingStart >= 0 ? [bookingStart, bookingStart + 1, bookingStart + 2] : []),
]);

export const reviews: Review[] = importedReviews.map((review, index) => ({
  id: `${review.source}-${String(index + 1).padStart(3, "0")}`,
  ...review,
  highlight: HIGHLIGHTS.has(index),
}));

export type AggregateRating = {
  source: ReviewSource;
  label: string;
  score: number;
  scale: 10 | 5;
  count: number;
  url?: string;
};

/**
 * Valoraciones agregadas por plataforma.
 *
 * IMPORTANTE: aquí NO hay una nota combinada, y es a propósito.
 *
 * Antes existía `getOverallScore()`, que ponderaba las dos fuentes en una sola
 * cifra sobre 10. Con los datos reales eso da 9,6, es decir una nota PEOR que la
 * de Booking (9,9) que además no existe en ninguna plataforma: es una invención
 * nuestra. Mostrar una puntuación propia calculada a partir de datos de
 * terceros no es defendible ante un cliente ni ante Google, que exige que las
 * valoraciones estructuradas se correspondan con reseñas reales y verificables.
 *
 * Por eso cada plataforma se muestra con SU nota y SU número de opiniones, sin
 * mezclarlas, y el total solo se usa como recuento ("178 opiniones"), nunca
 * como nota.
 */
export const aggregateRatings: AggregateRating[] = [
  {
    source: "booking",
    label: "Booking.com",
    score: 9.9,
    scale: 10,
    count: 18,
    /** Enlace corto que compartió el propietario para su ficha */
    url: "https://www.booking.com/Share-mBuVDTc",
  },
  {
    source: "google",
    label: "Google",
    score: 4.9,
    scale: 5,
    count: 160,
    url: "https://share.google/XID2TRgkLQCt73Lkj",
  },
];

/**
 * Suma de opiniones de todas las plataformas.
 *
 * Es un recuento, no una nota: sirve para decir "178 opiniones" sin inventar
 * ningún promedio.
 */
export function getTotalReviews(): number {
  return aggregateRatings.reduce((total, rating) => total + rating.count, 0);
}

/**
 * Opiniones ordenadas para el idioma del visitante.
 *
 * Se mezclan las plataformas a propósito: la portada no debe enseñar seis
 * tarjetas de Booking seguidas ni seis de Google. Las destacadas pesan más que
 * el idioma para que el carrusel sea el mismo en los tres mercados.
 */
export function reviewsForLocale(locale: "pl" | "en" | "de"): Review[] {
  const score = (review: Review) => {
    let value = 0;
    if (review.highlight) value += 25;
    /*
     * El idioma desempata, no manda: en polaco las tres destacadas de Booking
     * van primero; en inglés y alemán, las tres de Google. Sin el peso extra de
     * Booking, las dos plataformas se alternan en los tres mercados.
     */
    if (review.lang === locale) value += 10;
    return value;
  };
  return [...reviews].sort((a, b) => score(b) - score(a));
}
