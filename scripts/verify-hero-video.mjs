/**
 * verify-hero-video.mjs — comprueba el vídeo de fondo del hero.
 *
 * AISLAMIENTO: abre su propia instancia de Chrome headless con perfil temporal
 * exclusivo (.audit-profile-video) y puerto de depuración propio (9358). Solo
 * cierra el proceso hijo que él mismo lanza; nunca toca instancias abiertas.
 * No añadir `Get-Process chrome | Stop-Process` ni `taskkill`.
 *
 * Comprueba lo que el HTML no garantiza:
 *   - que el navegador eligió la fuente correcta según el ancho
 *   - que reproduce de verdad (currentTime avanza), no solo que el atributo esté
 *   - que está silenciado y sin controles
 *   - que el póster y el encuadre son correctos
 *
 * Uso: node scripts/verify-hero-video.mjs [puerto] [ancho]
 */
import { spawn } from "node:child_process";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const ANCHO = Number(process.argv[3] ?? 1440);
const DEBUG_PORT = 9358;
const PROFILE = resolve(process.cwd(), ".audit-profile-video");
const OUT = resolve(process.cwd(), ".audit");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Estado del vídeo: fuente elegida, reproducción real, audio y controles. */
const ESTADO = `JSON.stringify((() => {
  const v = document.querySelector('[data-hero-video]');
  if (!v) return { error: 'no hay vídeo' };
  const r = v.getBoundingClientRect();
  const cs = getComputedStyle(v);
  return {
    fuente: v.currentSrc,
    // Chrome expone el <source> elegido en v.currentSrc
    fuentes: Array.from(v.querySelectorAll('source')).map((s) => ({
      src: s.getAttribute('src'),
      media: s.getAttribute('media') || '(sin media)',
    })),
    pausado: v.paused,
    tiempo: Number(v.currentTime.toFixed(2)),
    duracion: Number.isFinite(v.duration) ? Number(v.duration.toFixed(2)) : null,
    bucle: v.loop,
    silenciado: v.muted,
    volumen: v.volume,
    controles: v.controls,
    autoplay: v.autoplay,
    playsinline: v.hasAttribute('playsinline'),
    tabindex: v.getAttribute('tabindex'),
    ariaHidden: v.getAttribute('aria-hidden'),
    listo: v.readyState,
    tamano: { w: Math.round(r.width), h: Math.round(r.height) },
    objectFit: cs.objectFit,
    objectPosition: cs.objectPosition,
    // Encaje: ¿cubre todo el hero?
    hero: (() => { const h = document.querySelector('.hero').getBoundingClientRect(); return { w: Math.round(h.width), h: Math.round(h.height) }; })(),
    poster: v.getAttribute('poster'),
    // Errores de red al cargar el vídeo
    error: v.error ? v.error.code + ': ' + v.error.message : null,
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
    { width: ANCHO, height: 900, deviceScaleFactor: 1, mobile: ANCHO < 700 },
    sessionId,
  );
  await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}/` }, sessionId);
  await sleep(4500);

  const leer = async () =>
    JSON.parse((await cdp("Runtime.evaluate", { expression: ESTADO, returnByValue: true }, sessionId)).result.value);

  const a = await leer();
  if (a.error) {
    console.log("  " + a.error);
    ws.close();
    child.kill();
    return;
  }

  console.log(`\n=== hero · ${ANCHO} px ===`);
  console.log(`  fuente elegida: ${a.fuente}`);
  console.log(`  fuentes declaradas:`);
  for (const f of a.fuentes) console.log(`    ${f.media.padEnd(22)} ${f.src}`);
  console.log(`  tamaño en pantalla: ${a.tamano.w}×${a.tamano.h}  (hero ${a.hero.w}×${a.hero.h})`);
  console.log(`  object-fit: ${a.objectFit} · object-position: ${a.objectPosition}`);
  console.log(`  poster: ${a.poster}`);
  console.log(`  pausado: ${a.pausado} · bucle: ${a.bucle} · silenciado: ${a.silenciado} (vol ${a.volumen})`);
  console.log(`  controles: ${a.controles} · autoplay: ${a.autoplay} · playsinline: ${a.playsinline}`);
  console.log(`  tabindex: ${a.tabindex} · aria-hidden: ${a.ariaHidden}`);
  console.log(`  error: ${a.error ?? "ninguno"}`);

  // ¿Avanza de verdad?
  const t1 = a.tiempo;
  await sleep(2500);
  const b = await leer();
  const t2 = b.tiempo;
  console.log(`\n  reproducción: ${t1}s → ${t2}s en 2,5 s reales  → ${t2 > t1 ? "AVANZA ✓" : "NO AVANZA ✗"}`);
  console.log(`  duración del bucle: ${b.duracion}s`);

  // Captura del hero
  try {
    const shot = await cdp("Page.captureScreenshot", { format: "png" }, sessionId);
    await writeFile(resolve(OUT, "hero-video.png"), Buffer.from(shot.data, "base64"));
    console.log("  captura: .audit/hero-video.png");
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
