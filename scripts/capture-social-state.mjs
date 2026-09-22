/**
 * capture-social-state.mjs — captura el bloque de iconos sociales del navbar.
 *
 * AISLAMIENTO: abre su propia instancia de Chrome headless con perfil temporal
 * exclusivo (.audit-profile-state) y puerto de depuración propio (9353). Solo
 * cierra el proceso hijo que él mismo lanza; nunca toca instancias abiertas.
 * No añadir `Get-Process chrome | Stop-Process` ni `taskkill`.
 *
 * Uso: node scripts/capture-social-state.mjs [puerto]
 */
import { spawn } from "node:child_process";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const DEBUG_PORT = 9353;
const PROFILE = resolve(process.cwd(), ".audit-profile-state");
const OUT = resolve(process.cwd(), ".audit");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const INFO = `JSON.stringify((() => {
  const box = document.querySelector('.hdr__social').getBoundingClientRect();
  const header = document.querySelector('[data-header]');
  return {
    tema: header.getAttribute('data-theme') || '(ninguno)',
    bloque: { x: Math.round(box.left), y: Math.round(box.top), w: Math.round(box.width), h: Math.round(box.height) },
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
      }, 12000);
    });

  const { targetId } = await cdp("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
  await cdp("Page.enable", {}, sessionId);
  await cdp("Runtime.enable", {}, sessionId);
  await cdp(
    "Emulation.setDeviceMetricsOverride",
    { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false },
    sessionId,
  );
  await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}/` }, sessionId);
  await sleep(2400);

  const info = JSON.parse(
    (await cdp("Runtime.evaluate", { expression: INFO, returnByValue: true }, sessionId)).result.value,
  );
  console.log("estado:", JSON.stringify(info));

  const clip = {
    x: Math.max(0, info.bloque.x - 60),
    y: 0,
    width: info.bloque.w + 70,
    height: 96,
    scale: 4,
  };

  try {
    const shot = await cdp("Page.captureScreenshot", { format: "png", clip }, sessionId);
    await writeFile(resolve(OUT, "icons-top.png"), Buffer.from(shot.data, "base64"));
    console.log("captura: .audit/icons-top.png");
  } catch {
    console.log("captura no disponible");
  }

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
