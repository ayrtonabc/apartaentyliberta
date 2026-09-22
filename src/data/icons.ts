/**
 * IconName — nombres de icono disponibles en ~/components/ui/Icon.astro.
 * Se declara en un módulo .ts porque los .astro no pueden exportar tipos.
 */

export type IconName =
  /* Equipamiento */
  | "wifi" | "wind" | "thermometer" | "flame" | "utensils" | "oven" | "microwave"
  | "toaster" | "kettle" | "fridge" | "tv" | "play" | "bed" | "bath" | "hairdryer"
  | "iron" | "terrace" | "grill" | "hottub" | "sun" | "parking" | "lake" | "no-pets"
  | "playground" | "badminton" | "bike" | "book" | "boardgame" | "firepit" | "bar"
  | "stove" | "washer"
  /* Interfaz y contacto */
  | "phone" | "mail" | "pin" | "clock" | "users" | "ruler" | "bed-double" | "bath-tub"
  /* Actividades y entorno */
  | "waves" | "sail" | "kayak" | "fish" | "golf" | "horse" | "crosshair" | "castle"
  | "ferris" | "music" | "trampoline" | "canoe" | "tree" | "snow" | "leaf" | "sunrise"
  /* Símbolos */
  | "star" | "quote" | "check" | "arrow-right" | "arrow-down" | "chevron-down" | "close"
  | "calendar" | "sparkles" | "shield" | "award" | "key"
  /* Transporte */
  | "car" | "plane" | "train"
  /* Varios */
  | "bbq" | "utensils-crossed" | "dog" | "baby" | "info" | "external";
