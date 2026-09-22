# Apartamenty Liberta — Nueva experiencia digital

Sitio web de **Apartamenty Liberta** (Stare Jabłonki, Mazury): cuatro apartamentos
de 80 m² con balia góralska y vistas al Jezioro Szeląg Wielki.

Construido con Astro 5, tres idiomas (PL / EN / DE), SEO internacional completo y
un pipeline de imágenes propio. Pensado como demo de venta y como base de
producción.

---

## Arranque rápido

```bash
npm install
npm run images:download:ps   # fotos del sitio actual (solo la primera vez)
npm run dev                  # http://localhost:4321
```

Build y servidor de producción:

```bash
npm run build                # genera dist/ + precomprime Brotli/gzip
npm start                    # servidor Node con compresión y cabeceras
```

---

## Stack

| Pieza | Elección | Por qué |
|---|---|---|
| Framework | Astro 5 (`output: server` + SSG por página) | HTML estático para el contenido, runtime solo para la API |
| Estilos | CSS propio con tokens | Sin dependencias, sin purge, control total del diseño |
| Tipografía | Serif editorial + sans de sistema | Cero webfonts: sin FOIT, sin peticiones a terceros |
| Imágenes | `sharp` + manifiesto generado en build | `srcset` real, WebP y placeholder LQIP |
| Formularios | API Routes + Resend | Emails al propietario y al huésped, en su idioma |
| Validación | Zod | Misma validación en cliente y servidor |

### Lo que NO usamos

- ❌ React / Vue / Svelte → el sitio no lo necesita, y ahorra ~100 KB de JS
- ❌ Tailwind ni frameworks CSS → tokens propios, más rápido de mantener
- ❌ WordPress ni CMS externo → contenido en TypeScript tipado
- ❌ jQuery / librerías de carrusel → 3 componentes con JS nativo

---

## Sistema de diseño

Todo vive en `src/styles/`, con un único punto de entrada (`global.css`):

| Archivo | Contenido |
|---|---|
| `tokens.css` | Color, tipografía fluida, espaciado, radios, sombras, movimiento |
| `base.css` | Reset moderno, foco visible, accesibilidad, grano |
| `typography.css` | Escala editorial, titulares, `prose`, precios, citas |
| `layout.css` | Contenedores, secciones, `split`, `bento`, grids, divisores |
| `components.css` | Botones, formularios, cards, badges, chips, tablas, acordeón |
| `utilities.css` | Visibilidad responsive, espaciado, ratios |

**Dirección de arte:** verde bosque profundo (tomado del isotipo de marca), papel
cálido, latón y agua. Titulares en serif de alto contraste, interfaz en sans de
sistema. Nada de plantillas genéricas.

**Clases base más usadas:** `.section`, `.container`, `.btn` (con
`--primary | --outline | --invert | --light | --link`), `.card`, `.badge`,
`.chip`, `.glass`, `.table`, `.accordion`, `[data-reveal]`.

---

## i18n

Tres idiomas con el polaco como idioma por defecto (sin prefijo de URL):

| Idioma | Prefijo | Ejemplo |
|---|---|---|
| Polski | — | `/apartamenty/liberta-i/` |
| English | `/en` | `/en/apartments/liberta-i/` |
| Deutsch | `/de` | `/de/ferienwohnungen/liberta-i/` |

- **Fuente única de verdad de rutas:** `src/data/locales.ts` (`routeMap`). Evita
  que `/en/` o `/de/` enlacen a URLs en polaco.
- **Diccionarios:** `src/data/translations/{pl,en,de}.ts`. El tipo de `en` y `de`
  se valida contra `pl`, así que **no puede faltar una clave**.
- **Selector de idioma con banderas** (`LanguageSwitcher.astro`): banderas SVG
  propias (los emoji de bandera no se renderizan en Windows), enlaza a la misma
  página en el otro idioma, navegación con teclado y cierre con Escape.
- **Contenido de las páginas compartido:** `HomeContent.astro`,
  `ApartmentDetail.astro`, `ApartmentsIndex.astro`, `PricingPage.astro`, etc.
  renderizan los tres idiomas; las páginas en `src/pages/{en,de}/` son
  envoltorios de 25 líneas con su metadata SEO.

### hreflang y canonical

Cada página declara su ruta canónica en polaco (`canonicalPath`), y desde ahí se
generan el canonical, los tres `hreflang` y el `x-default`. Sin esto, `/en/` y
`/de/` se autodeclararían duplicados del polaco.

---

## SEO

- `canonical` + `hreflang` (pl-PL, en-GB, de-DE, x-default) correctos por idioma
- JSON-LD: `Organization`, `LodgingBusiness` (con `AggregateRating`),
  `WebSite`, `Accommodation` + `Offer` por apartamento, `ItemList`,
  `BreadcrumbList`, `FAQPage`
