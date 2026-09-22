/**
 * verify-mosaic-grid.mjs — comprueba que el mosaico no deja huecos.
 *
 * AISLAMIENTO: Chrome headless propio, perfil temporal exclusivo
 * (.audit-profile-grid) y puerto 9382. Solo cierra su propio proceso hijo.
 *
 * En lugar de mirar una captura —donde un hueco se confunde con el fondo— se
 * reconstruye la rejilla a partir de la posición real de cada foto: se calcula
 * cuántas celdas ocupa cada una y se comprueba que el total cuadra con las
 * columnas × filas y que ninguna zona queda sin cubrir.
 *
 * Uso: node scripts/verify-mosaic-grid.mjs [puerto] [ancho]
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const ANCHO = Number(process.argv[3] ?? 1440);
const DEBUG_PORT = 9382;
const PROFILE = resolve(process.cwd(), ".audit-profile-grid");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROBE = `JSON.stringify((() => {
  const mosaic = document.querySelector('.gal__mosaic');
  if (!mosaic) return { error: 'no hay mosaico' };
  const cs = getComputedStyle(mosaic);
  const columnas = cs.gridTemplateColumns.split(' ').length;
  const filas = cs.gridTemplateRows.split(' ').length;

  const mr = mosaic.getBoundingClientRect();
  const gapX = parseFloat(cs.columnGap) || 0;
  const gapY = parseFloat(cs.rowGap) || 0;
  const anchoCol = (mr.width - gapX * (columnas - 1)) / columnas;

  const tiles = Array.from(mosaic.querySelectorAll('.gal__tile')).map((t) => {
    const r = t.getBoundingClientRect();
    // Índice de columna y fila donde empieza la celda
    const col = Math.round((r.left - mr.left) / (anchoCol + gapX)) + 1;
    const fila = Math.round((r.top - mr.top) / (parseFloat(cs.gridTemplateRows.split(' ')[0]) + gapY)) + 1;
    const spanCols = Math.round((r.width + gapX) / (anchoCol + gapX));
    const altoFila = parseFloat(cs.gridTemplateRows.split(' ')[0]);
    const spanFilas = Math.round((r.height + gapY) / (altoFila + gapY));
    const img = t.querySelector('img');
    return {
      nombre: (img?.currentSrc || img?.src || '').split('/').pop(),
      alt: (img?.alt || '').slice(0, 34),
      col, fila, spanCols, spanFilas,
      w: Math.round(r.width), h: Math.round(r.height),
      ratio: (r.width / r.height).toFixed(2),
    };
  });

  return { columnas, filas, tiles };
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
    { width: ANCHO, height: 1000, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}/` }, sessionId);
  await sleep(3200);

  await cdp(
    "Runtime.evaluate",
    { expression: `(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 800) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
      window.scrollTo(0, 0);
      return 'ok';
    })()`, awaitPromise: true },
    sessionId,
  );
  await sleep(1200);

  const d = JSON.parse((await cdp("Runtime.evaluate", { expression: PROBE, returnByValue: true }, sessionId)).result.value);
  if (d.error) {
    console.log("  " + d.error);
    ws.close();
    child.kill();
    return;
  }

  console.log(`\n=== mosaico · ${ANCHO} px · rejilla ${d.columnas} columnas × ${d.filas} filas ===\n`);

  // Mapa de ocupación
  const ocupado = Array.from({ length: d.filas }, () => new Array(d.columnas).fill(null));

  for (const [i, t] of d.tiles.entries()) {
    for (let f = t.fila; f < t.fila + t.spanFilas; f++) {
      for (let c = t.col; c < t.col + t.spanCols; c++) {
        if (ocupado[f - 1] && ocupado[f - 1][c - 1] !== undefined) {
          ocupado[f - 1][c - 1] = i + 1;
        }
      }
    }
  }

  console.log("  MAPA (· = hueco vacío)");
  console.log("      " + Array.from({ length: d.columnas }, (_, i) => String((i + 1) % 10)).join(" "));
  for (const [f, fila] of ocupado.entries()) {
    console.log(`  f${String(f + 1).padStart(2)}  ` + fila.map((v) => (v === null ? "·" : String(v % 10))).join(" "));
  }

  const vacias = [];
  for (const [f, fila] of ocupado.entries()) {
    for (const [c, v] of fila.entries()) {
      if (v === null) vacias.push(`f${f + 1}c${c + 1}`);
    }
  }

  console.log(`\n  fotos: ${d.tiles.length}`);
  const repetidas = d.tiles.length - new Set(d.tiles.map((t) => t.nombre)).size;
  console.log(`  repetidas: ${repetidas}`);

  console.log("\n  FOTO                          CELDA        TAMAÑO      RATIO");
  for (const [i, t] of d.tiles.entries()) {
    console.log(
      `  ${String(i + 1).padStart(2)}. ${t.nombre.padEnd(24)} ${`f${t.fila}c${t.col} ${t.spanCols}×${t.spanFilas}`.padEnd(12)} ${`${t.w}×${t.h}`.padEnd(11)} ${t.ratio}`,
    );
  }

  console.log(`\n  celdas sin cubrir: ${vacias.length}${vacias.length ? " → " + vacias.join(" ") : ""}`);
  console.log(`  ${vacias.length === 0 ? "✓ la retícula está completa" : "✗ HAY HUECOS"}`);

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
