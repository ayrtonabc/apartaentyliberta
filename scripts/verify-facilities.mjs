/**
 * verify-facilities.mjs — comprueba la sección de instalaciones.
 *
 * AISLAMIENTO: abre su propia instancia de Chrome headless con perfil temporal
 * exclusivo (.audit-profile-fac) y puerto de depuración propio (9359). Solo
 * cierra el proceso hijo que él mismo lanza; nunca toca instancias abiertas.
 * No añadir `Get-Process chrome | Stop-Process` ni `taskkill`.
 *
 * Comprueba que todas las fotos cargan de verdad (no solo que exista el <img>),
 * que la rejilla no tiene huecos y que las anchuras de las tarjetas son las
 * esperadas.
 *
 * Uso: node scripts/verify-facilities.mjs [puerto] [ancho]
 */
import { spawn } from "node:child_process";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const ANCHO = Number(process.argv[3] ?? 1440);
const DEBUG_PORT = 9359;
const PROFILE = resolve(process.cwd(), ".audit-profile-fac");
const OUT = resolve(process.cwd(), ".audit");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ESTADO = `JSON.stringify((() => {
  const cards = Array.from(document.querySelectorAll('.fac__card'));
  const grid = document.querySelector('.fac__grid');
  return {
    total: cards.length,
    scrollY: Math.round(window.scrollY),
    viewport: window.innerHeight,
    docAlto: document.documentElement.scrollHeight,
    anchos: [...new Set(cards.map((c) => Math.round(c.getBoundingClientRect().width)))].sort((a, b) => a - b),
    anchas: cards.filter((c) => c.classList.contains('fac__card--wide')).length,
    gridAncho: grid ? Math.round(grid.getBoundingClientRect().width) : null,
    gridAlto: grid ? Math.round(grid.getBoundingClientRect().height) : null,
    // Agrupa las tarjetas por fila para detectar huecos en la rejilla
    filas: (() => {
      const porFila = new Map();
      for (const c of cards) {
        const r = c.getBoundingClientRect();
        const clave = Math.round(r.top / 8) * 8;
        if (!porFila.has(clave)) porFila.set(clave, []);
        porFila.get(clave).push(Math.round(r.width));
      }
      return [...porFila.entries()].map(([top, anchos]) => ({ top, anchos, suma: anchos.reduce((a, b) => a + b, 0) }));
    })(),
    detalle: cards.map((c) => {
      const img = c.querySelector('img');
      return {
        nombre: c.querySelector('.fac__name')?.textContent?.trim(),
        texto: (c.querySelector('.fac__text')?.textContent || '').trim().length,
        ancho: Math.round(c.getBoundingClientRect().width),
        alto: Math.round(c.getBoundingClientRect().height),
        enViewport: (() => { const r = c.getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; })(),
        cargada: img ? img.complete && img.naturalWidth > 0 : false,
        natural: img ? img.naturalWidth + 'x' + img.naturalHeight : null,
        src: img ? (img.currentSrc || img.getAttribute('src') || '').split('/').pop() : null,
      };
    }),
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

  const { targetId } = await cdp("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
  await cdp("Page.enable", {}, sessionId);
  await cdp("Runtime.enable", {}, sessionId);
  await cdp(
    "Emulation.setDeviceMetricsOverride",
    { width: ANCHO, height: 1000, deviceScaleFactor: 1, mobile: ANCHO < 700 },
    sessionId,
  );
  await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}/apartamenty/` }, sessionId);
  await sleep(2600);

  // Bajar hasta la rejilla para que [data-reveal] la muestre y carguen las fotos
  await cdp(
    "Runtime.evaluate",
    { expression: `(() => { const e = document.querySelector('.fac__grid'); if (e) e.scrollIntoView({block:'start'}); return 'ok'; })()` },
    sessionId,
  );
  /*
   * RECORRER LA REJILLA ENTERA ANTES DE MEDIR.
   *
   * Las fotos llevan loading="lazy": el navegador solo las descarga cuando se
   * acercan al viewport. Midiendo desde arriba, las últimas tarjetas salían
   * como "no cargadas" cuando en realidad no habían llegado a pedirse. Es un
   * falso positivo del test, no un fallo de la página.
   */
  await cdp(
    "Runtime.evaluate",
    {
      expression: `(async () => {
        const paso = window.innerHeight * 0.8;
        const alto = document.querySelector('.fac__grid').getBoundingClientRect().height;
        for (let y = 0; y <= alto + window.innerHeight; y += paso) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 400));
        }
        return 'ok';
      })()`,
      awaitPromise: true,
    },
    sessionId,
  );
  await sleep(3500);

  const d = JSON.parse((await cdp("Runtime.evaluate", { expression: ESTADO, returnByValue: true }, sessionId)).result.value);

  console.log(`\n=== /apartamenty/ · instalaciones · ${ANCHO} px ===`);
  console.log(`  tarjetas: ${d.total}   de doble ancho: ${d.anchas}   rejilla: ${d.gridAncho} px`);
  console.log(`  scroll final: ${d.scrollY}   viewport: ${d.viewport}   alto del documento: ${d.docAlto}`);
  console.log(`  anchos distintos: ${d.anchos.join(", ")} px   alto total: ${d.gridAlto} px`);
  console.log("  filas (suma de anchos; el contenedor son 1144 px):");
  for (const f of d.filas) {
    const hueco = 1144 - f.suma - (f.anchos.length - 1) * 20;
    console.log(`    y=${String(f.top).padStart(5)}  ${f.anchos.join(" + ")} = ${f.suma}  hueco sobrante: ${hueco}px`);
  }
  console.log("");

  let sinCargar = 0;
  const textosCortos = [];
  for (const c of d.detalle) {
    const marca = c.cargada ? "OK " : (c.enViewport ? "NO " : "off");
    if (!c.cargada) sinCargar++;
    if (c.texto < 60) textosCortos.push(c.nombre);
    console.log(
      `    ${marca} ${String(c.ancho).padStart(4)}px${c.enViewport ? " vis" : " ---"}  ${String(c.nombre).padEnd(34)}` +
        ` texto=${String(c.texto).padStart(3)} car.  ${c.natural ?? "-"}`,
    );
  }

  console.log(`\n  fotos sin cargar: ${sinCargar}`);
  if (textosCortos.length) console.log(`  descripciones muy cortas: ${textosCortos.join(", ")}`);

  /*
   * Captura del viewport, no con `clip`.
   *
   * `Page.captureScreenshot` con clip sobre una sección muy alta devolvía una
   * imagen con el contenido cortado y un vacío debajo: en este entorno el clip
   * grande no es fiable. Se coloca la rejilla al principio de la ventana y se
   * captura el viewport, que sí respeta lo que se ve.
   */
  try {
    await cdp(
      "Runtime.evaluate",
      { expression: `(() => { const g = document.querySelector('.fac__map img'); g.scrollIntoView({block:'start'}); window.scrollBy(0,-110); return 'ok'; })()` },
      sessionId,
    );
    await sleep(900);
    const shot = await cdp("Page.captureScreenshot", { format: "png" }, sessionId);
    await writeFile(resolve(OUT, `facilities-${ANCHO}.png`), Buffer.from(shot.data, "base64"));
    console.log(`  captura: .audit/facilities-${ANCHO}.png`);
  } catch {
    console.log("  captura no disponible");
  }
  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
