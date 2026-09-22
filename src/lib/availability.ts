/**
 * availability.ts — iCal parser + availability checker.
 *
 * Fuente de datos (en orden de prioridad):
 *   1) src/data/availability.json — cache actualizado por `npm run availability:update`
 *      que descarga el .ics de Booking.com. Esta es la fuente de producción.
 *   2) src/data/availability-sample.ics — iCal de muestra con fechas ocupadas
 *      de ejemplo. Sirve para que el form funcione end-to-end desde el día 1,
 *      sin necesidad de configurar Booking todavía.
 *   3) Vacío (todo disponible) — último fallback.
 *
 * Lógica:
 *   - Booking.com exporta fechas no disponibles (no días específicos por apartamento,
 *     sino disponibilidad agregada de toda la propiedad).
 *   - El form verifica si hay conflicto entre [checkIn, checkOut) y los rangos
 *     reservados. Si HAY conflicto → no disponible.
 *   - Si NO hay conflicto → hay al menos una habitación libre, dejamos pasar
 *     (el admin asigna apartamento específico al confirmar por email).
 *
 * iCal DTEND es EXCLUSIVO (el huesped sale en la mañana del día DTEND).
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Dónde viven los datos de disponibilidad.
 *
 * OJO CON ESTO: no se puede resolver la ruta relativa al módulo.
 *
 * `import.meta.url` apunta a `dist/server/chunks/` en el build, así que
 * `join(__dirname, "..", "..")` daba `dist/` y el código buscaba
 * `dist/src/data/availability.json`, que no existe. El resultado era silencioso
 * y grave: `loadBookedRanges()` devolvía cero rangos y TODAS las fechas
 * aparecían libres en producción. En desarrollo no se notaba porque el módulo
 * vive en `src/lib/` y las dos rutas coincidían.
 *
 * La ruta se resuelve ahora desde el directorio de trabajo, que es la raíz del
 * proyecto tanto en `astro dev` como al ejecutar `node dist/server/entry.mjs`.
 *
 * `PUBLIC_DATA_DIR` permite apuntar a otro sitio (por ejemplo un volumen con el
 * calendario actualizado por un cron) sin tocar el código.
 */
const ROOT = process.env.PUBLIC_DATA_DIR
  ? resolve(process.env.PUBLIC_DATA_DIR)
  : process.cwd();

const JSON_PATH = join(ROOT, "src", "data", "availability.json");
const SAMPLE_PATH = join(ROOT, "src", "data", "availability-sample.ics");

export type BookedRange = {
  /** YYYY-MM-DD (inclusivo, huesped llega en la tarde) */
  start: string;
  /** YYYY-MM-DD (exclusivo, huesped sale en la mañana) */
  end: string;
};

export type AvailabilityResult = {
  available: boolean;
  conflicts: BookedRange[];
};

export type LoadedAvailability = {
  ranges: BookedRange[];
  source: "cache" | "sample" | "empty";
  cachedAt?: string;
  sourceUrl?: string;
};

/**
 * Parsea un string iCal (RFC 5545 subset) y devuelve los rangos reservados.
 * Soporta solo DTSTART/DTEND con VALUE=DATE (all-day events) que es lo que usa
 * Booking.com en su export. Ignora propiedades extendidas, recurrencias, etc.
 */
export function parseICal(ics: string): BookedRange[] {
  const events = ics.split(/BEGIN:VEVENT/).slice(1);
  const ranges: BookedRange[] = [];

  for (const block of events) {
    const endIdx = block.indexOf("END:VEVENT");
    if (endIdx === -1) continue;
    const ev = block.slice(0, endIdx);

    const startMatch = ev.match(/DTSTART(?:;[^:\r\n]+)?:(\d{8})/);
    const endMatch = ev.match(/DTEND(?:;[^:\r\n]+)?:(\d{8})/);

    if (startMatch && endMatch) {
      ranges.push({
        start: icalToIso(startMatch[1]),
        end: icalToIso(endMatch[1]),
      });
    }
  }

  return ranges;
}

function icalToIso(ical: string): string {
  // YYYYMMDD -> YYYY-MM-DD
  return `${ical.slice(0, 4)}-${ical.slice(4, 6)}-${ical.slice(6, 8)}`;
}

/**
 * Verifica si el rango [checkIn, checkOut) está libre de conflictos.
 * Las fechas se comparan como strings ISO (YYYY-MM-DD) — son lexicográficamente
 * ordenables por construcción.
 *
 * Algoritmo: dos rangos se solapan si a.start < b.end && a.end > b.start.
 */
export function checkAvailability(
  booked: BookedRange[],
  checkIn: string,
  checkOut: string
): AvailabilityResult {
  if (checkOut <= checkIn) {
    return { available: false, conflicts: [] };
  }

  const conflicts = booked.filter((b) => {
    return b.start < checkOut && b.end > checkIn;
  });

  return {
    available: conflicts.length === 0,
    conflicts,
  };
}

