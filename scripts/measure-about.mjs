/**
 * measure-about.mjs — mide la sección "sobre nosotros" de la portada.
 *
 * AISLAMIENTO: Chrome headless propio, perfil temporal exclusivo
 * (.audit-profile-about2) y puerto 9376. Solo cierra su propio proceso hijo.
 *
 * Lo que interesa: el alto del texto frente al de la figura, y qué proporción
 * tendría la figura si se estirara a esa altura. El plano es 3:2 y los rótulos
 * van pegados a los bordes, así que una proporción muy cuadrada los recortaría.
 *
 * Uso: node scripts/measure-about.mjs [puerto] [ancho]
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const ANCHO = Number(process.argv[3] ?? 1440);
const DEBUG_PORT = 9376;
const PROFILE = resolve(process.cwd(), ".audit-profile-about2");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MEDIDA = `JSON.stringify((() => {
  const fig = document.querySelector('.about__figure');
  const col = fig ? fig.parentElement : null;
  const textos = Array.from(col ? col.children : []).filter((c) => c !== fig);
  const r = (el) => { const b = el.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top), bottom: Math.round(b.bottom) }; };

  const textoAlto = textos.reduce((max, el) => Math.max(max, r(el).h), 0);
  const f = fig ? r(fig) : null;
  const img = fig ? fig.querySelector('img') : null;

  return {
    columna: col ? r(col) : null,
    texto: textoAlto,
    figura: f,
    ratioFigura: f ? (f.w / f.h).toFixed(3) : null,
    ratioNatural: img && img.naturalWidth ? (img.naturalWidth / img.naturalHeight).toFixed(3) : null,
    // Si la figura se estirara al alto del texto, qué proporción tendría
    ratioSiEstira: f ? (f.w / textoAlto).toFixed(3) : null,
    columnas: col ? getComputedStyle(col).gridTemplateColumns : null,
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
  await cdp(
    "Emulation.setDeviceMetricsOverride",
    { width: ANCHO, height: 1000, deviceScaleFactor: 1, mobile: ANCHO < 700 },
    sessionId,
  );
  await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}/` }, sessionId);
  await sleep(2800);

  await cdp(
    "Runtime.evaluate",
    { expression: `(() => { const f = document.querySelector('.about__figure'); if (f) f.scrollIntoView({block:'center'}); return 'ok'; })()` },
    sessionId,
  );
  await sleep(1400);

  const d = JSON.parse((await cdp("Runtime.evaluate", { expression: MEDIDA, returnByValue: true }, sessionId)).result.value);

  console.log(`\n=== sección "sobre nosotros" · ${ANCHO} px ===`);
  console.log(`  columnas de la rejilla: ${d.columnas}`);
  console.log(`  alto del texto: ${d.texto} px`);
  console.log(`  figura: ${d.figura.w}×${d.figura.h} (ratio ${d.ratioFigura})`);
  console.log(`  imagen nativa: ratio ${d.ratioNatural}`);
  console.log(`  → si la figura se estirara al alto del texto: ratio ${d.ratioSiEstira}`);
  console.log(
    `     recorte respecto al original: ${d.ratioNatural ? Math.round((1 - Number(d.ratioSiEstira) / Number(d.ratioNatural)) * 100) : "?"}% del alto`,
  );

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
