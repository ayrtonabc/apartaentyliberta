/**
 * measure-hero.mjs — mide el hero a distintas alturas de ventana.
 *
 * Comprueba el requisito real: que antetítulo, titular, subtítulo, buscador y
 * datos quepan dentro de la primera pantalla sin scroll, y a qué altura de
 * ventana deja de cumplirse.
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "4410";
const DEBUG = 9336;
const PROFILE = resolve(process.cwd(), ".audit-profile-hero");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Distintas ventanas: portátil bajo, portátil típico, escritorio y móvil. */
const VIEWPORTS = [
  { label: "portatil-bajo", w: 1440, h: 720, mobile: false },
  { label: "portatil", w: 1440, h: 800, mobile: false },
  { label: "escritorio", w: 1440, h: 900, mobile: false },
  { label: "grande", w: 1680, h: 1050, mobile: false },
  { label: "portatil-angosto", w: 1280, h: 800, mobile: false },
  { label: "movil", w: 390, h: 844, mobile: true },
  { label: "movil-bajo", w: 360, h: 640, mobile: true },
  { label: "movil-pequeno", w: 320, h: 568, mobile: true },
];

/** Idiomas: el alemán es el más largo y es el que rompe los diseños. */
const LOCALES = [
  { label: "PL", path: "/" },
  { label: "EN", path: "/en/" },
  { label: "DE", path: "/de/" },
];

const MEASURE = `JSON.stringify((() => {
  const q = (s) => document.querySelector(s);
  const r = (s) => { const el = q(s); return el ? el.getBoundingClientRect() : null; };
  /*
   * Contar líneas reales con getClientRects() de un Range, no dividiendo alto
   * entre line-height: esa división da números falsos cuando la caja lleva
   * margen o cuando \`text-wrap: balance\` deja la última línea más corta.
   */
  const countLines = (el) => {
    if (!el) return 0;
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = Array.from(range.getClientRects()).filter((x) => x.height > 0);
    const tops = new Set(rects.map((x) => Math.round(x.top)));
    return tops.size;
  };
  const hero = r('[data-hero]');
  const eyebrow = r('.hero__eyebrow');
  const title = r('.hero__title');
  const sub = r('.hero__subtitle');
  const quick = r('.hero__quick');
  const stats = r('.hero__marks');
  const titleEl = q('.hero__title');
  const cs = titleEl ? getComputedStyle(titleEl) : null;
  return {
    viewport: window.innerHeight,
    heroHeight: hero ? Math.round(hero.height) : 0,
    heroFits: hero ? hero.height <= window.innerHeight + 1 : false,
    titleFontSize: cs ? Math.round(parseFloat(cs.fontSize)) : 0,
    titleLines: countLines(titleEl),
    titlePxWidth: title ? Math.round(title.width) : 0,
    subLines: countLines(q('.hero__subtitle')),
    bottomOfStats: stats ? Math.round(stats.bottom) : 0,
    everythingVisible: stats ? stats.bottom <= window.innerHeight + 1 : false,
    blocks: {
      eyebrow: eyebrow ? Math.round(eyebrow.height) : 0,
      title: title ? Math.round(title.height) : 0,
      sub: sub ? Math.round(sub.height) : 0,
      quick: quick ? Math.round(quick.height) : 0,
      stats: stats ? Math.round(stats.height) : 0
    }
  };
})())`;

async function main() {
  await rm(PROFILE, { recursive: true, force: true });

  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${DEBUG}`,
      `--user-data-dir=${PROFILE}`,
      "--no-first-run",
      "--disable-extensions",
      "--hide-scrollbars",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let version;
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    try {
      version = await (await fetch(`http://127.0.0.1:${DEBUG}/json/version`)).json();
      break;
    } catch {
      /* reintentar */
    }
  }

  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener("open", r);
    ws.addEventListener("error", j);
  });

  let id = 0;
  const cdp = (method, params = {}, sessionId) =>
    new Promise((res, rej) => {
      const myId = ++id;
      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id !== myId) return;
        ws.removeEventListener("message", handler);
        msg.error ? rej(new Error(`${method}: ${msg.error.message}`)) : res(msg.result);
      };
      ws.addEventListener("message", handler);
      ws.send(JSON.stringify({ id: myId, method, params, sessionId }));
    });

  const { targetId } = await cdp("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
  await cdp("Page.enable", {}, sessionId);
  await cdp("Runtime.enable", {}, sessionId);

  for (const locale of LOCALES) {
    console.log(`\n=== ${locale.label} (${locale.path}) ===`);
    console.log(
      "ventana".padEnd(17) +
        "alto".padStart(6) +
        "hero".padStart(7) +
        "titulo".padStart(8) +
        "lineas".padStart(8) +
        "sub".padStart(5) +
        "quick".padStart(7) +
        "stats".padStart(7) +
        "  todo visible",
    );

    for (const vp of VIEWPORTS) {
      await cdp(
        "Emulation.setDeviceMetricsOverride",
        { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.mobile },
        sessionId,
      );
      await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}${locale.path}` }, sessionId);
      await sleep(2000);

      const { result } = await cdp(
        "Runtime.evaluate",
        { expression: MEASURE, returnByValue: true },
        sessionId,
      );
      const m = JSON.parse(result.value);
      console.log(
        vp.label.padEnd(17) +
          String(m.viewport).padStart(6) +
          String(m.heroHeight).padStart(7) +
          String(m.titleFontSize).padStart(8) +
          String(m.titleLines).padStart(8) +
          String(m.subLines).padStart(5) +
          String(m.blocks.quick).padStart(7) +
          String(m.blocks.stats).padStart(7) +
          "  " +
          (m.everythingVisible ? "SÍ" : "NO (desborda " + (m.bottomOfStats - m.viewport) + "px)"),
      );
    }
  }

  ws.close();
  chrome.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
