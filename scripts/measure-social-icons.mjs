/**
 * measure-social-icons.mjs — mide los tres iconos sociales del navbar.
 *
 * AISLAMIENTO: Chrome headless propio, perfil temporal exclusivo
 * (.audit-profile-social) y puerto 9349. Solo cierra su propio proceso hijo.
 * No añadir `Get-Process chrome | Stop-Process` ni `taskkill`.
 *
 * Uso: node scripts/measure-social-icons.mjs [puerto]
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const DEBUG_PORT = 9349;
const PROFILE = resolve(process.cwd(), ".audit-profile-social");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROBE = `JSON.stringify((() => {
  const links = Array.from(document.querySelectorAll('.hdr__social .social__link'));
  return links.map((a) => {
    const b = a.getBoundingClientRect();
    const svg = a.querySelector('svg');
    const img = a.querySelector('img');
    const pintado = svg ?? img;
    let pintadoCaja = null;
    if (pintado) {
      const pb = pintado.getBoundingClientRect();
      pintadoCaja = { w: Math.round(pb.width * 10) / 10, h: Math.round(pb.height * 10) / 10 };
    }
    return {
      red: (a.getAttribute('aria-label') || '').split(' ')[0],
      caja: { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) },
      tipo: svg ? 'svg' : 'img',
      pintado: pintadoCaja,
      fill: svg ? getComputedStyle(svg).fill : null,
      stroke: svg ? getComputedStyle(svg).stroke : null,
      color: getComputedStyle(a).color,
      opacidad: getComputedStyle(a).opacity,
      // Caja real del trazado dentro del svg (getBBox)
      bbox: svg && svg.getBBox ? (() => { const bb = svg.getBBox(); return { x: Math.round(bb.x*10)/10, y: Math.round(bb.y*10)/10, w: Math.round(bb.width*10)/10, h: Math.round(bb.height*10)/10 }; })() : null,
    };
  });
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
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}/` }, sessionId);
  await sleep(2400);

  const out = await cdp("Runtime.evaluate", { expression: PROBE, returnByValue: true }, sessionId);
  const iconos = JSON.parse(out.result.value);

  console.log("\n=== iconos sociales del navbar (1440 px) ===");
  for (const i of iconos) {
    console.log(
      `  ${i.red.padEnd(10)} caja ${i.caja.x}→${i.caja.x + i.caja.w} (${i.caja.w}×${i.caja.h})` +
        `  tipo=${i.tipo}  pintado=${i.pintado.w}×${i.pintado.h}`,
    );
    if (i.bbox) {
      console.log(
        `             bbox del trazado: x=${i.bbox.x} y=${i.bbox.y} ${i.bbox.w}×${i.bbox.h}` +
          `  fill=${i.fill}  stroke=${i.stroke}`,
      );
    }
    console.log(`             color=${i.color}  opacidad=${i.opacidad}`);
  }

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