- Open Graph y Twitter Cards con imágenes 1200×630 generadas (`public/og-*.jpg`)
- `sitemap-index.xml` + `sitemap-0.xml` (43 URLs, sin `404` ni `/api/`)
- `robots.txt` con `Disallow: /api/`
- Metadatos geográficos (`geo.position`, `ICBM`) para búsquedas locales
- Un solo `<h1>` por página y `alt` descriptivo y traducido en todas las imágenes

---

## Rendimiento

Objetivos: LCP bajo, CLS 0, sin peticiones bloqueantes.

| Técnica | Detalle |
|---|---|
| CSS inline | Cada página se sirve autocontenida: **0 peticiones CSS** |
| Brotli en build | `postbuild` precomprime a `.br`/`.gz` (hasta nivel 11) |
| Servidor propio | `server.mjs` sirve la variante precomprimida + cabeceras |
| Imágenes responsivas | 4 anchos por foto en WebP vía `scripts/responsive-images.mjs` |
| Blur-up | Placeholder LQIP de ~0.4 KB incrustado en el HTML |
| Sin layout shift | `width`/`height` reales de cada imagen |
| Preload del LCP | `<link rel="preload" as="image" fetchpriority="high">` |
| JS diferido | La rotación del hero usa `loading="lazy"` para las diapositivas 2+ |
| Salto de pintado | `content-visibility` en bloques lejanos |

Resultados medidos sobre el build de producción:

| Página | HTML sin comprimir | Brotli |
|---|---|---|
| Home | 201 KB | **28 KB** |
| Ficha de apartamento | 153 KB | **24 KB** |
| Cennik | 107 KB | **18 KB** |
| FAQ | 98 KB | **16 KB** |

### Cabeceras

`server.mjs` y `src/middleware.ts` aplican:

