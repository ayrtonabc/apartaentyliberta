/**
 * check-map-legend.mjs — comprueba que el plano y su leyenda se renderizan.
 *
 * AISLAMIENTO: Chrome headless propio, perfil temporal exclusivo
 * (.audit-profile-map) y puerto 9362. Solo cierra su propio proceso hijo.
 *
 * Uso: node scripts/check-map-legend.mjs [puerto] [ruta]
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const RUTA = process.argv[3] ?? "/apartamenty/";
const DEBUG_PORT = 9362;
const PROFILE = resolve(process.cwd(), ".audit-profile-map");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROBE = `JSON.stringify((() => {
  const fig = document.querySelector('.fac__map');
  if (!fig) return { error: 'no hay figura de plano' };
  const img = fig.querySelector('img');
  const r = img.getBoundingClientRect();
  return {
    src: img.currentSrc || img.src,
    alt: img.alt,
    cargada: img.complete && img.naturalWidth > 0,
    natural: img.naturalWidth + 'x' + img.naturalHeight,
    tam: Math.round(r.width) + 'x' + Math.round(r.height),
    proporcion: (r.width / r.height).toFixed(2),
    leyendaTitulo: fig.querySelector('.fac__legend-title')?.textContent?.trim(),
    items: Array.from(fig.querySelectorAll('.fac__legend-list li')).map((li) => ({
      nombre: li.querySelector('strong')?.textContent?.trim(),
      etiqueta: li.querySelector('span')?.textContent?.trim(),
    })),
    nota: fig.querySelector('.fac__legend-note')?.textContent?.trim(),
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
      }, 12000);
    });

  const { targetId } = await cdp("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
  await cdp("Page.enable", {}, sessionId);
  await cdp("Runtime.enable", {}, sessionId);
  await cdp(
    "Emulation.setDeviceMetricsOverride",
    { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}${RUTA}` }, sessionId);
  await sleep(2600);
  await cdp(
    "Runtime.evaluate",
    { expression: `(() => { document.querySelector('.fac__map').scrollIntoView({block:'center'}); return 'ok'; })()` },
    sessionId,
  );
  await sleep(2000);

  const d = JSON.parse((await cdp("Runtime.evaluate", { expression: PROBE, returnByValue: true }, sessionId)).result.value);
  if (d.error) {
    console.log("  " + d.error);
    ws.close();
    child.kill();
    return;
  }

  console.log(`\n=== plano · ${RUTA} ===`);
  console.log(`  src: ${d.src.split("/").pop()}`);
  console.log(`  cargada: ${d.cargada}   natural: ${d.natural}   en pantalla: ${d.tam} (proporción ${d.proporcion})`);
  console.log(`  alt: ${d.alt}`);
  console.log(`\n  leyenda: ${d.leyendaTitulo}`);
  for (const i of d.items) console.log(`    ${String(i.nombre).padEnd(16)} ${i.etiqueta}`);
  console.log(`\n  nota: ${d.nota}`);

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
