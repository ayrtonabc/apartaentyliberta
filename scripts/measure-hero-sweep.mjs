/**
 * measure-hero-sweep.mjs — busca el hueco óptimo entre el texto y el buscador.
 *
 * ---------------------------------------------------------------------------
 * AISLAMIENTO DEL NAVEGADOR
 * Abre su propia instancia de Chrome headless con perfil temporal exclusivo
 * (.audit-profile-sweep) y puerto de depuración propio (9337). Solo cierra el
 * proceso hijo que él mismo lanza; nunca toca instancias abiertas.
 * No añadir `Get-Process chrome | Stop-Process` ni `taskkill`.
 * ---------------------------------------------------------------------------
 *
 * Mide, para cada valor de separación vertical entre el bloque de texto y la
 * barra de reservas, si el hero sigue cabiendo sin scroll en cada ventana e
 * idioma. Sirve para elegir el hueco más generoso que no rompa nada.
 *
 * Uso: node scripts/measure-hero-sweep.mjs [puerto]
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const DEBUG_PORT = 9337;
const PROFILE = resolve(process.cwd(), ".audit-profile-sweep");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Huecos a probar, en px. */
const GAPS = [24, 32, 40, 48, 56, 64, 72];

const VIEWPORTS = [
  { label: "portatil-bajo", w: 1440, h: 720, mobile: false },
  { label: "portatil", w: 1440, h: 800, mobile: false },
  { label: "escritorio", w: 1440, h: 900, mobile: false },
  { label: "movil", w: 390, h: 844, mobile: true },
  { label: "movil-bajo", w: 360, h: 640, mobile: true },
];

const LOCALES = [
  { label: "PL", path: "/" },
  { label: "EN", path: "/en/" },
  { label: "DE", path: "/de/" },
];

const PROBE = (gap) => `JSON.stringify((() => {
  const quick = document.querySelector('.hero__quick');
  const stats = document.querySelector('.hero__stats');
  const sub = document.querySelector('.hero__subtitle');
  const prev = quick.style.marginTop;
  quick.style.marginTop = '${gap}px';
  const bottom = stats.getBoundingClientRect().bottom;
  const subBottom = sub.getBoundingClientRect().bottom;
  const quickTop = quick.getBoundingClientRect().top;
  const resultado = {
    hueco: Math.round(quickTop - subBottom),
    desborda: Math.round(Math.max(0, bottom - window.innerHeight)),
  };
  quick.style.marginTop = prev;
  return resultado;
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

  const tabla = [];

  for (const locale of LOCALES) {
    for (const vp of VIEWPORTS) {
      await cdp(
        "Emulation.setDeviceMetricsOverride",
        { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.mobile },
        sessionId,
      );
      await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}${locale.path}` }, sessionId);
      await sleep(2000);

      const fila = [];
      for (const gap of GAPS) {
        const out = await cdp(
          "Runtime.evaluate",
          { expression: PROBE(gap), returnByValue: true },
          sessionId,
        );
        const r = JSON.parse(out.result.value);
        fila.push({ gap, hueco: r.hueco, desborda: r.desborda });
      }
      tabla.push({ locale: locale.label, vp: vp.label, fila });
    }
  }

  console.log("Hueco resultante (px) y desborde (px). ✗ = no cabe sin scroll\n");
  console.log(
    "idioma ventana".padEnd(24) + GAPS.map((g) => `${g}px`.padStart(11)).join(""),
  );

  for (const t of tabla) {
    const celdas = t.fila
      .map((c) => `${c.hueco}${c.desborda > 0 ? ` ✗+${c.desborda}` : " ✓"}`.padStart(11))
      .join("");
    console.log(`${t.locale} ${t.vp}`.padEnd(24) + celdas);
  }

  console.log("\nResumen: el mayor hueco que cabe en TODAS las combinaciones →");
  const maximos = GAPS.map((gap) => {
    const fallos = tabla.filter((t) => {
      const c = t.fila.find((f) => f.gap === gap);
      return c && c.desborda > 0;
    });
    return { gap, fallos: fallos.length, donde: fallos.map((f) => `${f.locale}/${f.vp}`) };
  });

  for (const m of maximos) {
    console.log(
      `  ${String(m.gap).padStart(3)}px → ${m.fallos === 0 ? "cabe en todo" : `falla en ${m.fallos}: ${m.donde.join(", ")}`}`,
    );
  }

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
