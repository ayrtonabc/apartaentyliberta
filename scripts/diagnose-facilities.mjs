/**
 * diagnose-facilities.mjs — por qué una tarjeta deja hueco bajo la foto.
 *
 * AISLAMIENTO: Chrome headless propio, perfil temporal exclusivo
 * (.audit-profile-fac2) y puerto 9360. Solo cierra su propio proceso hijo.
 *
 * Uso: node scripts/diagnose-facilities.mjs [puerto]
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const DEBUG_PORT = 9360;
const PROFILE = resolve(process.cwd(), ".audit-profile-fac2");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROBE = `JSON.stringify((() => {
  const cards = Array.from(document.querySelectorAll('.fac__card'));
  return cards.slice(0, 3).map((c) => {
    const media = c.querySelector('.fac__media');
    const img = c.querySelector('.fac__media img');
    const body = c.querySelector('.fac__body');
    const cs = getComputedStyle(c);
    const ms = getComputedStyle(media);
    const is = getComputedStyle(img);
    const bs = getComputedStyle(body);
    return {
      nombre: c.querySelector('.fac__name').textContent.trim(),
      tarjeta: { h: Math.round(c.getBoundingClientRect().height), alignSelf: cs.alignSelf, display: cs.display },
      media: {
        h: Math.round(media.getBoundingClientRect().height),
        aspectRatio: ms.aspectRatio,
        flex: ms.flex,
        alignSelf: ms.alignSelf,
        flexShrink: ms.flexShrink,
        position: ms.position,
      },
      img: {
        h: Math.round(img.getBoundingClientRect().height),
        objectFit: is.objectFit,
        position: is.position,
        height: is.height,
        inset: is.inset,
      },
      body: { h: Math.round(body.getBoundingClientRect().height), flex: bs.flex, gap: bs.gap },
      // Espacio vacío al final de la tarjeta
      sobra: Math.round(
        c.getBoundingClientRect().bottom - (body.getBoundingClientRect().bottom || c.getBoundingClientRect().bottom),
      ),
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
    { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}/apartamenty/` }, sessionId);
  await sleep(3000);

  const out = await cdp("Runtime.evaluate", { expression: PROBE, returnByValue: true }, sessionId);
  const datos = JSON.parse(out.result.value);

  for (const d of datos) {
    console.log(`\n=== ${d.nombre} ===`);
    console.log(`  tarjeta: alto ${d.tarjeta.h}  display=${d.tarjeta.display} align-self=${d.tarjeta.alignSelf}`);
    console.log(
      `  media:   alto ${d.media.h}  aspect-ratio=${d.media.aspectRatio}  flex=${d.media.flex}` +
        `  shrink=${d.media.flexShrink}  position=${d.media.position}  align-self=${d.media.alignSelf}`,
    );
    console.log(
      `  img:     alto ${d.img.h}  object-fit=${d.img.objectFit}  position=${d.img.position}` +
        `  height=${d.img.height}  inset=${d.img.inset}`,
    );
    console.log(`  cuerpo:  alto ${d.body.h}  flex=${d.body.flex}  gap=${d.body.gap}`);
  }

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
