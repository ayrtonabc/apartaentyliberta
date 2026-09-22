/**
 * verify-lang-switcher.mjs — comprueba que el desplegable de idioma es usable.
 *
 * ---------------------------------------------------------------------------
 * AISLAMIENTO DEL NAVEGADOR — LEER ANTES DE TOCAR
 *
 * Abre su PROPIA instancia de Chrome headless con perfil temporal exclusivo
 * (.audit-profile-lang) y puerto de depuración propio (9342). La única acción
 * sobre procesos es `child.kill()` sobre el hijo que este script lanza.
 *
 * NUNCA busca, reutiliza ni cierra instancias de Chrome ya abiertas. Es seguro
 * con el navegador del usuario abierto y trabajando.
 *
 * No añadir `Get-Process chrome | Stop-Process` ni `taskkill /IM chrome.exe`:
 * cerraría las pestañas del usuario.
 * ---------------------------------------------------------------------------
 *
 * Comprueba lo que fallaba: que el menú de idioma, al abrirse, quede DENTRO de
 * la ventana, por encima de todo, y que su opción sea realmente clicable (que
 * el elemento que hay en esas coordenadas sea el propio enlace).
 *
 * Uso: node scripts/verify-lang-switcher.mjs [puerto]
 */
import { spawn } from "node:child_process";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const DEBUG_PORT = 9342;
const PROFILE = resolve(process.cwd(), ".audit-profile-lang");
const OUT = resolve(process.cwd(), ".audit");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

