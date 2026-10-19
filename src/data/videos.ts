/**
 * Vídeos grabados en Apartamenty Liberta.
 *
 * Los títulos y artistas salen de los metadatos públicos de YouTube
 * (`youtube.com/oembed`); no se inventan nombres ni fechas. Las miniaturas se
 * descargan con `scripts/import-video-posters.mjs` y se sirven desde el propio
 * dominio: la CSP no permite imágenes de terceros y así no se contacta con
 * Google antes de que el visitante pulse play.
 *
 * `category` distingue los telediscos de los dos vídeos que no son música
 * (boda y presentación del complejo), porque el propietario los quiere todos
 * pero no todos son artistas.
 */
export type VideoCategory = "music" | "wedding" | "resort";

export type Video = {
  id: string;
  slug: string;
  artist: string;
  title: string;
  category: VideoCategory;
  poster: string;
  href: string;
  embed: string;
  featured?: boolean;
};

export const videos: Video[] = [
  {
    id: "kPhunrv9RDc",
    slug: "fisher-nie-moge-ci-wiele-dac",
    artist: "Fisher",
    title: "Nie Mogę Ci Wiele Dać",
    category: "music",
    poster: "/assets/videos/fisher-nie-moge-ci-wiele-dac.webp",
    href: "https://www.youtube.com/watch?v=kPhunrv9RDc",
    embed: "https://www.youtube-nocookie.com/embed/kPhunrv9RDc",
    featured: true,
  },
  {
    id: "R4yK6LTpaZs",
    slug: "fisher-bez-szans",
    artist: "Fisher",
    title: "Bez Szans",
    category: "music",
    poster: "/assets/videos/fisher-bez-szans.webp",
    href: "https://www.youtube.com/watch?v=R4yK6LTpaZs",
    embed: "https://www.youtube-nocookie.com/embed/R4yK6LTpaZs",
  },
  {
    id: "cYMXG1TuKh4",
    slug: "explozja-nowy-sprzet",
    artist: "Explozja",
    title: "Nowy Sprzęt",
    category: "music",
    poster: "/assets/videos/explozja-nowy-sprzet.webp",
    href: "https://www.youtube.com/watch?v=cYMXG1TuKh4",
    embed: "https://www.youtube-nocookie.com/embed/cYMXG1TuKh4",
  },
  {
    id: "leS87Odlles",
    slug: "lena-tancz-ze-mna-tancz",
    artist: "Lena z Zespołem",
    title: "Tańcz ze mną, tańcz",
    category: "music",
    poster: "/assets/videos/lena-tancz-ze-mna-tancz.webp",
    href: "https://www.youtube.com/watch?v=leS87Odlles",
    embed: "https://www.youtube-nocookie.com/embed/leS87Odlles",
  },
  {
    id: "C5ypS7MdNlI",
    slug: "fisher-tylko-dla-ciebie",
    artist: "Fisher",
    title: "Tylko dla Ciebie",
    category: "music",
    poster: "/assets/videos/fisher-tylko-dla-ciebie.webp",
    href: "https://www.youtube.com/watch?v=C5ypS7MdNlI",
    embed: "https://www.youtube-nocookie.com/embed/C5ypS7MdNlI",
  },
  {
    id: "T4-p7wp_KB8",
    slug: "daniel-dabrowski-byle-bylo-tak",
    artist: "Daniel Dąbrowski",
    title: "Byle było tak (K. Krawczyk Cover)",
    category: "music",
    poster: "/assets/videos/daniel-dabrowski-byle-bylo-tak.webp",
    href: "https://www.youtube.com/watch?v=T4-p7wp_KB8",
    embed: "https://www.youtube-nocookie.com/embed/T4-p7wp_KB8",
  },
  {
    id: "8UKmPt5Syng",
    slug: "wesele-w-liberta",
    artist: "VlogoVentura",
    title: "Twoje Wesele w Apartamentach Liberta",
    category: "wedding",
    poster: "/assets/videos/wesele-w-liberta.webp",
    href: "https://www.youtube.com/watch?v=8UKmPt5Syng",
    embed: "https://www.youtube-nocookie.com/embed/8UKmPt5Syng",
  },
  {
    id: "uKUkRSwro1Y",
    slug: "liberta-luksus-na-mazurach",
    artist: "VlogoVentura",
    title: "Apartamenty Liberta — Luksus na Mazurach",
    category: "resort",
    poster: "/assets/videos/liberta-luksus-na-mazurach.webp",
    href: "https://www.youtube.com/watch?v=uKUkRSwro1Y",
    embed: "https://www.youtube-nocookie.com/embed/uKUkRSwro1Y",
  },
];
