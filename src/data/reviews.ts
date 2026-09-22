/**
 * Reviews — opiniones reales de huéspedes.
 *
 * Fuentes públicas: Booking.com (9,9/10 · 17 opiniones) y Google (4,9/5 · 159
 * opiniones). Google pesa mucho más en volumen, así que se muestran las dos por
 * separado y con el mismo peso visual; ver la nota sobre no combinar las notas
 * más abajo, junto a `aggregateRatings`.
 *
 * El texto de cada opinión se guarda en su idioma original y se agrupa por
 * idioma para poder mostrar la versión adecuada en cada mercado: una opinión
 * en alemán en la web alemana vale mucho más que un texto en polaco.
 *
 * `rating` está siempre normalizado sobre la escala indicada en `ratingScale`.
 */

export type ReviewSource = "booking" | "google";

export type Review = {
  id: string;
  author: string;
  /** País de origen del huésped, en su propio idioma de mercado */
  country: string;
  /** YYYY-MM */
  date: string;
  /** 1-10 para Booking, 1-5 para Google */
  rating: number;
  ratingScale: 10 | 5;
  /** Idioma original de la opinión */
  lang: "pl" | "en" | "de" | "fr";
  /** Texto literal del huésped */
  text: string;
  source: ReviewSource;
  /** Tipo de estancia, útil como contexto */
  stay?: { pl: string; en: string; de: string };
  highlight?: boolean;
};

export const reviews: Review[] = [
  {
    id: "booking-001",
    author: "Marzena",
    country: "Polska",
    date: "2025-08",
    rating: 10,
    ratingScale: 10,
    lang: "pl",
    text: "Wspaniały apartament z widokiem na jezioro, bardzo czysto i właściciel, który naprawdę dba o gości. Bania góralska wieczorem to absolutny highlight pobytu. Na pewno wrócimy.",
    stay: { pl: "Rodzina z dziećmi", en: "Family with children", de: "Familie mit Kindern" },
    source: "booking",
    highlight: true,
  },
  {
    id: "booking-002",
    author: "Thomas",
    country: "Deutschland",
    date: "2025-07",
    rating: 10,
    ratingScale: 10,
    lang: "de",
    text: "Traumhafte Lage direkt am See, sehr modern und blitzsauber. Der Hot Tub im Garten war das Highlight für die Kinder. Äußerst freundlicher Gastgeber, der jeden Wunsch organisiert.",
    stay: { pl: "Rodzina z dziećmi", en: "Family with children", de: "Familie mit Kindern" },
    source: "booking",
    highlight: true,
  },
  {
    id: "booking-003",
    author: "Anna",
    country: "Polska",
    date: "2025-07",
    rating: 9,
    ratingScale: 10,
    lang: "pl",
    text: "Piękne miejsce na Mazurach. Apartament duży i wygodny, świetnie wyposażona kuchnia, plaża dosłownie sto metrów od domu. Wracamy tu trzeci raz.",
    stay: { pl: "Dwie pary", en: "Two couples", de: "Zwei Paare" },
    source: "booking",
  },
  {
    id: "booking-004",
    author: "Marta",
    country: "Polska",
    date: "2025-06",
    rating: 10,
    ratingScale: 10,
    lang: "pl",
    text: "Cudowne miejsce na wypoczynek z rodziną. Komfortowy dom, piękne widoki, jezioro zaraz za płotem. Kontakt z właścicielem wzorowy — wszystko załatwione przed przyjazdem.",
    stay: { pl: "Rodzina", en: "Family", de: "Familie" },
    source: "booking",
  },
  {
    id: "booking-005",
    author: "Karin",
    country: "Deutschland",
    date: "2025-09",
    rating: 10,
    ratingScale: 10,
    lang: "de",
    text: "Sehr ruhige Lage, perfekt zum Abschalten. Die Wohnung ist großzügig und hochwertig ausgestattet, der Steg am See ein Traum. Wir kommen im Herbst wieder.",
    stay: { pl: "Para", en: "Couple", de: "Paar" },
    source: "booking",
  },
  {
    id: "google-001",
    author: "Krzysztof",
    country: "Polska",
    date: "2025-05",
    rating: 5,
    ratingScale: 5,
    lang: "pl",
    text: "Miejsce idealne na spokojny wypoczynek. Apartamenty nowoczesne, czyste, z pełnym wyposażeniem. Widok na jezioro Szeląg o zachodzie — niezapomniany. Polecam serdecznie.",
    stay: { pl: "Weekend we dwoje", en: "Weekend for two", de: "Wochenende zu zweit" },
    source: "google",
    highlight: true,
  },
  {
    id: "google-002",
    author: "Sophie",
    country: "France",
    date: "2025-05",
    rating: 5,
    ratingScale: 5,
    lang: "fr",
    text: "Un séjour parfait. Appartement spacieux, vue magnifique sur le lac, hôte très accueillant. Le bain nordique extérieur était un vrai plus. Merci !",
    stay: { pl: "Para", en: "Couple", de: "Paar" },
    source: "google",
  },
  {
    id: "google-003",
    author: "Michael",
    country: "Deutschland",
    date: "2025-08",
    rating: 5,
    ratingScale: 5,
    lang: "en",
    text: "Everything was exactly as described — spotless apartment, private hot tub, and the lake a two-minute walk away. The owner's boat trip was the best part of our stay.",
    stay: { pl: "Przyjaciele", en: "Friends", de: "Freunde" },
    source: "google",
  },
];

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
 * mezclarlas, y el total solo se usa como recuento ("176 opiniones"), nunca
 * como nota.
 */
export const aggregateRatings: AggregateRating[] = [
  {
    source: "booking",
    label: "Booking.com",
    score: 9.9,
    scale: 10,
    count: 17,
    /** Enlace corto que compartió el propietario para su ficha */
    url: "https://www.booking.com/Share-mBuVDTc",
  },
  {
    source: "google",
    label: "Google",
    score: 4.9,
    scale: 5,
    count: 159,
    url: "https://share.google/XID2TRgkLQCt73Lkj",
  },
];

/**
 * Suma de opiniones de todas las plataformas.
 *
 * Es un recuento, no una nota: sirve para decir "176 opiniones" sin inventar
 * ningún promedio.
 */
export function getTotalReviews(): number {
  return aggregateRatings.reduce((total, rating) => total + rating.count, 0);
}

/** Opiniones ordenadas priorizando el idioma del visitante. */
export function reviewsForLocale(locale: "pl" | "en" | "de"): Review[] {
  const score = (review: Review) => {
    let value = 0;
    if (review.lang === locale) value += 100;
    else if (locale === "en" && review.lang === "fr") value += 60;
    if (review.highlight) value += 20;
    if (review.ratingScale === 10) value += review.rating;
    return value;
  };
  return [...reviews].sort((a, b) => score(b) - score(a));
}
