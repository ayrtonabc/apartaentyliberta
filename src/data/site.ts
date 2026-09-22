/**
 * site.ts — datos del negocio.
 *
 * IMPORTANTE: las URLs de redes sociales son las que confirmó el propietario
 * (Facebook, Instagram y el enlace corto de Booking.com). Las anteriores eran
 * distintas y estaban repartidas entre página y datos.
 */

export const site = {
  name: "Apartamenty Liberta",
  shortName: "Liberta",
  url: "https://apartamentyliberta.pl",
  email: "kontakt@apartamentyliberta.pl",
  phone: {
    display: "+48 668 157 409",
    tel: "+48668157409",
  },
  phoneMassage: {
    display: "+48 516 675 408",
    tel: "+48516675408",
  },
  bank: {
    iban: "PL29160014621812595500000001", // BNP Paribas
    accountHolder: "Liberta",
    label: "Wpłata zaliczki 30% za pobyt",
  },
  address: {
    street: "Jarzębinowa 16",
    postalCode: "14-133",
    locality: "Stare Jabłonki",
    region: "warmińsko-mazurskie",
    country: "PL",
    full: "Jarzębinowa 16, 14-133 Stare Jabłonki, Polska",
  },
  geo: {
    lat: 53.7034,
    lng: 20.0778,
    latDMS: `53°42'12.1" N`,
    lngDMS: `20°04'40.8" E`,
  },
  social: {
    facebook: "https://www.facebook.com/apartamentylibertamazury",
    instagram: "https://www.instagram.com/apartamentyliberta/",
    /** Enlace corto que compartió el propietario para la ficha de Booking.com */
    booking: "https://www.booking.com/Share-mBuVDTc",
    youtube: "https://www.youtube.com/watch?v=uKUkRSwro1Y",
  },
  partner: {
    marina: "https://marinaliberta.pl/",
  },
  established: 2020,
  legalName: "Apartamenty Liberta",
};

export type Site = typeof site;
