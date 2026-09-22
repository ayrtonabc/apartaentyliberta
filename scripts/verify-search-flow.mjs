/**
 * verify-search-flow.mjs — comprueba el flujo de búsqueda en el navegador.
 *
 * AISLAMIENTO: Chrome headless propio, perfil temporal exclusivo
 * (.audit-profile-search) y puerto 9375. Solo cierra su propio proceso hijo.
 *
 * Prueba los tres estados que puede devolver la página de resultados:
 *   - fechas libres  → 4 apartamentos disponibles
 *   - fechas ocupadas → 4 ocupados y fechas alternativas con sentido
 *   - sin fechas      → mensaje de "completa las fechas"
 *
 * Uso: node scripts/verify-search-flow.mjs [puerto]
 */
import { spawn } from "node:child_process";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const DEBUG_PORT = 9375;
const PROFILE = resolve(process.cwd(), ".audit-profile-search");
const OUT = resolve(process.cwd(), ".audit");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CASOS = [
  { nombre: "fechas libres", q: "?checkIn=2026-11-10&checkOut=2026-11-14&guests=6", libre: true },
  { nombre: "fechas ocupadas", q: "?checkIn=2026-09-28&checkOut=2026-10-01&guests=6", libre: false },
  { nombre: "sin fechas", q: "", libre: null },
];

const PROBE = `JSON.stringify((() => {
  const overlay = document.querySelector('[data-srch-overlay]');
  const titulo = document.querySelector('h1')?.textContent?.trim();
  const tarjetas = Array.from(document.querySelectorAll('.srch__card')).map((c) => ({
    nombre: c.querySelector('.srch__name')?.textContent?.trim(),
    libre: c.classList.contains('is-free'),
    cta: (c.querySelector('.srch__cta')?.textContent || '').trim().replace(/\\s+/g, ' '),
  }));
  const alt = Array.from(document.querySelectorAll('.srch__alt-card')).map((a) => ({
    etiqueta: a.querySelector('.srch__alt-label')?.textContent?.trim(),
    rango: (a.querySelector('.srch__alt-range')?.textContent || '').replace(/\\s+/g, ' ').trim(),
    enlace: a.getAttribute('href'),
  }));
  const dias = Array.from(document.querySelectorAll('.srch__day'));
  return {
    titulo,
    overlayOculto: overlay ? overlay.hasAttribute('hidden') || getComputedStyle(overlay).visibility === 'hidden' : true,
    tarjetas,
    alt,
    diasTotales: dias.length,
    diasLibres: dias.filter((d) => d.classList.contains('is-free')).length,
    formAccion: document.querySelector('.srch__form')?.getAttribute('action'),
  };
})())`;

async function main() {
  await mkdir(OUT, { recursive: true });
  try {
    await rm(PROFILE, { recursive: true, force: true });
  } catch {
    /* se reutiliza */
  }

  const child = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE}`,
      "--no-first-run",
      "--disable-extensions",
      "--hide-scrollbars",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let version = null;
  for (let i = 0; i < 30; i++) {
    await sleep(400);
    try {
      version = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json();
      break;
    } catch {
      /* reintentar */
    }
  }

  if (!version?.webSocketDebuggerUrl) {
    child.kill();
    console.error("Chrome no expuso el puerto de depuración.");
    process.exit(1);
  }

  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res);
    ws.addEventListener("error", rej);
  });

  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
    }
  });

  const cdp = (method, params = {}, sessionId) =>
    new Promise((res, rej) => {
      const myId = ++id;
      pending.set(myId, { resolve: res, reject: rej });
      ws.send(JSON.stringify({ id: myId, method, params, sessionId }));
      setTimeout(() => {
        if (pending.has(myId)) {
          pending.delete(myId);
          rej(new Error(`${method}: sin respuesta`));
        }
      }, 15000);
    });

  for (const caso of CASOS) {
    const { targetId } = await cdp("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
    await cdp("Page.enable", {}, sessionId);
    await cdp("Runtime.enable", {}, sessionId);
    await cdp(
      "Emulation.setDeviceMetricsOverride",
      { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false },
      sessionId,
    );
    await cdp(
      "Page.navigate",
      { url: `http://localhost:${PORT_SITE}/rezerwacja/wyniki/${caso.q}` },
      sessionId,
    );
    await sleep(4200);

    const d = JSON.parse((await cdp("Runtime.evaluate", { expression: PROBE, returnByValue: true }, sessionId)).result.value);

    console.log(`\n=== ${caso.nombre} ===`);
    console.log(`  título: ${d.titulo}`);
    console.log(`  capa de búsqueda retirada: ${d.overlayOculto ? "sí" : "NO"}`);

    if (d.tarjetas.length) {
      const libres = d.tarjetas.filter((t) => t.libre).length;
      console.log(`  apartamentos: ${d.tarjetas.length} · libres: ${libres}`);
      for (const t of d.tarjetas) {
        console.log(`    ${t.libre ? "✓" : "·"} ${String(t.nombre).padEnd(24)} ${t.cta.slice(0, 46)}`);
      }
      if (caso.libre !== null) {
        const esperado = caso.libre ? 4 : 0;
        console.log(`  ${libres === esperado ? "CORRECTO" : `INCORRECTO (esperaba ${esperado} libres)`}`);
      }
    }

    if (d.alt.length) {
      console.log("  fechas alternativas:");
      for (const a of d.alt) console.log(`    ${a.etiqueta}: ${a.rango}`);
    }

    console.log(`  calendario: ${d.diasTotales} días · ${d.diasLibres} libres`);
    console.log(`  formulario envía a: ${d.formAccion}`);

    await cdp("Target.closeTarget", { targetId });
  }

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