if (!chromePath) {
  console.error("No se encontró Chrome ni Edge.");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Abre el desplegable y comprueba:
 *   - que el menú está dentro del viewport
 *   - que el elemento bajo las coordenadas del enlace ES el enlace
 *     (si lo tapa un contenedor con overflow o un z-index menor, no lo es)
 */
const CHECK = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const toggle = document.querySelector('[data-lang-toggle]');
  const menu = document.querySelector('[data-lang-menu]');
  if (!toggle || !menu) return JSON.stringify({ error: 'no se encontró el selector' });

  toggle.click();
  await sleep(500);

  const abierto = !menu.hidden;
  const mr = menu.getBoundingClientRect();
  const items = Array.from(menu.querySelectorAll('[data-lang-item]'));
  const detalle = items.map((a) => {
    const b = a.getBoundingClientRect();
    const cx = Math.round(b.left + b.width / 2);
    const cy = Math.round(b.top + b.height / 2);
    const encima = document.elementFromPoint(cx, cy);
    return {
      idioma: a.getAttribute('hreflang'),
      caja: { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) },
      centradoEnPantalla: cy > 0 && cy < window.innerHeight && cx > 0 && cx < window.innerWidth,
      recibeClic: encima === a || a.contains(encima),
      quienTapa: encima === a || a.contains(encima) ? null : (encima ? encima.className || encima.tagName : 'nada'),
    };
  });

  // ¿algún antepasado recorta el menú?
  const recortadores = [];
  let el = menu.parentElement;
  while (el && el !== document.documentElement) {
    const cs = getComputedStyle(el);
    if (cs.overflow !== 'visible' && cs.overflow !== '') {
      recortadores.push({ clase: el.className || el.tagName, overflow: cs.overflow });
    }
    el = el.parentElement;
  }

  /*
   * El skip-link ya no puede ocultarse con el overflow de la cabecera (eso era
   * lo que recortaba el menú), así que se comprueba que siga invisible en
   * reposo y visible al recibir el foco.
   */
  const skip = document.querySelector('.skip-link');
  let skipEstado = null;
  if (skip) {
    const reposo = skip.getBoundingClientRect();
    const csReposo = getComputedStyle(skip);
    skip.focus();
    await sleep(250);
    const enfocado = skip.getBoundingClientRect();
    const csEnfocado = getComputedStyle(skip);
    skipEstado = {
      enReposo: {
        an: Math.round(reposo.width),
        al: Math.round(reposo.height),
        clip: csReposo.clipPath,
        oculto: reposo.width <= 2 && reposo.height <= 2,
      },
      conFoco: {
        an: Math.round(enfocado.width),
        al: Math.round(enfocado.height),
        clip: csEnfocado.clipPath,
        dentroDeVentana:
          enfocado.top >= 0 && enfocado.left >= 0 &&
          enfocado.bottom <= window.innerHeight && enfocado.right <= window.innerWidth,
      },
    };
    skip.blur();
  }

  return JSON.stringify({
    abierto,
    menuCaja: { x: Math.round(mr.left), y: Math.round(mr.top), w: Math.round(mr.width), h: Math.round(mr.height) },
    menuDentroDeVentana:
      mr.top >= 0 && mr.left >= 0 && mr.bottom <= window.innerHeight && mr.right <= window.innerWidth,
    recortadores,
    skipLink: skipEstado,
    items: detalle,
  }, null, 1);
})()`;

async function main() {
  await mkdir(OUT, { recursive: true });

  try {
    await rm(PROFILE, { recursive: true, force: true });
  } catch {
    console.warn("[aviso] perfil temporal en uso; se reutiliza");
  }

  const child = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE}`,
      "--no-first-run",
      "--no-default-browser-check",
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
    console.error("Chrome no expuso el puerto de depuración. Vuelve a intentarlo.");
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
          rej(new Error(`${method}: sin respuesta en 15 s`));
        }
      }, 15000);
    });

  const { targetId } = await cdp("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
  await cdp("Page.enable", {}, sessionId);
  await cdp("Runtime.enable", {}, sessionId);

  const results = [];
  const viewports = [
    { label: "escritorio", w: 1440, h: 900, mobile: false, path: "/" },
    { label: "portatil", w: 1280, h: 800, mobile: false, path: "/" },
    { label: "pagina-interna", w: 1440, h: 900, mobile: false, path: "/cennik/" },
  ];

  for (const vp of viewports) {
    await cdp(
      "Emulation.setDeviceMetricsOverride",
      { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.mobile },
      sessionId,
    );
    await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}${vp.path}` }, sessionId);
    await sleep(2200);

    const out = await cdp(
      "Runtime.evaluate",
      { expression: CHECK, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    results.push({ vp, data: JSON.parse(out.result.value) });
  }

  for (const { vp, data } of results) {
    console.log(`\n=== ${vp.label} (${vp.w}×${vp.h}) ${vp.path} ===`);
    if (data.error) {
      console.log("  " + data.error);
      continue;
    }
    console.log(`  abierto: ${data.abierto}`);
    console.log(`  menú: ${JSON.stringify(data.menuCaja)}`);
    console.log(`  dentro de la ventana: ${data.menuDentroDeVentana}`);
    console.log(
      `  antepasados que recortan: ${
        data.recortadores.length === 0 ? "ninguno" : JSON.stringify(data.recortadores)
      }`,
    );
    for (const it of data.items) {
      console.log(
        `    ${String(it.idioma).padEnd(6)} en ${JSON.stringify(it.caja)}` +
          `  visible=${it.centradoEnPantalla}  recibe clic=${it.recibeClic}` +
          (it.quienTapa ? `  lo tapa: ${it.quienTapa}` : ""),
      );
    }
    if (data.skipLink) {
      const s = data.skipLink;
      console.log(
        `  skip-link: en reposo ${s.enReposo.an}×${s.enReposo.al} (oculto=${s.enReposo.oculto})` +
          ` → con foco ${s.conFoco.an}×${s.conFoco.al} (dentro de la ventana=${s.conFoco.dentroDeVentana})`,
      );
    }
  }

  // Captura del desplegable abierto (al final: si falla, los datos ya están)
  try {
    await cdp(
      "Emulation.setDeviceMetricsOverride",
      { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
      sessionId,
    );
    await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}/` }, sessionId);
    await sleep(2200);
    await cdp(
      "Runtime.evaluate",
      { expression: "document.querySelector('[data-lang-toggle]').click(); 'ok'", sessionId },
    );
    await sleep(700);
    const { data } = await cdp(
      "Page.captureScreenshot",
      { format: "png", clip: { x: 900, y: 0, width: 540, height: 340, scale: 2 } },
      sessionId,
    );
    await writeFile(resolve(OUT, "lang-open.png"), Buffer.from(data, "base64"));
    console.log("\nCaptura del desplegable: .audit/lang-open.png");
  } catch {
    console.warn("\nCaptura no disponible en este entorno (los datos ya están medidos)");
  }

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
