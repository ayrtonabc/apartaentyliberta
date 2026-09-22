/**
 * API endpoint: /api/booking
 * POST: recibe la solicitud de reserva, valida, comprueba disponibilidad y
 * envía el email de aviso al propietario más una confirmación al huésped.
 *
 * Los textos de los emails se generan en el idioma del visitante (campo
 * `locale` del formulario), de modo que un huésped alemán recibe su
 * confirmación en alemán.
 */
import type { APIRoute } from "astro";
import { z } from "zod";
import { site } from "~/data/site";
import { checkAvailability, loadBookedRanges } from "~/lib/availability";

export const prerender = false;

const BookingSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().min(5).max(30),
  apartment: z.enum(["i", "ii", "iii", "iv", "any"]),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.coerce.number().int().min(1).max(8),
  children: z.coerce.number().int().min(0).max(8).optional().default(0),
  notes: z.string().max(500).optional().default(""),
  locale: z.enum(["pl", "en", "de"]).optional().default("pl"),
  consent: z.literal("on"),
  honeypot: z.string().max(0).optional().default(""),
});

/** Límite simple en memoria por IP (en producción conviene Redis/Upstash). */
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return true;
}

type Locale = "pl" | "en" | "de";

const copy: Record<
  Locale,
  {
    ownerSubject: (name: string, apartment: string) => string;
    ownerTitle: string;
    clientSubject: string;
    clientTitle: string;
    greeting: (name: string) => string;
    received: (apartment: string, checkIn: string, checkOut: string) => string;
    reply: string;
    urgent: string;
    regards: string;
    unavailable: string;
    fields: {
      name: string;
      email: string;
      phone: string;
      apartment: string;
      checkIn: string;
      checkOut: string;
      guests: string;
      children: string;
      notes: string;
      language: string;
    };
  }
> = {
  pl: {
    ownerSubject: (name, apartment) => `Nowe zapytanie: ${name} — Apartament ${apartment}`,
    ownerTitle: "Nowe zapytanie o rezerwację",
    clientSubject: "Otrzymaliśmy Twoje zapytanie o rezerwację — Apartamenty Liberta",
    clientTitle: "Dziękujemy za zapytanie",
    greeting: (name) => `${name},`,
    received: (apartment, checkIn, checkOut) =>
      `Otrzymaliśmy Twoje zapytanie o rezerwację apartamentu ${apartment} od ${checkIn} do ${checkOut}.`,
    reply: "Odezwiemy się w ciągu 24 godzin z potwierdzeniem dostępności.",
    urgent: "Jeśli masz pilne pytania, zadzwoń:",
    regards: "Pozdrawiamy",
    unavailable: "Wybrane daty nie są dostępne. Proszę wybrać inne daty lub zadzwonić:",
    fields: {
      name: "Imię i nazwisko",
      email: "E-mail",
      phone: "Telefon",
      apartment: "Apartament",
      checkIn: "Data przyjazdu",
      checkOut: "Data wyjazdu",
      guests: "Liczba gości",
      children: "Dzieci",
      notes: "Uwagi",
      language: "Język strony",
    },
  },
  en: {
    ownerSubject: (name, apartment) => `New enquiry: ${name} — Apartment ${apartment}`,
    ownerTitle: "New booking enquiry",
    clientSubject: "We received your booking enquiry — Apartamenty Liberta",
    clientTitle: "Thank you for your enquiry",
    greeting: (name) => `${name},`,
    received: (apartment, checkIn, checkOut) =>
      `We have received your enquiry for apartment ${apartment} from ${checkIn} to ${checkOut}.`,
    reply: "We will get back to you within 24 hours confirming availability.",
    urgent: "If your question is urgent, call us:",
    regards: "Best regards",
    unavailable: "Those dates are not available. Please choose other dates or call us:",
    fields: {
      name: "Full name",
      email: "Email",
      phone: "Phone",
      apartment: "Apartment",
      checkIn: "Arrival",
      checkOut: "Departure",
      guests: "Guests",
      children: "Children",
      notes: "Notes",
      language: "Site language",
    },
  },
  de: {
    ownerSubject: (name, apartment) => `Neue Anfrage: ${name} — Ferienwohnung ${apartment}`,
    ownerTitle: "Neue Buchungsanfrage",
    clientSubject: "Ihre Buchungsanfrage ist angekommen — Apartamenty Liberta",
    clientTitle: "Vielen Dank für Ihre Anfrage",
    greeting: (name) => `${name},`,
    received: (apartment, checkIn, checkOut) =>
      `Wir haben Ihre Anfrage für Ferienwohnung ${apartment} vom ${checkIn} bis ${checkOut} erhalten.`,
    reply: "Wir melden uns innerhalb von 24 Stunden mit der Verfügbarkeitsbestätigung.",
    urgent: "Bei dringenden Fragen rufen Sie uns an:",
    regards: "Mit freundlichen Grüßen",
    unavailable: "Dieser Termin ist nicht verfügbar. Bitte wählen Sie andere Daten oder rufen Sie an:",
    fields: {
      name: "Vor- und Nachname",
      email: "E-Mail",
      phone: "Telefon",
      apartment: "Ferienwohnung",
      checkIn: "Anreise",
      checkOut: "Abreise",
      guests: "Gäste",
      children: "Kinder",
      notes: "Anmerkungen",
      language: "Sprache der Website",
    },
  },
};

