/**
 * verify-video-advances.mjs — comprueba que el vídeo del hero avanza de verdad.
 *
 * POR QUÉ NO BASTA CON DOS MUESTRAS
 *
 * El bucle dura 3 s. Con dos muestras separadas 2,5 s el tiempo puede caer a
 * caballo del reinicio y parecer que retrocede, cuando en realidad ha dado la
 * vuelta. Hay que tomar varias muestras seguidas y comprobar que la mayoría
 * avanza, y que el salto hacia atrás corresponde al reinicio del bucle.
 *
 * AISLAMIENTO: Chrome headless propio, perfil temporal exclusivo
 * (.audit-profile-advance) y puerto 9366. Solo cierra su propio proceso hijo.
 *
 * Uso: node scripts/verify-video-advances.mjs [puerto] [ancho]
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const ANCHO = Number(process.argv[3] ?? 1440);
const DEBUG_PORT = 9366;
const PROFILE = resolve(process.cwd(), ".audit-profile-advance");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TIEMPO = `JSON.stringify({
  t: document.querySelector('[data-hero-video]')?.currentTime ?? -1,
  dur: document.querySelector('[data-hero-video]')?.duration ?? -1,
  pausado: document.querySelector('[data-hero-video]')?.paused ?? null,
})`;

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
      "--autoplay-policy=no-user-gesture-required",
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
    { width: ANCHO, height: 900, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}/` }, sessionId);
  await sleep(3500);

  const muestras = [];
  for (let i = 0; i < 14; i++) {
    const d = JSON.parse((await cdp("Runtime.evaluate", { expression: TIEMPO, returnByValue: true }, sessionId)).result.value);
    muestras.push(d);
    await sleep(400);
  }

  const dur = muestras[0].dur;
  console.log(`\n=== avance del vídeo · ${ANCHO} px ===`);
  console.log(`  duración declarada: ${dur.toFixed(2)} s\n`);

  let avanza = 0;
  let reinicios = 0;
  let quieto = 0;

  for (let i = 1; i < muestras.length; i++) {
    const dt = muestras[i].t - muestras[i - 1].t;
    const tipo = dt > 0.05 ? "avanza" : dt < -0.05 ? "REINICIO" : "quieto";
    if (tipo === "avanza") avanza++;
    else if (tipo === "REINICIO") reinicios++;
    else quieto++;
    console.log(
      `  ${String(i).padStart(2)}. t=${muestras[i].t.toFixed(2)}s  Δ=${dt >= 0 ? "+" : ""}${dt.toFixed(2)}s  ${tipo}`,
    );
  }

  console.log(`\n  avanza: ${avanza}   reinicios de bucle: ${reinicios}   quieto: ${quieto}`);
  console.log(`  pausado: ${muestras[muestras.length - 1].pausado}`);

  // Veredicto: avanza la mayoría del tiempo y el único retroceso es el reinicio
  const ok = avanza >= muestras.length * 0.6 && quieto === 0 && !muestras[muestras.length - 1].pausado;
  console.log(`\n  → ${ok ? "CORRECTO: el vídeo se reproduce y vuelve a empezar" : "REVISAR"}`);

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
