/**
 * capture-element.mjs — captura un elemento concreto de una página.
 *
 * AISLAMIENTO: Chrome headless propio, perfil temporal exclusivo
 * (.audit-profile-elem) y puerto 9381. Solo cierra su propio proceso hijo.
 *
 * Uso: node scripts/capture-element.mjs [puerto] [ruta] [selector] [archivo] [ancho]
 */
import { spawn } from "node:child_process";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const RUTA = process.argv[3] ?? "/";
const SELECTOR = process.argv[4] ?? "[data-gallery]";
const ARCHIVO = process.argv[5] ?? "elemento.png";
const ANCHO = Number(process.argv[6] ?? 1440);
const DEBUG_PORT = 9381;
const PROFILE = resolve(process.cwd(), ".audit-profile-elem");
const OUT = resolve(process.cwd(), ".audit");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
      }, 20000);
    });

  const { targetId } = await cdp("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
  await cdp("Page.enable", {}, sessionId);
  await cdp("Runtime.enable", {}, sessionId);
  await cdp(
    "Emulation.setDeviceMetricsOverride",
    { width: ANCHO, height: 900, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}${RUTA}` }, sessionId);
  await sleep(3200);

  // Cargar perezosas bajando y subiendo
  await cdp(
    "Runtime.evaluate",
    { expression: `(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 80));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 500));
      return 'ok';
    })()`, awaitPromise: true },
    sessionId,
  );
  await sleep(1200);

  // Forzar la carga: con loading="lazy" y una captura fuera del viewport, el
  // navegador no pinta las imágenes y el recorte sale en blanco.
  await cdp(
    "Runtime.evaluate",
    {
      expression: `(async () => {
        const imgs = Array.from(document.querySelectorAll('img[loading="lazy"]'));
        imgs.forEach((i) => { i.loading = 'eager'; });
        await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
        await new Promise((r) => setTimeout(r, 800));
        return imgs.length;
      })()`,
      awaitPromise: true,
    },
    sessionId,
  );

  const caja = await cdp(
    "Runtime.evaluate",
    {
      expression: `(() => {
        const el = document.querySelector(${JSON.stringify(SELECTOR)});
        if (!el) return null;
        el.scrollIntoView({ block: 'start' });
        const r = el.getBoundingClientRect();
        return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
      })()`,
      returnByValue: true,
    },
    sessionId,
  );

  const b = caja.result.value;
  if (!b) {
    console.log(`  no se encontró ${SELECTOR}`);
    ws.close();
    child.kill();
    return;
  }

  console.log(`  ${SELECTOR}: ${Math.round(b.width)}×${Math.round(b.height)} en y=${Math.round(b.y)}`);

  /*
   * Captura del viewport, NO recortada con `clip`.
   *
   * El recorte fuera del viewport devolvía una imagen en blanco (el navegador no
   * pinta la zona no visible aunque las imágenes estén cargadas). Con scroll
   * previo y captura normal se ve lo mismo y funciona.
   */
  await sleep(900);
  const shot = await cdp("Page.captureScreenshot", { format: "png" }, sessionId);
  await writeFile(resolve(OUT, ARCHIVO), Buffer.from(shot.data, "base64"));
  console.log(`  captura: .audit/${ARCHIVO}`);

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