function emailShell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f8f5ef;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#12211b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2dbcd;">
    <tr><td style="padding:28px 32px;background:#0e1a15;color:#f4f1ea;">
      <div style="font-size:20px;font-weight:600;letter-spacing:-0.02em;">${site.name}</div>
      <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#9dbfae;margin-top:6px;">${title}</div>
    </td></tr>
    <tr><td style="padding:28px 32px;font-size:15px;line-height:1.7;">${bodyHtml}</td></tr>
    <tr><td style="padding:20px 32px;background:#f2efe9;font-size:12px;color:#5c6b62;">
      ${site.address.full} · <a href="tel:${site.phone.tel}" style="color:#1e4d3a;">${site.phone.display}</a> · <a href="mailto:${site.email}" style="color:#1e4d3a;">${site.email}</a>
    </td></tr>
  </table>
</body></html>`;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress || "unknown";

  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ ok: false, error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  let data: FormData;
  try {
    data = await request.formData();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid form data" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = BookingSchema.safeParse(Object.fromEntries(data));

  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const booking = parsed.data;
  const tx = copy[booking.locale as Locale];

  // Honeypot: respuesta de éxito silenciosa para no avisar al bot
  if (booking.honeypot && booking.honeypot.length > 0) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Disponibilidad contra el calendario importado de Booking.com
  try {
    const { ranges, source } = await loadBookedRanges();
    const check = checkAvailability(ranges, booking.checkIn, booking.checkOut);
    if (!check.available) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "dates_unavailable",
          message: `${tx.unavailable} ${site.phone.display}`,
          conflicts: check.conflicts,
          source,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      );
    }
  } catch (err) {
    // Fail-open: el propietario confirma igualmente por email
    console.error("[booking] no se pudo comprobar el calendario:", err);
  }

  const apartmentLabel = booking.apartment === "any" ? "—" : booking.apartment.toUpperCase();

  const rows: Array<[string, string]> = [
    [tx.fields.name, booking.name],
    [tx.fields.email, booking.email],
    [tx.fields.phone, booking.phone],
    [tx.fields.apartment, apartmentLabel],
    [tx.fields.checkIn, booking.checkIn],
    [tx.fields.checkOut, booking.checkOut],
    [tx.fields.guests, String(booking.guests)],
    [tx.fields.children, String(booking.children)],
    [tx.fields.notes, booking.notes || "—"],
    [tx.fields.language, booking.locale.toUpperCase()],
  ];

  const ownerBody = `
    <p style="margin:0 0 16px;">${rows
      .map(
        ([label, value]) =>
          `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}`,
      )
      .join("<br>")}</p>
    <p style="margin:0;color:#5c6b62;font-size:13px;">${new Date().toISOString()}</p>
  `;

  const clientBody = `
    <p style="margin:0 0 14px;">${escapeHtml(tx.greeting(booking.name))}</p>
    <p style="margin:0 0 14px;">${escapeHtml(
      tx.received(apartmentLabel, booking.checkIn, booking.checkOut),
    )}</p>
    <p style="margin:0 0 14px;">${escapeHtml(tx.reply)}</p>
    <p style="margin:0;">${escapeHtml(tx.urgent)} <a href="tel:${site.phone.tel}" style="color:#1e4d3a;font-weight:600;">${site.phone.display}</a></p>
    <p style="margin:20px 0 0;">${escapeHtml(tx.regards)},<br>${site.name}</p>
  `;

  try {
    const resendApiKey = import.meta.env.RESEND_API_KEY;

    if (resendApiKey) {
      const { Resend } = await import("resend");
      const resend = new Resend(resendApiKey);

      const results = await Promise.allSettled([
        resend.emails.send({
          from: `${site.name} <noreply@apartamentyliberta.pl>`,
          to: site.email,
          replyTo: booking.email,
          subject: tx.ownerSubject(booking.name, apartmentLabel),
          html: emailShell(tx.ownerTitle, ownerBody),
        }),
        resend.emails.send({
          from: `${site.name} <noreply@apartamentyliberta.pl>`,
          to: booking.email,
          subject: tx.clientSubject,
          html: emailShell(tx.clientTitle, clientBody),
        }),
      ]);

      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(`[booking] fallo al enviar email ${index === 0 ? "al propietario" : "al huésped"}:`, result.reason);
        }
      });
    } else {
      console.log("BOOKING REQUEST (sin RESEND_API_KEY, solo log):", {
        ...booking,
        honeypot: undefined,
        consent: undefined,
        timestamp: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Booking error:", error);
    return new Response(JSON.stringify({ ok: false, error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
