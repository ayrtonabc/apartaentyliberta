/**
 * check-console.mjs — errores de consola y estado del header.
 *
 * AISLAMIENTO: Chrome headless propio, perfil temporal exclusivo
 * (.audit-profile-consola) y puerto 9383. Solo cierra su propio proceso hijo.
 *
 * Uso: node scripts/check-console.mjs [puerto] [ruta]
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const RUTA = process.argv[3] ?? "/";
const DEBUG_PORT = 9383;
const PROFILE = resolve(process.cwd(), ".audit-profile-consola");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const errores = [];
  const logs = [];

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      return;
    }
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      errores.push(d.exception?.description ?? d.text);
    }
    if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) {
      logs.push(`${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ")}`);
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
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}${RUTA}` }, sessionId);
  await sleep(3500);

  const estado = await cdp(
    "Runtime.evaluate",
    {
      expression: `JSON.stringify((() => {
        const h = document.querySelector('[data-header]');
        const brand = document.querySelector('.hdr__brand');
        const light = document.querySelector('.hdr__wordmark--light');
        const dark = document.querySelector('.hdr__wordmark--dark');
        return {
          dataTheme: h ? h.getAttribute('data-theme') : null,
          dataState: h ? h.getAttribute('data-state') : null,
          colorTexto: h ? getComputedStyle(h).color : null,
          hayHero: Boolean(document.querySelector('[data-hero]')),
          scrollY: window.scrollY,
          marcaFondo: brand ? getComputedStyle(brand).backgroundColor : null,
          marcaPadding: brand ? getComputedStyle(brand).padding : null,
          lightOpacity: light ? getComputedStyle(light).opacity : null,
          darkOpacity: dark ? getComputedStyle(dark).opacity : null,
        };
      })())`,
      returnByValue: true,
    },
    sessionId,
  );

  console.log(`\n=== estado del header · ${RUTA} ===\n`);
  const d = JSON.parse(estado.result.value);
  for (const [k, v] of Object.entries(d)) console.log(`  ${k.padEnd(16)} ${v}`);

  console.log(`\n  errores de JS: ${errores.length}`);
  for (const e of errores) console.log(`    ✗ ${String(e).split("\n")[0]}`);
  console.log(`  avisos/errores de consola: ${logs.length}`);
  for (const l of logs.slice(0, 8)) console.log(`    · ${String(l).slice(0, 140)}`);

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
