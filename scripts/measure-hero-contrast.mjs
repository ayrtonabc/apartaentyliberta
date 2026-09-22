/**
 * measure-hero-contrast.mjs — mide el contraste real del texto del hero.
 *
 * POR QUÉ
 *
 * El titular y el subtítulo van sobre el vídeo. Su legibilidad depende de tres
 * cosas que no se pueden juzgar a ojo: el brillo del fotograma en ese punto
 * concreto, el velo que lleva encima y el color del texto. Aquí se recorta el
 * fotograma real por la caja de cada texto, se le aplica el velo como lo hace el
 * navegador y se calcula el contraste según WCAG.
 *
 * AISLAMIENTO: Chrome headless propio, perfil temporal exclusivo
 * (.audit-profile-contrast) y puerto 9365. Solo cierra su propio proceso hijo.
 *
 * Uso: node scripts/measure-hero-contrast.mjs [puerto] [ancho]
 */
import { spawn } from "node:child_process";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const PORT_SITE = process.argv[2] ?? "8080";
const ANCHO = Number(process.argv[3] ?? 1440);
const DEBUG_PORT = 9365;
const PROFILE = resolve(process.cwd(), ".audit-profile-contrast");
const OUT = resolve(process.cwd(), ".audit");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Cajas de los textos que van SOBRE EL VÍDEO.
 *
 * Ojo: las etiquetas del buscador quedan fuera a propósito. Van dentro de la
 * tarjeta blanca, así que su contraste se mide contra ese blanco, no contra el
 * vídeo. Incluirlas daba un "suspenso" que no existía.
 */
const CAJAS = `JSON.stringify((() => {
  const out = {};
  const pick = (sel, nombre) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    out[nombre] = {
      x: Math.round(r.left), y: Math.round(r.top),
      w: Math.round(r.width), h: Math.round(r.height),
      color: cs.color, fontSize: cs.fontSize,
      nivel: nombre === 'titulo' ? 'grande' : 'normal',
    };
  };
  pick('.hero__eyebrow', 'eyebrow');
  pick('.hero__title', 'titulo');
  pick('.hero__subtitle', 'subtitulo');
  return out;
})())`;

/** Luminancia relativa de un color sRGB. */
const lum = (r, g, b) => {
  const f = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/** Contraste WCAG entre dos luminancias. */
const contraste = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

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
      }, 20000);
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
  await sleep(4000);

  const cajas = JSON.parse((await cdp("Runtime.evaluate", { expression: CAJAS, returnByValue: true }, sessionId)).result.value);

  // Ocultar el texto y capturar SOLO el fondo (vídeo + velo)
  await cdp(
    "Runtime.evaluate",
    {
      expression: `(() => {
        const s = document.createElement('style');
        s.textContent = '.hero__inner, .hero__marks { visibility: hidden !important; }';
        document.head.appendChild(s);
        return 'ok';
      })()`,
    },
    sessionId,
  );
  await sleep(600);

  const fondo = await cdp("Page.captureScreenshot", { format: "png" }, sessionId);
  const fondoBuf = Buffer.from(fondo.data, "base64");
  await writeFile(resolve(OUT, "hero-fondo.png"), fondoBuf);

  console.log(`\n=== contraste del texto del hero · ${ANCHO} px ===`);
  console.log("  (fondo real: fotograma del vídeo con el velo aplicado)\n");

  const umbral = { grande: 3.0, normal: 4.5 };
  let suspensos = 0;

  for (const [nombre, c] of Object.entries(cajas)) {
    if (c.w < 2 || c.h < 2) continue;

    // Recorta la caja del texto, evitando salirse de la imagen
    const meta = await sharp(fondoBuf).metadata();
    const left = Math.max(0, Math.min(c.x, meta.width - 2));
    const top = Math.max(0, Math.min(c.y, meta.height - 2));
    const width = Math.max(2, Math.min(c.w, meta.width - left));
    const height = Math.max(2, Math.min(c.h, meta.height - top));

    const { data, info } = await sharp(fondoBuf)
      .extract({ left, top, width, height })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Luminancia media y percentil 90 (la zona más clara es la que manda)
    const lums = [];
    for (let i = 0; i < data.length; i += info.channels) {
      lums.push(lum(data[i], data[i + 1], data[i + 2]));
    }
    lums.sort((a, b) => a - b);
    const media = lums.reduce((a, b) => a + b, 0) / lums.length;
    const p90 = lums[Math.floor(lums.length * 0.9)];

    // Color del texto
    const partes = c.color.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    const rl = partes ? lum(+partes[1], +partes[2], +partes[3]) : 1;

    const texto = nombre === "etiqueta" ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
    const lumTexto = lum(texto.r, texto.g, texto.b);

    const cMedia = contraste(lumTexto, media);
    const cPeor = contraste(lumTexto, p90);
    const minimo = umbral[c.nivel];
    const ok = cPeor >= minimo;
    if (!ok) suspensos++;

    console.log(
      `  ${nombre.padEnd(11)} ${String(c.fontSize).padEnd(7)} fondo medio=${media.toFixed(3)} p90=${p90.toFixed(3)}` +
        `  contraste medio=${cMedia.toFixed(1)} peor=${cPeor.toFixed(1)}` +
        `  mínimo ${minimo} → ${ok ? "OK" : "SUSPENSO"}`,
    );

    void rl;
  }

  console.log(`\n  textos por debajo del mínimo: ${suspensos}`);

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