- `/_astro/*` → `Cache-Control: public, max-age=31536000, immutable`
- Imágenes → `max-age=604800, stale-while-revalidate=86400`
- HTML → `max-age=0, must-revalidate`
- `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
  `Permissions-Policy`, `Cross-Origin-Opener-Policy`
- `Content-Encoding: br` con `Vary: Accept-Encoding`

---

## Estructura

```
src/
├── components/
│   ├── layout/      Header · Footer · MobileCTA · LanguageSwitcher
│   ├── ui/          Flag · Icon · SmartImage · PageHero · SectionHeading
│   ├── content/     ApartmentCard · BookingForm · Gallery · Testimonials
│   │                FaqSection · ContactBlock · MapEmbed
│   └── sections/    Hero · TrustStrip · AmenitiesShowcase · AttractionsGrid
│                    CtaBand · HomeContent · ApartmentDetail · ApartmentsIndex
│                    PricingPage · AttractionsPage · LocationPage
│                    BookingPage · ReviewsPage
├── data/            site · apartments · amenities · attractions · reviews
│                    faq · locales · icons · translations/{pl,en,de}
│                    image-manifest.json (generado)
├── layouts/         BaseLayout (SEO, hreflang, JSON-LD, preload)
├── lib/             i18n · seo · format · availability
├── middleware.ts    Compresión y cabeceras para respuestas SSR
├── pages/           Rutas PL + en/ + de/ + api/
├── styles/          tokens · base · typography · layout · components
│                    utilities · global
└── assets/          Logo del header y del footer (optimizados)
```

---

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (con predev de assets) |
| `npm run build` | Build de producción + precompresión Brotli |
| `npm start` | Servidor de producción en `PORT` (por defecto 8080) |
| `npm run typecheck` | `tsc --noEmit` sobre todo el proyecto |
| `npm run test:structure` | Valida estructura, claves i18n y contaminación de idioma |
| `npm run test:syntax` | Comprueba comillas y sintaxis de los `.astro` |
| `npm run images:responsive` | Regenera variantes WebP + manifiesto LQIP |
| `npm run availability:update` | Importa el calendario iCal de Booking.com |
| `npm run compress` | Re-precomprime `dist/client` sin recompilar |
| `npm run audit:shots` | Capturas de todas las páginas y secciones con Chrome headless |
| `npm run audit:styles` | Vuelca los estilos computados reales (contraste, tamaños, alineación) |
| `npm run clean` | Limpia cachés (`.astro`, `dist`, `node_modules/.vite`) |

### Portada sin scroll

La portada se dimensiona con la **altura de la ventana**, no solo con el ancho.
Medido con `npm run audit:hero` sobre las tres traducciones:

| Ventana | Titular | Cabe entero |
|---|---|---|
| 1680×1050 | 72 px, 2–3 líneas | Sí |
| 1440×900 | 72 px, 2–3 líneas | Sí |
| 1440×800 | 70 px, 2 líneas | Sí |
| 1440×720 | 63 px, 2 líneas | Sí |
| 1280×800 | 70 px, 2–3 líneas | Sí |
| 390×844 | 32 px, 2 líneas | Sí |
| 360×640 | 30 px, 2 líneas | Sí |

Por debajo de **320×568** (iPhone SE de 1.ª generación, ~0.1 % del tráfico) el
hero hace scroll de ~40 px: el titular necesita una tercera línea y recortar
más texto perjudicaría la lectura. Es el único caso que no cumple.

El titular usa `clamp(2rem, min(8.2vw, 8.7svh), 4.5rem)`: el ancho manda en
móvil y la altura en escritorio. Los valores no son estimaciones — salen de
`scripts/measure-hero-sweep.mjs`, que barre cuerpo × ancho sobre el DOM real y
localiza el corte a 2 líneas (28ch, 4.5rem para las tres traducciones).

### Auditoría de diseño

`scripts/audit-shots.mjs` y `scripts/audit-computed.mjs` levantan Chrome por el
protocolo DevTools contra el servidor local y guardan en `.audit/` las capturas
(escritorio y móvil) y una tabla de estilos computados. Sirven para revisar el
diseño con datos en lugar de impresiones: contraste real de cada texto, tamaños
efectivos y coherencia de la paleta.

```bash
npm run build
npm start                       # en otra terminal
npm run audit:shots 8080
npm run audit:styles 8080
npm run audit:hero 8080         # ¿cabe la portada sin scroll?
npm run audit:header 8080       # logo, nav y color del texto al hacer scroll
npm run audit:lang 8080         # ¿el desplegable de idioma es clicable?
node scripts/check-social-filter.mjs 8080 /        # marcas en blanco sobre el hero
node scripts/check-social-filter.mjs 8080 /cennik/ # marcas filtradas en fondo claro
node scripts/capture-cards.mjs 8080               # tarjetas de apartamento: medidas y capturas
```

#### Posición del contenido del hero

El bloque de la portada va **centrado verticalmente**, no pegado al pie.

Con `align-items: flex-end` quedaba con 50 px por debajo del buscador y hasta
400 px libres por encima: el mensaje se leía descolgado hacia el pie. Centrado,
el aire se reparte (236 px arriba / 130 abajo a 1440×900) y el titular sube a la
zona donde el plano del dron se ve mejor.

```bash
node scripts/measure-hero-position.mjs 8080 1440 900 /
```

Ese script da las dos distancias que importan —hueco sobre el eyebrow y hueco
bajo el buscador— y se comprobó en **ocho ventanas × tres idiomas**: 24
combinaciones, **cero desbordes**. La más ajustada es 320×568 en alemán, con
133 px arriba y 51 abajo.

Ojo con dos cosas al tocar esta zona:

- **La altura del hero depende del contenido**, no al revés
  (`min-height: min(100svh, 52rem)`). Por eso el alemán, que ocupa más líneas,
  tiene menos aire que el polaco en la misma ventana.
- El scrim está medido para la franja donde cae el texto. **Si se mueve el
  bloque hay que volver a medir el contraste** con
  `scripts/measure-hero-contrast.mjs`: la nueva posición puede caer sobre una
  parte más clara del vídeo.

#### Vídeo del hero

> **REGLA: el vídeo NO se corta.**
>
> Este vídeo se recortaba a 1,5 s y se reproducía en bucle de ida y vuelta para
> que pesara poco. El propietario lo rechazó el 26/09: el plano enseña el complejo
> entero y con tres segundos solo se ve un trozo del recorrido.
>
> Se permite optimizar **peso y velocidad de carga**. Nunca quitar metraje ni
> bajar la resolución del archivo de escritorio.
>
> `tests/validate-structure.mjs` comprueba las dos cosas: que la duración coincida
> con la del máster (±0,5 s) y que `hero.mp4` pese menos que él. Se verificó que
> la comprobación **detecta de verdad** un corte: truncando el archivo a 3 s salta
> el error.

El fondo de la portada es un vídeo sin audio y sin controles. Se sustituyó el
carrusel de tres fotos: el vídeo da movimiento real y elimina el temporizador, los
puntos de navegación y sus estados.

```bash
node scripts/encode-hero-video.mjs          # 1920 px · crf 34 · completo
node scripts/encode-hero-video.mjs 1920 32  # más calidad, más peso
```

Produce en `public/assets/video/`:

| Archivo | Peso | Uso |
|---|---|---|
| `hero.mp4` | 8,9 MB | escritorio, 1920 px (el nativo del máster), 56 s |
| `hero-movil.mp4` | 4,7 MB | móvil (≤767 px), 960 px, 56 s |
| `hero-poster.webp` | 80 KB | póster: primer fotograma |

**Por qué 8,9 MB y no menos.** El máster son 11,36 MB a 1483 kbps: ya está muy
ajustado, así que recodificarlo a la misma resolución sale **más pesado** que él.
Medido con `scripts/tune-hero-res.mjs`:

| Ancho | CRF | Peso | SSIM |
|---|---|---|---|
| 1920 | 32 | 10,9 MB | 0,973 |
| **1920** | **34** | **8,9 MB** | **0,966** |
| 1600 | 32 | 8,6 MB | 0,961 |
| 1280 | 32 | 5,8 MB | 0,954 |
| 960 | 30 | 4,7 MB | 0,958 |

A 1920 el suelo está en unos 8,9 MB. Bajar de 6 MB exige bajar a 960-1280 px, y
eso está descartado. **La velocidad se gana por otras vías, que no cuestan
calidad:**

1. **Sin audio.** La pista AAC son ~250 KB que nadie oye, y algunos navegadores
   son más estrictos con el autoplay si el vídeo trae sonido.
2. **`+faststart`.** Mueve el índice del MP4 al principio, así el navegador
   reproduce **antes** de descargar el archivo entero. Esto es lo que de verdad
   hace que cargue rápido: el usuario ve movimiento a los pocos cientos de KB.
3. **El póster** (80 KB) se pinta al instante, así que nunca hay un hueco vacío.
4. **25 fps en vez de 50.** Es un plano de dron lento, a 25 se ve igual y el
   navegador decodifica la mitad de fotogramas.
5. **CRF 34**, que a 56 s es la diferencia entre 8,9 y 17,5 MB.

**El velo (scrim) se midió, no se ajustó a ojo.** En la franja del texto el
contraste real de cada texto sobre fotogramas del vídeo:

```bash
node scripts/measure-hero-contrast.mjs 8080 1440
node scripts/verify-video-advances.mjs 8080 1440   # ¿reproduce?
node scripts/tune-hero-res.mjs                     # ¿qué pesa cada opción?
```

Si se cambia el vídeo o el brillo del plano, hay que **volver a medir el
contraste**: el titular está sobre imagen en movimiento y el margen depende del
fotograma.

Con `prefers-reduced-motion` el vídeo se oculta por CSS y queda el póster; el
script además lo pausa, porque `display: none` no detiene la decodificación.

El máster vive en `public/import-original/herovideo.mp4`, **no en `public/`**: son
10,8 MB que ningún visitante descarga y que se copiarían al despliegue en cada
build. El script lo busca en los dos sitios.

**Aviso:** `hero.mp4` apareció dos veces siendo una copia byte a byte del máster.
Ningún script del repositorio escribe ahí salvo `encode-hero-video.mjs`, así que
la sobrescritura vino de fuera (una copia manual, probablemente). Si el test se
queja de la duración, es exactamente esto: relanza `encode-hero-video.mjs`.

#### Tarjetas de apartamento

`scripts/capture-cards.mjs` mide, además de capturar, tres cosas que se rompen
con facilidad al tocar la tarjeta:

- **etiquetas recortadas** — texto que no cabe en su columna y se corta en
  silencio. Pasó con `Powierzchnia` en una tarjeta de 271 px.
- **hueco antes del pie** — si una tarjeta muestra el precio con más aire que
  sus vecinas de la misma fila. Ocurre cuando el texto de apoyo ocupa una línea
  en una tarjeta y dos en otra; se corrige fijando la altura del texto a dos
  líneas.
- **alturas** — las cuatro tarjetas de una fila deben medir lo mismo.

`scripts/diagnose-card-width.mjs <puerto> <ruta>` imprime la cadena de
contenedores con el ancho y el `max-width` de cada nivel. Sirve para saber si un
ancho raro es de la tarjeta o de quien la contiene.

`scripts/inspect-png.mjs <png> [fila]` lee los píxeles de una captura y localiza
dónde empieza y acaba el contenido. Es la forma de distinguir un problema de
maquetación de una lectura equivocada de una imagen reducida.

#### Plano aéreo del complejo

`plan-osrodka.webp` abre la sección de instalaciones de `/apartamenty/`. Es una
vista aérea que **el propietario ya rotuló** con los seis puntos que importan:
Apartamenty, Rekreacja, Plaża, Marina, ZenziBar y Slip.

Tres decisiones sobre él:

- **Los rótulos están en polaco y no se tocan.** La imagen no se puede traducir,
  así que se traduce en el HTML: debajo va una leyenda que explica cada nombre en
  el idioma del visitante, con el nombre polaco en color de acento para que se
  relacione con el que se ve en la foto.
- **Se conserva a resolución completa** (1536 px, calidad 84, 332 KB) en lugar de
  bajarla a 1200 px como el resto. Es más pesado, pero hay que poder leer los
  rótulos: reducirla los vuelve ilegibles y entonces el plano pierde su sentido.
- **Sin `aspect-ratio` fijo.** Un recorte se comería los rótulos de los extremos
  (Marina y Slip), que son justo los que hay que leer.

`node scripts/check-map-legend.mjs 8080 /apartamenty/` comprueba que el plano
carga y que la leyenda sale completa en cada idioma.

#### Instalaciones del complejo

Van en `/apartamenty/`, entre el listado de apartamentos y la tabla comparativa,
con las fotos de detalle en `public/assets/facilities/`.

**Por qué están en esa página y no en la home.** Los cuatro apartamentos son
idénticos en metraje, distribución y equipamiento; lo único que cambia es la
vista desde el taras. Eso deja la página de apartamentos sin nada propio que
contar si solo se listan cuatro veces las mismas cifras, y es justo ahí donde el
visitante decide. Lo que sí diferencia la estancia es el complejo: la balia, la
sauna, el taras cubierto, el fuego junto al lago.

```bash
node scripts/import-facility-images.mjs   # renombra al polaco y convierte a WebP
node scripts/responsive-images.mjs        # variantes + LQIP
```

`import-facility-images.mjs` toma los archivos con nombres en español y los deja
en `public/assets/facilities/` con nombre en polaco, sin espacios ni acentos.
Los originales se conservan en `public/import-original/instalaciones/`.

**El ahorro viene de reducir tamaño, no de cambiar de formato.** Los JPEG de
origen ya venían comprimidos a ~calidad 70, así que reconvertir sin tocar las
dimensiones no ahorraba nada: algún archivo incluso engordaba. A 1200 px de ancho
y calidad 80 el lote baja un 25%.

**Las descripciones están escritas a partir de lo que se ve en cada foto**, no
del nombre del archivo. Si se cambia una imagen hay que revisar su texto.
`node scripts/contact-sheet-dir.mjs <carpeta>` genera una rejilla con todas las
fotos y su nombre para revisarlas de un vistazo.

Dos detalles de maquetación que conviene no deshacer:

- **La foto no lleva `aspect-ratio` fijo.** Las tarjetas de una fila se igualan
  en alto, pero el texto de cada una ocupa cosas muy distintas; con proporción
  fija, las de texto corto se quedaban con más de 300 px de blanco debajo. El
  cuerpo toma la altura de su texto (`flex: 0 0 auto`) y la foto se queda el
  resto (`flex: 1 1 auto`). La rejilla pasó de 2756 a 1886 px sin huecos.
- **Cuatro tarjetas ocupan dos columnas** (el edificio, el taras, la balia y el
  salón): son las que deciden la reserva. Doce tarjetas iguales se leen como una
  lista plana.

`node scripts/verify-facilities-network.mjs 8080` es la comprobación fiable de
que las fotos cargan: escucha las respuestas HTTP. Medir `naturalWidth` da
falsos negativos con `loading="lazy"`, porque una foto que aún no ha entrado en
el viewport no se ha pedido todavía y parece rota sin serlo.

#### Página de atracciones

`/atrakcje/` (y `/en/attractions/`, `/de/attraktionen/`) usa
`src/components/content/AttractionRow.astro`: filas alternadas, imagen a un lado
y texto al otro. Sustituyó a la rejilla de tarjetas con icono, porque ahora cada
sitio tiene foto propia y el icono sobraba.

Tres decisiones que conviene no deshacer:

- **Una sola secuencia, no dos.** Antes había un bloque de filas para los
  servicios del complejo y otro para los sitios de la zona. Al cortarse en dos,
  el zigzag se rompía en la costura y se veían dos imágenes seguidas del mismo
  lado. Ahora hay una lista única: primero lo de casa (con el sello *U nas*),
  después lo del entorno. El lado de cada imagen sale del índice, así que el
  ritmo es continuo por construcción.
- **Los servicios del complejo no se repiten en la zona.** El rejs, el SUP y las
  bicis estaban en las dos listas —como servicio de casa y como atracción del
  entorno—, así que salían dos veces con la misma foto. Se descartan de la
  segunda por slug.
- **Las atracciones sin foto no entran en las filas.** Dejarían un hueco vacío
  donde iría la imagen. Van en una lista compacta de tres columnas debajo.

**El campo `image` del dato es obligatorio para que una atracción salga con
foto.** Tener el archivo en la carpeta no basta: `src/data/attractions.ts` tiene
que declararlo. Este fallo no da error, simplemente no pinta nada — llegó a
haber quince imágenes en disco y cinco filas en pantalla.

```bash
node scripts/import-region-images.mjs      # renombra al polaco y pasa a WebP
node scripts/import-gastro-image.mjs       # la foto de la sección de gastronomía
node scripts/responsive-images.mjs         # variantes + LQIP
node scripts/audit-attraction-images.mjs   # cruza slugs, archivos y manifiesto
node scripts/verify-attractions-page.mjs 8080 /atrakcje/
node scripts/verify-gastro-image.mjs 8080 1440
```

**La foto de gastronomía manda en la proporción de su figura.** `gastronomia.avif`
mide 400×600 (2:3) y la figura se ajustó a esa misma proporción; con la 3:4 que
había antes, la imagen se recortaba por los lados. Además la figura se limita a
`26rem` de ancho: la foto tiene 400 px y en una columna de 515 px se vería blanda
en pantallas de alta densidad. A 416 px el navegador la sirve casi a su tamaño
nativo. **Si se sustituye por un original mayor, hay que subir ese límite.**

`import-region-images.mjs` toma las fotos de `public/atracciones/`, las deja en
`public/assets/attractions/` con el nombre del **slug** y respalda los originales
en `public/import-original/atracciones/`. `assets/attractions` está en
`SOURCE_DIRS` de `responsive-images.mjs`: si se añade otra carpeta de imágenes hay
que registrarla ahí o `SmartImage` no encontrará las variantes.

`verify-attractions-page.mjs` comprueba lo que se rompe con facilidad aquí: que
la alternancia no tenga dos imágenes seguidas del mismo lado, que todas las filas
midan lo mismo y que **todas** las fotos respondan 200 (medido por red, no por
`naturalWidth`, que con `loading="lazy"` da falsos negativos).

#### Valoraciones

`src/components/ui/RatingSummary.astro` es el único componente que muestra
valoraciones, y lo usan la franja de confianza, la sección de opiniones de la
portada y la página `/opinie/`. Antes cada sitio tenía su propia copia y podían
desincronizarse.

**No se combinan las notas en una sola cifra, y es deliberado.** Existía
`getOverallScore()`, que ponderaba Booking y Google en una nota sobre 10; con los
datos reales daba 9,6, una puntuación que no existe en ninguna plataforma y que
además era peor que la de Booking (9,9). Cada plataforma se muestra con su nota,
su escala y su número de opiniones, y el total se comunica como cantidad
("176 opiniones"), nunca como nota.

Lo mismo en el JSON-LD: se emiten dos `AggregateRating`, uno por plataforma, y
ninguno calculado por nosotros. Google exige que `ratingValue` y `reviewCount`
correspondan a reseñas reales y verificables.

`node scripts/capture-ratings.mjs 8080` comprueba en el navegador que las dos
plataformas salen con sus cifras correctas y que el total no es un promedio.


`scripts/capture-cards.mjs` mide, además de capturar, tres cosas que se rompen
con facilidad al tocar la tarjeta:

- **etiquetas recortadas** — texto que no cabe en su columna y se corta en
  silencio. Pasó con `Powierzchnia` en una tarjeta de 271 px.
- **hueco antes del pie** — si una tarjeta muestra el precio con más aire que
  sus vecinas de la misma fila. Ocurre cuando el texto de apoyo ocupa una línea
  en una tarjeta y dos en otra; se corrige fijando la altura del texto a dos
  líneas.
- **alturas** — las cuatro tarjetas de una fila deben medir lo mismo.

`scripts/diagnose-card-width.mjs <puerto> <ruta>` imprime la cadena de
contenedores con el ancho y el `max-width` de cada nivel. Sirve para saber si un
ancho raro es de la tarjeta o de quien la contiene.

`scripts/inspect-png.mjs <png> [fila]` lee los píxeles de una captura y localiza
dónde empieza y acaba el contenido. Es la forma de distinguir un problema de
maquetación de una lectura equivocada de una imagen reducida.

#### Imágenes editoriales de la portada

La figura de la sección "sobre nosotros" ha cambiado tres veces de imagen y, con
ella, de proporción. **La proporción de la figura se ajusta siempre a la del
archivo**, no al revés: si no, la imagen se recorta.

| Imagen | Proporción de la figura |
|---|---|
| `liberta-iv/salon-aneks-1.jpg` (interior vertical) | 3 / 4 |
| `liberta-iv/exterior-dzien.jpg` (conjunto desde el lago) | 4 / 3 |
| `editorial/dom-z-ogrodem.webp` (actual) | **16 / 9** |

El circuito para una imagen nueva:

```bash
node scripts/import-featured-image.mjs    # destacada.jpg → WebP con nombre en polaco
node scripts/responsive-images.mjs        # variantes + LQIP
node scripts/capture-about.mjs 8080       # ¿encaja sin recorte?
```

`import-featured-image.mjs` deja el archivo en `public/assets/editorial/` con
nombre en polaco, porque los nombres acaban en URLs públicas. Los originales se
respaldan en `public/import-original/otros/`.

#### Búsqueda de disponibilidad

El buscador de la portada envía a `/rezerwacja/wyniki/` (`/en/booking/results/`,
`/de/reservierung/ergebnisse/`), no al formulario de reserva. Antes el huésped
elegía fechas y aterrizaba en otro formulario, sin respuesta a "¿hay sitio?".
Ahora la búsqueda tiene su propia página, con el lenguaje de las webs de
reservas: primero un estado de búsqueda y después el resultado.

**La página es SSR** (`prerender = false`). Si se prerenderizara, quedaría
congelada con las fechas del build.

Qué muestra, según el caso:

| Caso | Resultado |
|---|---|
| Fechas libres | Los 4 apartamentos, marcados como disponibles, con CTA |
| Fechas ocupadas | Los 4 marcados como ocupados, el rango que bloquea y **fechas alternativas** |
| Sin fechas | Mensaje para completarlas, con el buscador ya en la página |

Las alternativas se calculan con `findNearestAvailable()`: busca hacia atrás y
hacia delante desde el rango pedido, **manteniendo el número de noches**, y para
en el primer hueco. Devolver "libre en noviembre" cuando lo útil es lo más
cercano no sirve de nada.

```bash
node scripts/verify-search-flow.mjs 8080
```

#### Disponibilidad: de dónde sale el dato (pendiente)

**El calendario actual es AGREGADO de la propiedad, no por apartamento.** El
iCal que exporta Booking para esta ficha dice si la casa está llena, no qué
unidad está ocupada. Por eso los cuatro apartamentos aparecen siempre con el
mismo estado y la página **lo dice con todas las letras** en lugar de fingir un
reparto que el dato no sostiene.

Para mostrar disponibilidad real por apartamento hace falta que el propietario
exporte **un iCal por unidad**. Cuando lo haya, el único sitio que cambia es
`availabilityByApartment()` en `src/lib/availability.ts`: se le pasa un
calendario distinto a cada unidad y el resto de la página ya funciona.

`src/data/availability.json` es hoy un marcador de posición (`*** not
configured ***`, cero rangos). Mientras no haya calendario real se usa
`availability-sample.ics`. **Los avisos importan aquí:** si no se encuentra
ninguno de los dos, `loadBookedRanges()` responde "todo libre" y lo avisa por
consola. Ese camino llegó a estar activo **en producción por un error de ruta**:
el módulo compilado vive en `dist/server/chunks/`, así que resolver la ruta con
`import.meta.url` buscaba `dist/src/data/…`. En desarrollo no se notaba. La ruta
se resuelve ahora desde el directorio de trabajo, y `PUBLIC_DATA_DIR` permite
apuntar a otro sitio (un volumen con el calendario que actualice un cron).

#### Bloque de contacto

Teléfono, correo y dirección, cada uno **en una sola línea**.

El correo se partía en dos líneas en todos los anchos por dos motivos a la vez:
`overflow-wrap: anywhere` lo cortaba por cualquier punto —llegaba a partir
"kontakt@apartamentyliber|ta.pl"— y con el tamaño del resto de datos necesitaba
303 px cuando la columna más estrecha deja 213.

La solución tiene tres piezas:

1. `white-space: nowrap` en el correo y la dirección, para que no se partan.
2. `font-size: clamp(0.95rem, 1.6vw, 1.25rem)`: el valor encoge en ventanas
   estrechas hasta caber y crece en las grandes, acotado para no perder jerarquía
   frente al teléfono.
3. La dirección se compone **sin el país** (`site.address.full` incluye
   ", Polska", que son 9 caracteres de más y no aportan nada en un sitio
   polaco). El dato completo se mantiene intacto para el pie, el SEO y el
   reglamento, que sí lo necesitan.

```bash
node scripts/measure-contact-block.mjs 8080 1024 /
```

Comprobado en **diez anchos, de 1440 a 360 px**: los tres datos en una línea y
ninguno se sale de su tarjeta. Medir el número de líneas con
`Range.getClientRects()` es lo único fiable aquí: el ancho del texto no lo dice,
porque un texto puede caber y partirse igualmente por un punto de ruptura.

#### Marcas de redes sociales

Los tres iconos del navbar (Facebook, Instagram y Booking.com) son SVG del
propietario en `public/assets/brand/`, dibujados en blanco. Se pintan con un lado
cuadrado de 1,05rem y quedan **16,8×16,8 px los tres**, centrados en su círculo.

```bash
node scripts/install-instagram-mark.mjs   # instala el SVG que entregue el dueño
node scripts/measure-icon-alignment.mjs 8080 /
node scripts/compare-brand-icons.mjs 17 14
```

**El viewBox tiene que ser cuadrado.** Si una marca trae un viewBox más ancho que
alto, su dibujo sale más grande que los otros al pintarlos con un lado cuadrado, y
en una fila de tres se nota. Al Instagram le pasó dos veces (proporciones 1,027 y
1,026): `install-instagram-mark.mjs` lo normaliza a cuadrado y además ensancha el
marco para que el trazo no caiga justo en el límite —un trazo SVG se dibuja
centrado en el trazado, así que sobresale la mitad de su grosor, y el del marco
estaba a 0,41 del borde con un trazo de 0,82: justo al límite—.

**El color se invierte con CSS, no con un segundo archivo.** El dibujo es blanco y
sobre fondos claros se aplica `filter: brightness(0) saturate(1) opacity(0.82)`.
Comprobado en los dos estados:

```bash
node scripts/check-social-filter.mjs 8080 /        # sobre el hero → sin filtro
node scripts/check-social-filter.mjs 8080 /cennik/ # fondo claro → filtrado
```

El peso del trazo importa a 17 px: el aro de la lente de Instagram llegó a ser la
tercera parte de grueso que el marco de Facebook y el icono se leía como un
borrón. Al comparar marcas hay que mirarlas al tamaño real y ampliadas, no a
tamaño de archivo.

Facebook y Booking.com son archivos SVG que aportó el propietario
(`public/assets/brand/facebook-mark.svg` y `booking-mark.svg`), dibujados en
**blanco**. Instagram, que no tiene archivo, se traza inline.

El color se resuelve sin duplicar archivos:

- Sobre el hero (cabecera sin fondo) se muestran tal cual: blancas.
- Cuando la cabecera coge su fondo claro al hacer scroll, un filtro CSS las
  invierte a oscuro. La regla vive en `Header.astro` y depende de
  `data-theme="on-dark"`, que solo está presente sobre el hero.
- En el pie, sobre fondo oscuro, siempre blancas.

`node scripts/measure-social-icons.mjs` mide la geometría real de cada icono y
avisa si alguno sale con caja vacía (0×0), que es el síntoma de un SVG mal
emitido.

#### Aislamiento del navegador (importante)

Todos los scripts de auditoría abren **su propia instancia de Chrome headless**
con un `--user-data-dir` temporal exclusivo y un puerto de depuración propio. La
única acción sobre procesos es `child.kill()` sobre el hijo que ellos mismos
lanzan, así que **es seguro ejecutarlos con el navegador del usuario abierto**.

Nunca añadas en `scripts/` nada como `Get-Process chrome | Stop-Process` ni
`taskkill /IM chrome.exe`: cerraría las pestañas del usuario.

Si un script avisa de que Chrome no expuso el puerto de depuración, es que quedó
un perfil temporal bloqueado. Bórralo a mano (`.audit-profile-*`) y repite; el
script no mata procesos ajenos por su cuenta.

### Cabecera: decisiones que no conviene deshacer

- **La marca es siempre el logotipo completo**, en la posición inicial y con
  scroll. Sobre el hero lleva un plato blanco translúcido que desaparece al
  bajar, porque el logotipo tiene el texto en negro y el hero es oscuro.
- **`.hdr` NO puede llevar `overflow: hidden`.** El desplegable del selector de
  idioma es hijo suyo y tiene que poder salirse de la barra; recortar el
  contenedor lo deja abierto pero invisible y sin poder hacer clic. El skip-link
  se oculta recortándose a sí mismo (`clip-path` en `base.css`).
- **El fondo de la barra y el color del texto cambian en el mismo umbral** de
  scroll (24 px). Si se separan, aparece un tramo con fondo claro y texto claro.

---

## Variables de entorno

Copiar `.env.example` a `.env`:

| Variable | Uso |
|---|---|
| `RESEND_API_KEY` | Envío de emails de reserva |
| `OWNER_EMAIL` | Destino de los avisos |
| `PUBLIC_SITE_URL` | URL canónica |
| `PORT` / `HOST` | Servidor de producción |

Si falta `RESEND_API_KEY`, las reservas se registran en el log del servidor en
lugar de enviarse: útil para probar el formulario sin configurar nada.

---

## Formulario de reserva

- Funciona **sin JavaScript** (POST clásico a `/api/booking`)
- Con JS: comprobación de disponibilidad en vivo, estados de carga y mensajes
- Validación con Zod en el servidor y honeypot antispam + límite de 5 envíos por
  hora e IP
- Los emails al huésped y al propietario se generan **en el idioma del visitante**
- Comprobación contra el calendario importado de Booking.com (fail-open: si el
  calendario no está disponible, la solicitud pasa y el propietario confirma)

---

## Convenciones

- **Idioma del código y los comentarios:** español
- **Idioma del contenido del sitio:** polaco (principal), inglés y alemán
- **Precios:** `formatPLN()` (`Intl.NumberFormat` con `pl-PL`)
- **Fechas:** `formatDate()` con el locale del visitante
- **Rutas:** `localeLink(locale, "/ruta-polaca/")` — nunca hardcodear el prefijo
- **Texto visible:** siempre desde `t(locale)`, nunca literal en un componente
