/**
 * measure-icon-alignment.mjs — mide si los tres iconos sociales quedan iguales.
 *
 * Comprueba lo que a simple vista no se ve:
 *   - el tamaño pintado de cada icono
 *   - que los tres estén centrados en su círculo (mismo eje y mismo centro)
 *   - que la imagen sobresalga o quede corta respecto a los otros
 *
 * AISLAMIENTO: Chrome headless propio, perfil temporal exclusivo
 * (.audit-profile-align) y puerto 9369. Solo cierra su propio proceso hijo.
 *
 * Uso: node scripts/measure-icon-alignment.mjs [puerto] [ruta]
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const RUTA = process.argv[3] ?? "/";
const DEBUG_PORT = 9369;
const PROFILE = resolve(process.cwd(), ".audit-profile-align");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MEDIDA = `JSON.stringify((() => {
  const enlaces = Array.from(document.querySelectorAll('.hdr__social .social__link'));
  return enlaces.map((a) => {
    const img = a.querySelector('img');
    const ra = a.getBoundingClientRect();
    const ri = img.getBoundingClientRect();
    const cs = getComputedStyle(img);
    return {
      red: (a.getAttribute('aria-label') || '').split(' ')[0],
      archivo: (img.currentSrc || img.src).split('/').pop(),
      // Círculo que lo contiene
      circulo: Math.round(ra.width) + 'x' + Math.round(ra.height),
      // Icono pintado
      ancho: Math.round(ri.width * 100) / 100,
      alto: Math.round(ri.height * 100) / 100,
      // Centrado: diferencia entre el centro del icono y el del círculo
      desvioX: Math.round((ri.left + ri.width / 2 - (ra.left + ra.width / 2)) * 100) / 100,
      desvioY: Math.round((ri.top + ri.height / 2 - (ra.top + ra.height / 2)) * 100) / 100,
      objectFit: cs.objectFit,
      widthCss: cs.width,
      heightCss: cs.height,
      cargada: img.complete && img.naturalWidth > 0,
      natural: img.naturalWidth + 'x' + img.naturalHeight,
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
  await sleep(2600);

  const iconos = JSON.parse((await cdp("Runtime.evaluate", { expression: MEDIDA, returnByValue: true }, sessionId)).result.value);

  console.log(`\n=== alineación de los iconos sociales · ${RUTA} ===\n`);
  console.log("  red         archivo                     círculo    icono          desvío X/Y   object-fit");

  for (const i of iconos) {
    console.log(
      `  ${String(i.red).padEnd(11)} ${String(i.archivo).padEnd(26)} ${i.circulo.padEnd(10)}` +
        ` ${`${i.ancho}×${i.alto}`.padEnd(14)} ${`${i.desvioX} / ${i.desvioY}`.padEnd(12)} ${i.objectFit}`,
    );
  }

  const anchos = iconos.map((i) => i.ancho);
  const altos = iconos.map((i) => i.alto);
  const mismo = new Set(anchos).size === 1 && new Set(altos).size === 1;
  const centrados = iconos.every((i) => Math.abs(i.desvioX) < 0.6 && Math.abs(i.desvioY) < 0.6);
  const cargados = iconos.every((i) => i.cargada);

  console.log(`\n  mismo tamaño los tres: ${mismo ? "SÍ" : `NO (${anchos.join(", ")} × ${altos.join(", ")})`}`);
  console.log(`  centrados en su círculo: ${centrados ? "SÍ" : "NO"}`);
  console.log(`  todos cargados: ${cargados ? "SÍ" : "NO"}`);

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
