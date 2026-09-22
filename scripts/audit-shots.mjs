/**
 * audit-shots.mjs — capturas de auditoría visual.
 *
 * ---------------------------------------------------------------------------
 * AISLAMIENTO DEL NAVEGADOR (leer antes de tocar este archivo)
 *
 * El script abre SU PROPIA instancia de Chrome en modo headless con un
 * --user-data-dir temporal exclusivo y un puerto de depuración propio. La única
 * acción sobre procesos es `chrome.kill()` sobre el hijo que él mismo lanza.
 *
 * NUNCA busca, reutiliza ni cierra instancias de Chrome ya abiertas. Por eso es
 * seguro ejecutarlo mientras el usuario tiene su navegador abierto trabajando.
 *
 * No añadir aquí (ni en ningún script de este directorio) nada del estilo
 * `Get-Process chrome | Stop-Process` ni `taskkill /IM chrome.exe`: mataría las
 * pestañas del usuario.
 * ---------------------------------------------------------------------------
 *
 * Levanta Chrome headless con el protocolo DevTools y captura:
 *   - escritorio (1440×900) por página
 *   - móvil (390×844) por página
 *   - recortes de secciones concretas (hero, precios, opiniones)
 *
 * Uso: node scripts/audit-shots.mjs [puerto]
 */
import { spawn } from "node:child_process";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const PORT = process.argv[2] ?? "4410";
const BASE = `http://localhost:${PORT}`;
const OUT = resolve(process.cwd(), ".audit");
const PROFILE = resolve(process.cwd(), ".audit-profile");

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chromePath) {
  console.error("No se encontró Chrome ni Edge");
  process.exit(1);
}

const DEBUG_PORT = 9333;

const PAGES = [
  { name: "home", url: "/", full: true },
  { name: "home-movil", url: "/", full: true, mobile: true },
  { name: "apartamento", url: "/apartamenty/liberta-i/", full: false },
  { name: "apartamentos-listado", url: "/apartamenty/", full: false },
  { name: "cennik", url: "/cennik/", full: false },
  { name: "atrakcje", url: "/atrakcje/", full: false },
  { name: "lokalizacja", url: "/lokalizacja/", full: false },
  { name: "rezerwacja", url: "/rezerwacja/", full: false },
  { name: "opinie", url: "/opinie/", full: false },
  { name: "faq", url: "/faq/", full: false },
  { name: "home-de", url: "/de/", full: false },
  { name: "404", url: "/no-existe-slug/", full: false },
];

