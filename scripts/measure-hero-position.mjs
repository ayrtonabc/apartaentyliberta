/**
 * measure-hero-position.mjs — mide dónde queda el contenido dentro del hero.
 *
 * AISLAMIENTO: Chrome headless propio, perfil temporal exclusivo
 * (.audit-profile-heropos) y puerto 9372. Solo cierra su propio proceso hijo.
 *
 * Da las distancias que importan para decidir si el bloque debe subir:
 *   - hueco entre el borde superior del hero y el eyebrow
 *   - hueco entre el buscador y el borde inferior del hero
 *
 * Uso: node scripts/measure-hero-position.mjs [puerto] [ancho] [alto] [ruta]
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const ANCHO = Number(process.argv[3] ?? 1440);
const ALTO = Number(process.argv[4] ?? 900);
const RUTA = process.argv[5] ?? "/";
const DEBUG_PORT = 9372;
const PROFILE = resolve(process.cwd(), ".audit-profile-heropos");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MEDIDA = `JSON.stringify((() => {
  const hero = document.querySelector('.hero');
  const inner = document.querySelector('.hero__inner');
  const eyebrow = document.querySelector('.hero__eyebrow');
  const titulo = document.querySelector('.hero__title');
  const sub = document.querySelector('.hero__subtitle');
  const quick = document.querySelector('.hero__quick');
  const cs = getComputedStyle(inner);

  const r = (el) => el ? el.getBoundingClientRect() : null;
  const rh = r(hero), ri = r(inner), re = r(eyebrow), rt = r(titulo), rs = r(sub), rq = r(quick);

  return {
    ventana: window.innerWidth + 'x' + window.innerHeight,
    hero: { alto: Math.round(rh.height), top: Math.round(rh.top), bottom: Math.round(rh.bottom) },
    inner: { alto: Math.round(ri.height), top: Math.round(ri.top), bottom: Math.round(ri.bottom), align: cs.alignItems, padding: cs.paddingTop + ' / ' + cs.paddingBottom },
    eyebrow: Math.round(re.top),
    titulo: Math.round(rt.top),
    subtitulo: Math.round(rs.top),
    quick: { top: Math.round(rq.top), bottom: Math.round(rq.bottom), alto: Math.round(rq.height) },
    // Las dos distancias que deciden si hay que subir el bloque
    huecoArriba: Math.round(re.top - rh.top),
    huecoAbajo: Math.round(rh.bottom - rq.bottom),
    contenidoAlto: Math.round(rq.bottom - re.top),
    sobra: Math.round(rh.height - (rq.bottom - re.top) - (re.top - rh.top) - (rh.bottom - rq.bottom)),
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
    { width: ANCHO, height: ALTO, deviceScaleFactor: 1, mobile: ANCHO < 700 },
    sessionId,
  );
  await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}${RUTA}` }, sessionId);
  await sleep(2800);

  const d = JSON.parse((await cdp("Runtime.evaluate", { expression: MEDIDA, returnByValue: true }, sessionId)).result.value);

  console.log(`\n=== posición del contenido del hero · ${d.ventana} · ${RUTA} ===`);
  console.log(`  hero: alto ${d.hero.alto}px  (${d.hero.top} → ${d.hero.bottom})`);
  console.log(`  .hero__inner: alto ${d.inner.alto}px  align-items=${d.inner.align}  padding ${d.inner.padding}`);
  console.log(`\n  eyebrow    top ${d.eyebrow}`);
  console.log(`  titular    top ${d.titulo}`);
  console.log(`  subtítulo  top ${d.subtitulo}`);
  console.log(`  buscador   ${d.quick.top} → ${d.quick.bottom}  (alto ${d.quick.alto})`);
  console.log(`\n  hueco arriba del eyebrow : ${d.huecoArriba} px`);
  console.log(`  hueco bajo el buscador   : ${d.huecoAbajo} px`);
  console.log(`  alto del bloque          : ${d.contenidoAlto} px`);

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
