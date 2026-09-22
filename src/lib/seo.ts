/**
 * seo.ts — metadatos, hreflang y datos estructurados (JSON-LD).
 *
 * Correcciones clave respecto a la versión anterior:
 *   - El canonical y los hreflang se construyen desde la RUTA CANÓNICA en
 *     polaco, no desde Astro.url. Así /en/ y /de/ dejan de apuntar a URLs
 *     polacas (que era un error grave de SEO internacional).
 *   - Los datos estructurados se generan en el idioma de la página.
 *   - Se añaden BreadcrumbList, FAQPage, WebSite y AggregateRating.
 */

import { site } from "~/data/site";
import { aggregateRatings } from "~/data/reviews";
import { type Locale, localeMeta, defaultLocale, translatePath } from "~/lib/i18n";
import { t } from "~/lib/i18n";

export type SeoMeta = {
  title: string;
  description: string;
  ogImage?: string;
  ogType?: "website" | "article" | "profile";
  noindex?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
};

/** Sufijo de marca para los títulos de página. */
export function buildTitle(pageTitle: string | undefined): string {
  if (!pageTitle) return site.name;
  return `${pageTitle} | ${site.name}`;
}

const BASE = site.url;

/** URL absoluta de una ruta en un idioma concreto. */
export function absoluteUrl(path: string, locale: Locale = defaultLocale): string {
  const localized = translatePath(path, locale);
  return `${BASE}${localized}`;
}

/**
 * Canonical de una página: siempre la URL del idioma actual construida desde
 * la ruta canónica, sin query ni hash.
 */
export function buildCanonical(canonicalPath: string, locale: Locale): string {
  return absoluteUrl(canonicalPath, locale);
}

/**
 * hreflang para las tres versiones + x-default.
 */
export function buildHreflangLinks(
  canonicalPath: string,
  currentLocale: Locale,
): Array<{ hreflang: string; href: string }> {
  const links = (["pl", "en", "de"] as Locale[]).map((locale) => ({
    hreflang: localeMeta[locale].hreflang,
    href: absoluteUrl(canonicalPath, locale),
  }));

  links.push({ hreflang: "x-default", href: absoluteUrl(canonicalPath, defaultLocale) });

  // La variante del idioma actual se marca además como "self" mediante el
  // canonical, así que no se duplica aquí.
  void currentLocale;
  return links;
}

/** Etiquetas Open Graph + Twitter. */
export function buildOgTags(
  meta: SeoMeta,
  locale: Locale,
  canonical: string,
): Array<{ property: string; content: string }> {
  const altLocales = (["pl", "en", "de"] as Locale[]).filter((l) => l !== locale);
  const ogImage = meta.ogImage || "/og-default.jpg";
  const imageUrl = ogImage.startsWith("http") ? ogImage : `${BASE}${ogImage}`;

  return [
    { property: "og:title", content: meta.title },
    { property: "og:description", content: meta.description },
    { property: "og:type", content: meta.ogType || "website" },
    { property: "og:url", content: canonical },
    { property: "og:image", content: imageUrl },
    { property: "og:locale", content: localeMeta[locale].ogLocale },
    { property: "og:site_name", content: site.name },
    ...altLocales.map((l) => ({
      property: "og:locale:alternate",
      content: localeMeta[l].ogLocale,
    })),
  ];
}

const absolute = (path: string) => (path.startsWith("http") ? path : `${BASE}${path}`);

const ORIGIN = { "@type": "Place", address: "Stare Jabłonki, Mazury, Polska" };

/**
 * LodgingBusiness — entidad principal del negocio.
 * Se emite una sola vez por página en todas las páginas del sitio.
 */
export function buildLodgingBusinessSchema(locale: Locale = defaultLocale) {
  const tr = t(locale);
  return {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    "@id": `${BASE}/#lodging`,
    name: site.name,
    alternateName: "Liberta Apartments Masuria",
    description: tr.seo.lodgingDescription,
    url: absoluteUrl("/", locale),
    telephone: site.phone.tel,
    email: site.email,
    image: [
      absolute("/assets/hero/hero-1.webp"),
      absolute("/assets/hero/hero-3.webp"),
      absolute("/assets/apartments/liberta-i/exterior-dzien.jpg"),
      absolute("/assets/apartments/liberta-i/taras.jpg"),
    ],
    logo: absolute("/assets/logo.webp"),
    priceRange: "700–1400 PLN",
    currenciesAccepted: "PLN",
    paymentAccepted: "Przelew, karta, gotówka",
    numberOfRooms: 4,
    petsAllowed: false,
    checkinTime: "16:00",
    checkoutTime: "11:00",
    smokingAllowed: false,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.street,
      addressLocality: site.address.locality,
      postalCode: site.address.postalCode,
      addressRegion: site.address.region,
      addressCountry: site.address.country,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: site.geo.lat,
      longitude: site.geo.lng,
    },
    hasMap: `https://www.google.com/maps?q=${site.geo.lat},${site.geo.lng}`,
    areaServed: { "@type": "AdministrativeArea", name: tr.seo.areaServed },
    amenityFeature: [
      "WiFi",
      tr.trust.climatized,
      tr.amenityLabelHotTub,
      tr.amenityLabelSauna,
      tr.amenityLabelParking,
      tr.amenityLabelLakeView,
      tr.amenityLabelBbq,
      tr.amenityLabelTerrace,
      tr.amenityLabelKitchen,
    ].map((name) => ({
      "@type": "LocationFeatureSpecification",
      name,
      value: true,
    })),
    /*
     * Valoraciones.
     *
     * Se declaran las dos plataformas por separado, con su nota, su escala y su
     * número de opiniones reales. Antes había un único AggregateRating con
     * 9,9/17 que correspondía solo a Booking: ocultaba las 159 opiniones de
     * Google y no representaba el conjunto.
     *
     * NO se emite una nota combinada. Google exige que `ratingValue` y
     * `reviewCount` se correspondan con reseñas reales y verificables, y un
     * promedio calculado por nosotros a partir de dos fuentes no lo es. El
     * recuento total sí se puede comunicar como texto, pero nunca como nota.
     */
    aggregateRating: aggregateRatings.map((rating) => ({
      "@type": "AggregateRating",
      ratingValue: rating.score.toString(),
      bestRating: rating.scale.toString(),
      worstRating: "1",
      reviewCount: rating.count,
      url: rating.url,
    })),
    sameAs: [site.social.facebook, site.social.instagram],
  };
}