/**
 * Fechas libres más próximas a una búsqueda sin disponibilidad.
 *
 * Cuando el rango pedido choca con una reserva, se ofrecen alternativas: el
 * primer hueco libre ANTES del rango y el primero DESPUÉS, manteniendo el número
 * de noches que pidió el huésped.
 *
 * POR QUÉ NO ES UNA BÚSQUEDA EXHAUSTIVA
 *
 * Se busca hacia atrás y hacia delante desde el rango pedido, que es donde el
 * huésped está dispuesto a moverse, y se para en el primer hueco válido. Buscar
 * "la fecha más próxima" en un horizonte de dos años daría respuestas raras
 * ("libre en noviembre") cuando lo útil es lo más cercano en ambas direcciones.
 *
 * @param booked   rangos ocupados
 * @param checkIn  fecha pedida (YYYY-MM-DD)
 * @param checkOut fecha de salida pedida (YYYY-MM-DD)
 * @param maxDias  cuántos días hacia cada lado se busca
 */
export function findNearestAvailable(
  booked: BookedRange[],
  checkIn: string,
  checkOut: string,
  maxDias = 120,
): { antes?: BookedRange; despues?: BookedRange } {
  const noches = nightsBetween(checkIn, checkOut);
  if (noches <= 0) return {};

  const buscar = (desplazamiento: number): BookedRange | undefined => {
    for (let i = 1; i <= maxDias; i++) {
      const inicio = addDays(checkIn, i * desplazamiento);
      const fin = addDays(inicio, noches);

      // No ofrecer fechas pasadas
      if (inicio < todayIso()) continue;

      if (checkAvailability(booked, inicio, fin).available) {
        return { start: inicio, end: fin };
      }
    }
    return undefined;
  };

  return { antes: buscar(-1), despues: buscar(1) };
}

/** Noches entre dos fechas ISO. */
export function nightsBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

/** Suma días a una fecha ISO. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Hoy, en ISO y en UTC (coincide con la fecha del servidor). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Estado de cada apartamento para un rango de fechas.
 *
 * IMPORTANTE — de dónde sale esto y qué NO se puede afirmar todavía.
 *
 * El iCal que exporta Booking.com para esta ficha es **agregado de la
 * propiedad**: dice si la casa está llena, no qué unidad está ocupada. Por eso
 * las cuatro unidades comparten el mismo calendario y aquí aparecen las cuatro
 * con el mismo estado. No es una simplificación: es lo que el dato permite
 * afirmar hoy.
 *
 * Cuando el propietario exporte un iCal POR APARTAMENTO, esta función es el
 * único sitio que hay que cambiar: se pasa un calendario distinto a cada unidad
 * y el resto de la página (resultados, fechas alternativas, orden por precio)
 * ya funciona.
 */
export type ApartmentAvailability = {
  id: string;
  available: boolean;
  /** Por qué no está disponible, si no lo está */
  reason?: "booked";
};

export function availabilityByApartment(
  apartments: Array<{ id: string }>,
  booked: BookedRange[],
  checkIn: string,
  checkOut: string,
): ApartmentAvailability[] {
  const { available } = checkAvailability(booked, checkIn, checkOut);
  return apartments.map((a) => ({
    id: a.id,
    available,
    reason: available ? undefined : "booked",
  }));
}

export async function loadBookedRanges(): Promise<LoadedAvailability> {
  // 1) Cache JSON (producción)
  if (existsSync(JSON_PATH)) {
    try {
      const raw = await readFile(JSON_PATH, "utf-8");
      const data = JSON.parse(raw);
      if (Array.isArray(data.ranges) && data.ranges.length > 0) {
        return {
          ranges: data.ranges,
          source: "cache",
          cachedAt: data.cachedAt,
          sourceUrl: data.url,
        };
      }
    } catch (e) {
      console.error("[availability] Failed to read availability.json:", e);
    }
  }

  // 2) iCal de muestra (dev/testing)
  if (existsSync(SAMPLE_PATH)) {
    try {
      const ics = await readFile(SAMPLE_PATH, "utf-8");
      const ranges = parseICal(ics);
      if (ranges.length > 0) {
        return {
          ranges,
          source: "sample",
        };
      }
    } catch (e) {
      console.error("[availability] Failed to read availability-sample.ics:", e);
    }
  }

  // 3) Empty
  /*
   * ESTE CAMINO NO PUEDE SER SILENCIOSO.
   *
   * Devolver cero rangos equivale a "todo libre", y presentar todo libre cuando
   * en realidad no hay datos es peor que no responder: el huésped pide unas
   * fechas que quizá estén ocupadas y el propietario tiene que decirle que no
   * después. Esto llegó a pasar en producción por un error de ruta (ver el
   * comentario de ROOT), sin que nada lo avisara.
   */
  console.error(
    "[availability] SIN DATOS DE CALENDARIO: se está respondiendo que todo está libre.\n" +
      `  Rutas comprobadas:\n    ${JSON_PATH}\n    ${SAMPLE_PATH}\n` +
      "  Actualiza el calendario (`npm run availability:update`) o revisa PUBLIC_DATA_DIR.\n" +
      "  Si es intencionado (aún no hay calendario conectado), ignora este aviso.",
  );

  return { ranges: [], source: "empty" };
}
