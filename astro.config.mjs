// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import compress from "astro-compress";
import vercel from "@astrojs/vercel";
import node from "@astrojs/node";

/**
 * Selección de adapter según dónde se va a desplegar.
 *
 *   - En Vercel (process.env.VERCEL === "1"): usamos `@astrojs/vercel`.
 *     Vercel genera las funciones serverless de /api/* automáticamente.
 *   - En local o en un VPS propio: usamos `@astrojs/node` standalone y
 *     arrancamos con `node ./server.mjs`.
 *
 * La razón de tener ambos y elegir: el adapter de Vercel no sabe ejecutar
 * Astro 5.x (requiere Astro 6+) y rompía con 404 hasta que hicimos
 * upgrade. Mantener la rama Node local para `npm run preview` o para
 * mover el deploy a otro host (Netlify, VPS, etc.) sin tocar config.
 */
const adapter = process.env.VERCEL === "1"
  ? vercel({ imageService: true })
  : node({ mode: "standalone" });

// https://astro.build/config
export default defineConfig({
  site: "https://apartamentyliberta.pl",
  /**
   * El sitio se sirve con SSR porque /api/booking y /api/availability
   * necesitan ejecutarse en el servidor (envío de emails y lectura del
   * calendario iCal). Con `output: "static"` el `404.astro` no llegaba a
   * renderizarse en este proyecto (FailedToFindPageMapSSR), así que se usa
   * `server`: todas las páginas se siguen pre-renderizando en build y solo
   * los endpoints quedan on-demand.
   */
  output: "server",
  adapter,
  build: {
    /**
     * CSS inline en el propio HTML.
     *
     * Astro genera un archivo CSS por componente con estilos propios, así
     * que "never" producía 10 peticiones bloqueantes por página. Al inlinear,
     * cada página se sirve autocontenida: cero peticiones CSS y cero bloqueo
     * del primer pintado. El coste (no cachear el CSS entre páginas) es
     * menor que el de 10 round-trips en el primer render, donde se juega
     * el LCP.
     */
    inlineStylesheets: "always",
    assets: "_astro",
  },
  image: {
    service: { entrypoint: "astro/assets/services/sharp" },
  },
  i18n: {
    defaultLocale: "pl",
    locales: ["pl", "en", "de"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [
    sitemap({
      // Las rutas ya incluyen el prefijo de idioma (/en/, /de/) y el polaco
      // va sin prefijo, así que no se usa el i18n del plugin (generaba
      // enlaces alternos incorrectos al no poder mapear el idioma por
      // defecto).
      filter: (page) => !page.includes("/api/") && !page.includes("/404"),
      changefreq: "weekly",
      priority: 0.7,
    }),
    compress(),
  ],
  redirects: {
    // Redirects 301 desde sitio antiguo al nuevo
    "/apartamenty-nad-jeziorem/": "/apartamenty/",
    "/zarezerwuj-apartament-na-mazurach/": "/rezerwacja/",
    "/atrakcje-na-mazurach/": "/atrakcje/",
    "/apartamenty-na-mazurach-lokalizacja/": "/lokalizacja/",
    "/jezioro-szelag-wielki/": "/lokalizacja/#jezioro-szelag",
    // DE/EN old URLs
    "/de/strona-glowna-de/": "/de/",
    "/de/luxuriose-ferienhauser-am-see/": "/de/ferienwohnungen/",
    "/de/reservierung-kontakt/": "/de/reservierung/",
    "/de/lokalisierung-der-luxuriosen-ferienhauser-liberta/": "/de/lage/",
    "/de/attraktionen-in-masuren/": "/de/attraktionen/",
    "/de/preisliste/": "/de/preise/",
    "/en/home-page/": "/en/",
    "/en/apartments-by-the-lake/": "/en/apartments/",
    "/en/booking-contact/": "/en/booking/",
    "/en/locations-of-our-liberta-apartments/": "/en/location/",
    "/en/attractions-in-masuria/": "/en/attractions/",
    "/en/price-list/": "/en/prices/",
  },
  vite: {
    build: {
      // esbuild minifica el CSS sin expandir shorthand ni añadir prefijos
      // heredados: con lightningcss el bundle inlinado crecía ~70%.
      cssMinify: "esbuild",
    },
  },
});