/** Organization — para el panel de conocimiento. */
export function buildOrganizationSchema(locale: Locale = defaultLocale) {
  const tr = t(locale);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BASE}/#organization`,
    name: site.name,
    description: tr.seo.orgDescription,
    url: absoluteUrl("/", locale),
    logo: {
      "@type": "ImageObject",
      url: absolute("/assets/logo.webp"),
      width: 7626,
      height: 1833,
    },
    foundingDate: String(site.established),
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.street,
      addressLocality: site.address.locality,
      postalCode: site.address.postalCode,
      addressCountry: site.address.country,
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: site.phone.tel,
        contactType: "reservations",
        email: site.email,
        availableLanguage: ["Polish", "English", "German"],
        areaServed: ["PL", "DE", "GB"],
      },
    ],
    sameAs: [site.social.facebook, site.social.instagram],
  };
}

/** WebSite — habilita el sitelinks searchbox / conocimiento de marca. */
export function buildWebSiteSchema(locale: Locale = defaultLocale) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BASE}/#website`,
    name: site.name,
    url: absoluteUrl("/", locale),
    inLanguage: localeMeta[locale].hreflang,
    publisher: { "@id": `${BASE}/#organization` },
  };
}

/** BreadcrumbList a partir de migas [{name, path}]. */
export function buildBreadcrumbSchema(
  crumbs: Array<{ name: string; path: string }>,
  locale: Locale,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path, locale),
    })),
  };
}

/** FAQPage — mejora la visibilidad de las preguntas frecuentes. */
export function buildFaqSchema(items: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

/** Accommodation + Offer para la ficha de un apartamento. */
export function buildAccommodationSchema(apartment: {
  id: string;
  name: string;
  description: string;
  sizeM2: number;
  sleeps: number;
  bedrooms: number;
  bathrooms: number;
  image?: string;
  images?: string[];
  lowSeasonPLN: number;
  highSeasonPLN: number;
  canonicalPath: string;
  locale: Locale;
}) {
  const {
    id,
    name,
    description,
    sizeM2,
    sleeps,
    bedrooms,
    bathrooms,
    image,
    images,
    lowSeasonPLN,
    highSeasonPLN,
    canonicalPath,
    locale,
  } = apartment;

  const gallery = (images && images.length > 0 ? images : image ? [image] : []).map(absolute);

  return {
    "@context": "https://schema.org",
    "@type": "Accommodation",
    "@id": `${absoluteUrl(canonicalPath, locale)}#accommodation`,
    name,
    description,
    url: absoluteUrl(canonicalPath, locale),
    numberOfBedrooms: bedrooms,
    numberOfBathroomsTotal: bathrooms,
    occupancy: {
      "@type": "QuantitativeValue",
      value: sleeps,
      maxValue: sleeps + 2,
    },
    floorSize: {
      "@type": "QuantitativeValue",
      value: sizeM2,
      unitCode: "MTK",
    },
    ...(gallery.length ? { image: gallery } : {}),
    amenityFeature: [
      "WiFi",
      "Klimatyzacja / Air conditioning",
      "Balia góralska / Hot tub",
      "Taras",
      "Kominek",
    ].map((amenityName) => ({
      "@type": "LocationFeatureSpecification",
      name: amenityName,
      value: true,
    })),
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.street,
      addressLocality: site.address.locality,
      postalCode: site.address.postalCode,
      addressRegion: site.address.region,
      addressCountry: site.address.country,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: site.geo.lat,
      longitude: site.geo.lng,
    },
    containedInPlace: ORIGIN,
    isPartOf: { "@id": `${BASE}/#lodging` },
    offers: {
      "@type": "Offer",
      url: absoluteUrl(canonicalPath, locale),
      priceCurrency: "PLN",
      price: lowSeasonPLN,
      priceSpecification: {
        "@type": "PriceSpecification",
        priceCurrency: "PLN",
        minPrice: lowSeasonPLN,
        maxPrice: highSeasonPLN,
        unitText: "per night",
      },
      availability: "https://schema.org/InStock",
      validFrom: new Date().toISOString().slice(0, 10),
    },
    additionalProperty: [
      { "@type": "PropertyValue", name: "apartmentId", value: id },
    ],
  };
}

/** ItemList de los cuatro apartamentos (listado). */
export function buildApartmentListSchema(
  apartments: Array<{ name: string; canonicalPath: string }>,
  locale: Locale,
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t(locale).nav.apartments,
    numberOfItems: apartments.length,
    itemListElement: apartments.map((apartment, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: apartment.name,
      url: absoluteUrl(apartment.canonicalPath, locale),
    })),
  };
}
