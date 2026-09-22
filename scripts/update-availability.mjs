#!/usr/bin/env node
/**
 * update-availability.mjs
 *
 * Descarga el calendario iCal de Booking.com y actualiza
 * src/data/availability.json. Luego el sitio usa ese JSON para
 * verificar disponibilidad en el form de reservas.
 *
 * Configuración:
 *   1. Ve a https://admin.booking.com/
 *   2. Property → Calendar → Export calendar
 *   3. Copia la URL del .ics (termina en .ics)
 *   4. Agrégala a .env:
 *        BOOKING_ICAL_URL=https://admin.booking.com/...
 *   5. Corre: npm run availability:update
 *
 * Para automatizar, programa un cron/scheduled task que corra
 * este script cada 1-6 horas y haga commit del JSON resultante.
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ENV_PATH = join(ROOT, ".env");
const JSON_PATH = join(ROOT, "src", "data", "availability.json");

async function loadEnv() {
  if (!existsSync(ENV_PATH)) return;
  const text = await readFile(ENV_PATH, "utf-8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (m && !process.env[m[1]]) {
      let value = m[2];
      // Quitar comillas envolventes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[m[1]] = value;
    }
  }
}

function parseICal(ics) {
  const events = ics.split(/BEGIN:VEVENT/).slice(1);
  const ranges = [];
  for (const block of events) {
    const endIdx = block.indexOf("END:VEVENT");
    if (endIdx === -1) continue;
    const ev = block.slice(0, endIdx);
    const startMatch = ev.match(/DTSTART(?:;[^:\r\n]+)?:(\d{8})/);
    const endMatch = ev.match(/DTEND(?:;[^:\r\n]+)?:(\d{8})/);
    if (startMatch && endMatch) {
      ranges.push({
        start: `${startMatch[1].slice(0, 4)}-${startMatch[1].slice(4, 6)}-${startMatch[1].slice(6, 8)}`,
        end: `${endMatch[1].slice(0, 4)}-${endMatch[1].slice(4, 6)}-${endMatch[1].slice(6, 8)}`,
      });
    }
  }
  return ranges;
}

function sanitizeUrl(url) {
  // Oculta tokens/keys en el log
  return url.replace(/(token|key|auth|password)=([^&]+)/gi, "$1=***");
}

async function main() {
  await loadEnv();

  const url = process.env.BOOKING_ICAL_URL;
  if (!url) {
    console.error("");
    console.error("✗ BOOKING_ICAL_URL no está configurada.");
    console.error("");
    console.error("Pasos para configurar:");
    console.error("  1. Entra a https://admin.booking.com/");
    console.error("  2. Property → Calendar → Export calendar");
    console.error("  3. Copia la URL del .ics (termina en .ics)");
    console.error("  4. Crea/edita .env en la raíz del proyecto:");
    console.error("       BOOKING_ICAL_URL=https://admin.booking.com/.../ical.ics");
    console.error("  5. Vuelve a correr: npm run availability:update");
    console.error("");
    process.exit(1);
  }

  console.log("→ Descargando iCal desde Booking.com...");
  const res = await fetch(url, {
    headers: {
      "User-Agent": "ApartamentyLiberta-Astro/1.0 (+https://apartamentyliberta.pl)",
      "Accept": "text/calendar, text/plain;q=0.9, */*;q=0.5",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const ics = await res.text();
  console.log(`  ${ics.length} bytes descargados`);

  const ranges = parseICal(ics);
  console.log(`  ${ranges.length} rangos reservados parseados`);

  const data = {
    source: "booking.com",
    url: sanitizeUrl(url),
    cachedAt: new Date().toISOString(),
    ranges,
  };

  await writeFile(JSON_PATH, JSON.stringify(data, null, 2) + "\n", "utf-8");
  console.log(`  guardado en src/data/availability.json`);

  if (ranges.length > 0) {
    const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
    const now = new Date().toISOString().slice(0, 10);
    const upcoming = sorted.filter((r) => r.end >= now);
    console.log("");
    console.log(`Próximas fechas reservadas (${upcoming.length} en total):`);
    for (const r of upcoming.slice(0, 8)) {
      console.log(`  ${r.start} → ${r.end}`);
    }
    if (upcoming.length > 8) console.log(`  ... y ${upcoming.length - 8} más`);
  } else {
    console.log("");
    console.log("  (calendario vacío — todo disponible)");
  }
}

main().catch((err) => {
  console.error("✗ ERROR:", err.message);
  process.exit(1);
});
