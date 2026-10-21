# Apartamenty Liberta

Sitio de Apartamenty Liberta en Stare Jabłonki (Mazury), construido con Astro.
Contenido en polaco, inglés y alemán; reservas a través de Booking.com.

- Producción: <https://apartamentyliberta.pl/>
- Desarrollo: `npm run dev` → <http://localhost:4321>
- Producción local: `npm run build && npm start` → <http://localhost:8080>

## Stack

- Astro 6 con `output: "server"` y adaptador de Node (Vercel con `VERCEL=1`).
- CSS propio con tokens; sin framework de UI ni librerías de carrusel.
- `sharp` para generar WebP responsivos, LQIP y el manifiesto de imágenes.
- JavaScript mínimo: carrusel de bienvenida, acordeón de reseñas, menú móvil,
  calculadora retirada y reproductor de YouTube cargado solo al pulsar play.
- Sin API de reservas: enlaces profundos a Booking.com.

## Estructura

```text
src/
├── components/
│   ├── layout/      Header · Footer · MobileCTA · LanguageSwitcher
│   ├── ui/          Icon · SmartImage · PageHero · SectionHeading
│   │                ReviewLogo · ReviewStars · RatingSource · RatingSummary
│   ├── content/     ApartmentCard · AttractionCardHome · AttractionRow
│   │                Gallery · Testimonials · TestimonialCard · VideoCard
│   │                FaqSection · MapEmbed · SocialLinks
│   └── sections/    Hero · TrustStrip · WelcomeSection · WellnessSection
│                    AmenitiesShowcase · PricingShowcase · PricingPage
│                    VideoWallSection · AttractionsGrid/Page · LocationPage
│                    ReviewsPage · BookingPage · HomeContent
├── data/            site · booking · apartments · facilities · attractions
│                    amenities · reviews · videos · faq · locales · icons
│                    translations/{pl,en,de} · image-manifest.json
├── layouts/         BaseLayout (SEO, hreflang, JSON-LD, preload)
├── lib/             i18n · seo · format
├── middleware.ts    Compresión y cabeceras para respuestas SSR
├── pages/           Rutas PL + en/ + de/
├── styles/          tokens · base · typography · layout · components · utilities
└── assets/          Wordmark del header
```

## Orden de la portada

Hero → TrustStrip → Bienvenida → Apartamentos → Sobre el complejo → Razones →
Equipamiento → Wellness → Experiencias → Ubicación → Opiniones → Cennik → FAQ →
Vídeo → CTA.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Desarrollo con `predev` de assets |
| `npm run build` | Build de producción + Brotli + limpieza del deploy |
| `npm run build:vercel` | Build con adaptador de Vercel |
| `npm start` | Servidor de producción (`PORT`/`HOST`) |
| `npm run check` | `astro check` |
| `npm test` | Estructura, sintaxis, rutas e imágenes |
| `npm run images:responsive` | Variantes WebP + manifiesto LQIP |
| `npm run images:import` | Importa fotos nuevas del propietario |
| `npm run images:wellness` | Importa las fotos de sauna/ognisko |
| `npm run images:posters` | Miniaturas WebP de los vídeos de YouTube |
| `npm run images:download` | Descarga las fotos originales del sitio anterior |
| `npm run compress` | Re-precomprime `dist/client` |
| `npm run prune` | Saca `public/import-original` del deploy |
| `npm run clean` | Limpia cachés locales |
| `npm run fresh` | Limpia cachés y arranca `astro dev` |

Las carpetas `dist/`, `.vercel/`, `.astro/`, `node_modules/`, `.audit/` y
`public/import-original/` están ignoradas por git.

## Imágenes y rendimiento

- `SmartImage` genera `srcset`, LQIP, dimensiones y `loading="lazy"`; la imagen
  LCP usa `priority`.
- `public/assets/responsive/` contiene las variantes; no se editan a mano.
- El hero precarga `hero-poster.webp` (80 KB) y sirve vídeo móvil de **0,61 MB**
  y escritorio de **4,3 MB**, no el máster de 17,6 MB.
- El carrusel de bienvenida usa ocho fotos de `public/assets/witaj`, cambia cada
  3 s, se pausa al pasar el ratón/enfocar, al ocultar la pestaña y con
  `prefers-reduced-motion`.
- El logo blanco del header es un WebP de ~10 KB (antes 207 KB).
- Home: **~39 KB Brotli**; deploy de `dist/client`: **~72 MB**.
- Todas las imágenes declaradas se validan con `npm run test:images`.

## Reservas

La reserva se cierra en Booking.com, sin motor propio ni API:

- `src/data/booking.ts` construye la ficha oficial con `checkin`, `checkout`,
  `group_adults`, `no_rooms` y `selected_currency`.
- El buscador del hero y los CTA abren Booking en una pestaña nueva.
- `/rezerwacja/`, `/en/booking/` y `/de/reservierung/` son informativas.
- Las antiguas URLs de resultados redirigen con 302 a Booking.
- La CSP permite `form-action` a `booking.com`.

## SEO / AEO / GEO

- Canonical, hreflang y `x-default` en las tres lenguas.
- JSON-LD: `Organization`, `LodgingBusiness` con un único `AggregateRating`,
  `ReserveAction`, `WebSite`, `Accommodation` + `Offer`, `BreadcrumbList`,
  `FAQPage` (solo las preguntas visibles) e `ItemList` de vídeos.
- NAP, `geo`, `hasMap`, `areaServed`, `sameAs` (Facebook, Instagram y Booking).
- Sitemap de 43 URLs, `robots.txt` abierto; las redirecciones de búsqueda quedan
  fuera del sitemap.
- Un `<h1>` por página, alt traducidos y jerarquía de encabezados completa.

## Despliegue

Requisitos: Node ≥ 22.18.

```bash
npm ci
npm run build
npm start
```

`server.mjs` sirve el HTML pre-renderizado con Brotli/Gzip, las redirecciones de
búsqueda y el 404. En Vercel:

```bash
npm run build:vercel
```

Cabeceras: CSP, HSTS (si llega `X-Forwarded-Proto: https`), `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy` y cache inmutable para `/_astro/*`.

Variables: solo `PORT` y `HOST` (ver `.env.example`).
