/**
 * verify-gastro-image.mjs — comprueba la foto de la sección de gastronomía.
 *
 * AISLAMIENTO: Chrome headless propio, perfil temporal exclusivo
 * (.audit-profile-gastro) y puerto 9367. Solo cierra su propio proceso hijo.
 *
 * Comprueba:
 *   - que la imagen carga y qué variante sirve el srcset
 *   - el tamaño al que se muestra frente al nativo (para detectar que se ve blanda)
 *   - que la proporción coincide con la de la foto, sin recorte
 *
 * Uso: node scripts/verify-gastro-image.mjs [puerto] [ancho]
 */
import { spawn } from "node:child_process";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const ANCHO = Number(process.argv[3] ?? 1440);
const DEBUG_PORT = 9367;
const PROFILE = resolve(process.cwd(), ".audit-profile-gastro");
const OUT = resolve(process.cwd(), ".audit");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROBE = `JSON.stringify((() => {
  const fig = document.querySelector('.gastro__figure');
  if (!fig) return { error: 'no hay figura de gastronomía' };
  const img = fig.querySelector('img');
  const rf = fig.getBoundingClientRect();
  const ri = img.getBoundingClientRect();
  return {
    src: (img.currentSrc || img.src).split('/').pop(),
    alt: img.alt,
    cargada: img.complete && img.naturalWidth > 0,
    natural: img.naturalWidth + 'x' + img.naturalHeight,
    ratioNatural: (img.naturalWidth / img.naturalHeight).toFixed(3),
    figura: Math.round(rf.width) + 'x' + Math.round(rf.height),
    ratioFigura: (rf.width / rf.height).toFixed(3),
    imagen: Math.round(ri.width) + 'x' + Math.round(ri.height),
    objectFit: getComputedStyle(img).objectFit,
    // A cuántos píxeles de dispositivo se pinta (densidad 2 = retina)
    pxDispositivo: Math.round(ri.width * window.devicePixelRatio),
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
  await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}/atrakcje/` }, sessionId);
  await sleep(3000);

  await cdp(
    "Runtime.evaluate",
    { expression: `(() => { document.querySelector('.gastro__figure').scrollIntoView({block:'center'}); return 'ok'; })()` },
    sessionId,
  );
  await sleep(2200);

  const d = JSON.parse((await cdp("Runtime.evaluate", { expression: PROBE, returnByValue: true }, sessionId)).result.value);
  if (d.error) {
    console.log("  " + d.error);
    ws.close();
    child.kill();
    return;
  }

  console.log(`\n=== gastronomía · ${ANCHO} px ===`);
  console.log(`  archivo servido: ${d.src}`);
  console.log(`  alt: ${d.alt}`);
  console.log(`  cargada: ${d.cargada}   nativa: ${d.natural} (ratio ${d.ratioNatural})`);
  console.log(`  figura: ${d.figura} (ratio ${d.ratioFigura})   imagen: ${d.imagen}  object-fit=${d.objectFit}`);
  console.log(`  píxeles de dispositivo necesarios: ${d.pxDispositivo}`);

  const natural = Number(d.natural.split("x")[0]);
  const necesita = d.pxDispositivo;
  console.log(
    `\n  ¿hay suficiente resolución? ${necesita > natural ? `NO: se piden ${necesita} px y el archivo tiene ${natural}` : "sí"}`,
  );

  try {
    const shot = await cdp("Page.captureScreenshot", { format: "png" }, sessionId);
    await writeFile(resolve(OUT, "gastro.png"), Buffer.from(shot.data, "base64"));
    console.log("  captura: .audit/gastro.png");
  } catch {
    console.log("  captura no disponible");
  }

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
