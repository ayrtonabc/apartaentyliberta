/**
 * measure-ratings.mjs — mide las fuentes de valoración de la franja de confianza.
 *
 * AISLAMIENTO: abre su propia instancia de Chrome headless con perfil temporal
 * exclusivo (.audit-profile-ratings) y puerto de depuración propio (9344). Solo
 * cierra el proceso hijo que él mismo lanza; nunca toca instancias abiertas.
 * No añadir `Get-Process chrome | Stop-Process` ni `taskkill`.
 *
 * Uso: node scripts/measure-ratings.mjs [puerto]
 */
import { spawn } from "node:child_process";
import { rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const DEBUG_PORT = 9344;
const PROFILE = resolve(process.cwd(), ".audit-profile-ratings");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MEASURE = `JSON.stringify((() => {
  const box = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return {
      x: Math.round(b.left), y: Math.round(b.top),
      w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right),
    };
  };
  const sources = Array.from(document.querySelectorAll('.trust__sources .rsource'));
  return {
    rating: box(document.querySelector('.trust__rating')),
    overall: box(document.querySelector('.trust__overall')),
    sources: box(document.querySelector('.trust__sources')),
    items: sources.map((a) => {
      const logo = a.querySelector('.rsource__logo');
      const cs = getComputedStyle(a);
      return {
        etiqueta: a.getAttribute('aria-label').split(' — ')[0],
        caja: box(a),
        display: cs.display,
        ancho: cs.width,
        logo: box(logo),
        logoEstilo: logo ? {
          w: getComputedStyle(logo).width,
          h: getComputedStyle(logo).height,
          maxH: getComputedStyle(logo).maxHeight,
        } : null,
      };
    }),
    solapan: (() => {
      if (sources.length < 2) return false;
      const a = sources[0].getBoundingClientRect();
      const b = sources[1].getBoundingClientRect();
      return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
    })(),
  };
})())`;

async function main() {
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

  const { targetId } = await cdp("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
  await cdp("Page.enable", {}, sessionId);
  await cdp("Runtime.enable", {}, sessionId);

  for (const w of [1440, 1280, 1150]) {
    await cdp(
      "Emulation.setDeviceMetricsOverride",
      { width: w, height: 900, deviceScaleFactor: 1, mobile: false },
      sessionId,
    );
    await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}/` }, sessionId);
    await sleep(2200);

    const out = await cdp("Runtime.evaluate", { expression: MEASURE, returnByValue: true }, sessionId);
    const m = JSON.parse(out.result.value);

    console.log(`\n=== ${w} px ===`);
    console.log(`  contenedor valoración ${JSON.stringify(m.rating)}`);
    console.log(`  fila nota+estrellas    ${JSON.stringify(m.overall)}`);
    console.log(`  lista de fuentes       ${JSON.stringify(m.sources)}`);
    console.log(`  ¿solapan?              ${m.solapan ? "SÍ" : "no"}`);
    for (const it of m.items) {
      console.log(
        `    ${it.etiqueta.padEnd(14)} caja ${JSON.stringify(it.caja)}` +
          `  display=${it.display}  ancho=${it.ancho}  logo=${JSON.stringify(it.logo)}`,
      );
      if (it.logoEstilo) console.log(`      logo css → ${JSON.stringify(it.logoEstilo)}`);
    }
  }

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
