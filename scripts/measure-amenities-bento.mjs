/**
 * measure-amenities-bento.mjs — mide las tarjetas de la sección de equipamiento.
 *
 * AISLAMIENTO: Chrome headless propio, perfil temporal exclusivo
 * (.audit-profile-bento) y puerto 9370. Solo cierra su propio proceso hijo.
 *
 * Uso: node scripts/measure-amenities-bento.mjs [puerto] [ancho]
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const ANCHO = Number(process.argv[3] ?? 1440);
const DEBUG_PORT = 9370;
const PROFILE = resolve(process.cwd(), ".audit-profile-bento");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MEDIDA = `JSON.stringify((() => {
  const grid = document.querySelector('.amen__bento');
  const fotos = Array.from(document.querySelectorAll('.amen__photo'));
  return {
    rejilla: grid ? Math.round(grid.getBoundingClientRect().width) + 'x' + Math.round(grid.getBoundingClientRect().height) : null,
    fotos: fotos.map((f, i) => {
      const r = f.getBoundingClientRect();
      const cs = getComputedStyle(f);
      const img = f.querySelector('img');
      return {
        i,
        titulo: f.querySelector('.amen__photo-title')?.textContent?.trim(),
        tall: f.classList.contains('amen__photo--tall'),
        caja: Math.round(r.width) + 'x' + Math.round(r.height),
        ancho: Math.round(r.width),
        alto: Math.round(r.height),
        ratio: (r.width / r.height).toFixed(2),
        minHeight: cs.minHeight,
        columnas: cs.gridColumn,
        natural: img ? img.naturalWidth + 'x' + img.naturalHeight : null,
        ratioNatural: img && img.naturalWidth ? (img.naturalWidth / img.naturalHeight).toFixed(2) : null,
      };
    }),
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
    { width: ANCHO, height: 1000, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}/` }, sessionId);
  await sleep(3000);

  await cdp(
    "Runtime.evaluate",
    { expression: `(() => { const b = document.querySelector('.amen__bento'); if (b) b.scrollIntoView({block:'start'}); return 'ok'; })()` },
    sessionId,
  );
  await sleep(1800);

  const d = JSON.parse((await cdp("Runtime.evaluate", { expression: MEDIDA, returnByValue: true }, sessionId)).result.value);

  console.log(`\n=== bento de equipamiento · ${ANCHO} px ===`);
  console.log(`  rejilla: ${d.rejilla}\n`);
  console.log("  #  tarjeta                    caja         ratio  min-height  columnas  natural");

  for (const f of d.fotos) {
    console.log(
      `  ${f.i + 1}  ${String(f.titulo).slice(0, 24).padEnd(25)} ${f.caja.padEnd(12)} ${String(f.ratio).padEnd(6)}` +
        ` ${String(f.minHeight).padEnd(11)} ${String(f.columnas).padEnd(9)} ${f.natural ?? "-"}`,
    );
  }

  const tall = d.fotos.find((f) => f.tall);
  if (tall) {
    console.log(`\n  tarjeta alta: "${tall.titulo}"`);
    console.log(`    ${tall.ancho}×${tall.alto} · ratio ${tall.ratio} · foto nativa ${tall.natural} (ratio ${tall.ratioNatural})`);
    console.log(`    si la caja tuviera la proporción de la foto: ${tall.ancho} × ${Math.round(tall.ancho / Number(tall.ratioNatural))} px`);
  }

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