/** Recortes por selector para revisar detalles de cerca. */
const CLIPS = [
  { name: "clip-hero", url: "/", selector: "[data-hero]" },
  { name: "clip-trust", url: "/", selector: ".trust" },
  { name: "clip-reasons", url: "/", selector: ".reasons" },
  { name: "clip-amen", url: "/", selector: ".amen" },
  { name: "clip-precios", url: "/", selector: ".price-preview" },
  { name: "clip-opiniones", url: "/", selector: ".rev__summary" },
  { name: "clip-faq", url: "/", selector: ".accordion" },
  { name: "clip-footer", url: "/", selector: ".ftr" },
  { name: "clip-nav", url: "/", selector: ".hdr__bar" },
  { name: "clip-ctaband", url: "/", selector: ".cta-band" },
  { name: "clip-ficha-hero", url: "/apartamenty/liberta-i/", selector: ".ahero" },
  { name: "clip-tabla", url: "/cennik/", selector: ".rates" },
  { name: "clip-comparativa", url: "/apartamenty/", selector: ".cmp" },
  { name: "clip-form", url: "/rezerwacja/", selector: ".bookform" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp(ws, method, params = {}, sessionId) {
  const id = Math.floor(Math.random() * 1e9);
  return new Promise((resolvePromise, reject) => {
    const onMessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== id) return;
      ws.removeEventListener("message", onMessage);
      if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
      else resolvePromise(msg.result);
    };
    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

async function main() {
  await rm(PROFILE, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  // Espera al endpoint de DevTools
  let version;
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    try {
      version = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json();
      break;
    } catch {
      /* reintentar */
    }
  }
  if (!version) throw new Error("Chrome no expuso el puerto de depuración");

  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener("open", r);
    ws.addEventListener("error", j);
  });

  const { targetId } = await cdp(ws, "Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp(ws, "Target.attachToTarget", { targetId, flatten: true });

  await cdp(ws, "Page.enable", {}, sessionId);
  await cdp(ws, "Runtime.enable", {}, sessionId);

  const setViewport = async (width, height, mobile) => {
    await cdp(
      ws,
      "Emulation.setDeviceMetricsOverride",
      {
        width,
        height,
        deviceScaleFactor: 1,
        mobile,
        screenWidth: width,
        screenHeight: height,
      },
      sessionId,
    );
  };

  /**
   * Navega y fuerza el pintado de TODA la página.
   *
   * Importante: hay que recorrer la página a pasos y dar tiempo entre ellos.
   * Un solo salto al fondo y volver arriba deja sin pintar los bloques
   * intermedios cuando se captura con captureBeyondViewport, y las capturas
   * salen con huecos vacíos que parecen errores de diseño y no lo son.
   */
  const goto = async (url) => {
    await cdp(ws, "Page.navigate", { url: `${BASE}${url}` }, sessionId);
    await sleep(1500);

    const { result } = await cdp(
      ws,
      "Runtime.evaluate",
      { expression: "document.documentElement.scrollHeight", returnByValue: true },
      sessionId,
    );
    const total = Number(result.value) || 0;
    const step = 700;

    for (let y = 0; y < total; y += step) {
      await cdp(ws, "Runtime.evaluate", { expression: `window.scrollTo(0, ${y}); 'ok'` }, sessionId);
      await sleep(160);
    }

    await cdp(
      ws,
      "Runtime.evaluate",
      { expression: "window.scrollTo(0, document.body.scrollHeight); 'ok'" },
      sessionId,
    );
    await sleep(800);
    await cdp(ws, "Runtime.evaluate", { expression: "window.scrollTo(0, 0); 'ok'" }, sessionId);
    await sleep(600);
  };

  const capture = async (file, clip) => {
    const params = { format: "png", captureBeyondViewport: true };
    if (clip) params.clip = { ...clip, scale: 1 };
    else params.captureBeyondViewport = true;
    const { data } = await cdp(ws, "Page.captureScreenshot", params, sessionId);
    await writeFile(join(OUT, file), Buffer.from(data, "base64"));
  };

  let count = 0;

  for (const page of PAGES) {
    const width = page.mobile ? 390 : 1440;
    const height = page.mobile ? 844 : 900;
    await setViewport(width, height, Boolean(page.mobile));
    await goto(page.url);

    if (page.full) {
      const { result } = await cdp(
        ws,
        "Runtime.evaluate",
        {
          expression:
            "JSON.stringify({w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight})",
          returnByValue: true,
        },
        sessionId,
      );
      const dims = JSON.parse(result.value);
      await capture(`${page.name}.png`, {
        x: 0,
        y: 0,
        width: Math.min(dims.w, width),
        height: Math.min(dims.h, 20000),
      });
    } else {
      await capture(`${page.name}.png`);
    }
    count++;
    console.log(`  ✓ ${page.name}`);
  }

  for (const clip of CLIPS) {
    await setViewport(1440, 900, false);
    await goto(clip.url);
    const { result } = await cdp(
      ws,
      "Runtime.evaluate",
      {
        expression: `(() => {
          const el = document.querySelector(${JSON.stringify(clip.selector)});
          if (!el) return "null";
          const r = el.getBoundingClientRect();
          const scrollY = window.scrollY;
          return JSON.stringify({ x: r.left, y: r.top + scrollY, width: r.width, height: r.height });
        })()`,
        returnByValue: true,
      },
      sessionId,
    );
    if (result.value === "null") {
      console.log(`  ✗ ${clip.name} (selector no encontrado)`);
      continue;
    }
    const rect = JSON.parse(result.value);
    if (rect.width < 2 || rect.height < 2) {
      console.log(`  ✗ ${clip.name} (caja vacía)`);
      continue;
    }
    await capture(`${clip.name}.png`, rect);
    count++;
    console.log(`  ✓ ${clip.name}`);
  }

  ws.close();
  chrome.kill();
  await rm(PROFILE, { recursive: true, force: true });
  console.log(`\n${count} capturas en ${OUT}`);
}

main().catch(async (error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
