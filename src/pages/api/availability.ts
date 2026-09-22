/**
 * API endpoint: /api/availability
 * GET /api/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD
 *
 * Devuelve { available, conflicts, source, cachedAt }
 * usado por el BookingForm para el live check de fechas.
 */

import type { APIRoute } from "astro";
import { checkAvailability, loadBookedRanges } from "~/lib/availability";

export const prerender = false;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GET: APIRoute = async ({ url }) => {
  const checkIn = url.searchParams.get("checkIn");
  const checkOut = url.searchParams.get("checkOut");

  if (!checkIn || !checkOut) {
    return jsonResponse(
      { ok: false, error: "Missing checkIn or checkOut" },
      400
    );
  }

  if (!DATE_RE.test(checkIn) || !DATE_RE.test(checkOut)) {
    return jsonResponse(
      { ok: false, error: "Invalid date format (use YYYY-MM-DD)" },
      400
    );
  }

  if (checkOut <= checkIn) {
    return jsonResponse(
      { ok: false, error: "checkOut must be after checkIn" },
      400
    );
  }

  // No chequear fechas muy lejanas (> 2 años) — protección básica
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setFullYear(maxDate.getFullYear() + 2);
  if (new Date(checkIn) > maxDate) {
    return jsonResponse(
      { ok: false, error: "Date too far in the future" },
      400
    );
  }

  try {
    const { ranges, source, cachedAt } = await loadBookedRanges();
    const result = checkAvailability(ranges, checkIn, checkOut);

    return jsonResponse({
      ok: true,
      available: result.available,
      conflicts: result.conflicts,
      source,
      cachedAt,
    });
  } catch (err) {
    console.error("[availability] error:", err);
    // Si falla la lectura, mejor dejamos pasar (fail-open) para no bloquear reservas
    return jsonResponse({
      ok: true,
      available: true,
      source: "error",
      warning: "Could not verify availability, please confirm by phone",
    });
  }
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
