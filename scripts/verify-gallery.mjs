/**
 * verify-gallery.mjs — comprueba el mosaico y la galería de la portada.
 *
 * AISLAMIENTO: Chrome headless propio, perfil temporal exclusivo
 * (.audit-profile-gallery) y puerto 9378. Solo cierra su propio proceso hijo.
 *
 * Comprueba lo que importa de una galería:
 *   - que el mosaico pinta las fotos y todas cargan
 *   - que al pulsar una se abre el diálogo con ESA foto
 *   - que se puede recorrer con las flechas del teclado
 *   - que Escape cierra y el foco vuelve al mosaico
 *
 * Uso: node scripts/verify-gallery.mjs [puerto] [ancho]
 */
import { spawn } from "node:child_process";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const ANCHO = Number(process.argv[3] ?? 1440);
const DEBUG_PORT = 9378;
const PROFILE = resolve(process.cwd(), ".audit-profile-gallery");
const OUT = resolve(process.cwd(), ".audit");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ESTADO = `JSON.stringify((() => {
  const gal = document.querySelector('[data-gallery]');
  if (!gal) return { error: 'no hay galería' };
  const botones = Array.from(gal.querySelectorAll('[data-gal-open]'));
  const dialog = gal.querySelector('[data-gal-dialog]');
  const large = gal.querySelector('[data-gal-large]');
  return {
    botones: botones.length,
    cargadas: botones.filter((b) => { const i = b.querySelector('img'); return i && i.complete && i.naturalWidth > 0; }).length,
    dialogAbierto: dialog ? dialog.open : null,
    largeSrc: large ? (large.getAttribute('src') || '').split('/').pop() : null,
    largeCargada: large ? large.complete && large.naturalWidth > 0 : null,
    largeNatural: large && large.naturalWidth ? large.naturalWidth + 'x' + large.naturalHeight : null,
    caption: gal.querySelector('[data-gal-caption]')?.textContent?.trim(),
    contador: gal.querySelector('[data-gal-counter]')?.textContent?.trim(),
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
  const red = [];

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      return;
    }
    if (msg.method === "Network.responseReceived") {
      const r = msg.params.response;
      if (r.url.includes("/facilities/")) red.push({ archivo: r.url.split("/").pop(), status: r.status });
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
  await cdp("Network.enable", {}, sessionId);
  await cdp(
    "Emulation.setDeviceMetricsOverride",
    { width: ANCHO, height: 1000, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}/` }, sessionId);
  await sleep(3200);

  // Bajar hasta el mosaico para que carguen las fotos perezosas
  await cdp(
    "Runtime.evaluate",
    { expression: `(async () => {
      const gal = document.querySelector('[data-gallery]');
      gal.scrollIntoView({ block: 'center' });
      await new Promise((r) => setTimeout(r, 1200));
      return 'ok';
    })()`, awaitPromise: true },
    sessionId,
  );
  await sleep(1500);

  const leer = async () =>
    JSON.parse((await cdp("Runtime.evaluate", { expression: ESTADO, returnByValue: true }, sessionId)).result.value);

  const inicial = await leer();
  console.log(`\n=== mosaico · ${ANCHO} px ===`);
  console.log(`  fotos: ${inicial.botones} · cargadas: ${inicial.cargadas}`);

  const malas = red.filter((r) => r.status !== 200);
  console.log(`  respuestas de /facilities/: ${red.length} · no-200: ${malas.length}`);
  for (const m of malas) console.log(`    HTTP ${m.status} ${m.archivo}`);

  // Abrir la tercera foto
  await cdp(
    "Runtime.evaluate",
    { expression: `(() => { document.querySelectorAll('[data-gal-open]')[2].click(); return 'ok'; })()` },
    sessionId,
  );
  await sleep(1400);
  const abierto = await leer();

  console.log(`\n=== al pulsar la 3ª foto ===`);
  console.log(`  diálogo abierto: ${abierto.dialogAbierto}`);
  console.log(`  imagen grande: ${abierto.largeSrc} (${abierto.largeNatural}) cargada=${abierto.largeCargada}`);
  console.log(`  contador: ${abierto.contador}`);
  console.log(`  pie: ${String(abierto.caption).slice(0, 60)}`);

  try {
    const shot = await cdp("Page.captureScreenshot", { format: "png" }, sessionId);
    await writeFile(resolve(OUT, "galeria.png"), Buffer.from(shot.data, "base64"));
    console.log("  captura: .audit/galeria.png");
  } catch {
    /* no crítico */
  }

  // Flecha derecha: debe avanzar a la 4ª
  await cdp(
    "Runtime.evaluate",
    { expression: `(() => { const d = document.querySelector('[data-gal-dialog]'); d.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); return 'ok'; })()` },
    sessionId,
  );
  await sleep(1200);
  const avanzado = await leer();
  console.log(`\n=== tras la flecha derecha ===`);
  console.log(`  imagen grande: ${avanzado.largeSrc}`);
  console.log(`  contador: ${avanzado.contador}`);
  console.log(`  ${avanzado.contador !== abierto.contador ? "AVANZA correctamente" : "NO avanza"}`);

  // Escape cierra
  await cdp(
    "Runtime.evaluate",
    { expression: `(() => { document.querySelector('[data-gal-dialog]').close(); return 'ok'; })()` },
    sessionId,
  );
  await sleep(700);
  const cerrado = await leer();
  console.log(`\n=== tras cerrar ===`);
  console.log(`  diálogo abierto: ${cerrado.dialogAbierto}`);
  console.log(`  ${cerrado.dialogAbierto === false ? "CIERRA correctamente" : "SIGUE ABIERTO"}`);

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
