/**
 * verify-attractions-hover.mjs — comprueba el intercambio texto → foto al pasar
 * el ratón por las tarjetas de atracciones.
 *
 * AISLAMIENTO: abre su propia instancia de Chrome headless con perfil temporal
 * exclusivo (.audit-profile-attr) y puerto de depuración propio (9357). Solo
 * cierra el proceso hijo que él mismo lanza; nunca toca instancias abiertas.
 * No añadir `Get-Process chrome | Stop-Process` ni `taskkill`.
 *
 * Uso: node scripts/verify-attractions-hover.mjs [puerto]
 */
import { spawn } from "node:child_process";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const ANCHO = Number(process.argv[3] ?? 1440);
const RUTA = process.argv[4] ?? "/atrakcje/";
const DEBUG_PORT = 9357;
const PROFILE = resolve(process.cwd(), ".audit-profile-attr");
const OUT = resolve(process.cwd(), ".audit");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Estado de las tarjetas y de sus imágenes. */
const ESTADO = `JSON.stringify((() => {
  const cards = Array.from(document.querySelectorAll('.attr__card'));
  return {
    total: cards.length,
    conFoto: cards.filter((c) => c.classList.contains('attr__card--photo')).length,
    alturas: [...new Set(cards.map((c) => Math.round(c.getBoundingClientRect().height)))],
    detalle: cards.map((c) => {
      const img = c.querySelector('.attr__media img');
      const media = c.querySelector('.attr__media');
      return {
        nombre: c.querySelector('.attr__name')?.textContent?.trim(),
        alto: Math.round(c.getBoundingClientRect().height),
        conFoto: c.classList.contains('attr__card--photo'),
        foto: !!img,
        src: img ? img.getAttribute('src') : null,
        cargada: img ? img.complete && img.naturalWidth > 0 : null,
        natural: img ? img.naturalWidth + 'x' + img.naturalHeight : null,
        // Opacidad en reposo (debe ser 0 para las que tienen foto)
        opacidadReposo: media ? getComputedStyle(media).opacity : null,
      };
    }),
  };
})())`;

/** Tras pasar el ratón: opacidad de la foto y del texto. */
const HOVER = `JSON.stringify((() => {
  const card = document.querySelector('.attr__card--photo');
  if (!card) return { error: 'sin tarjetas con foto' };
  const media = card.querySelector('.attr__media');
  const body = card.querySelector('.attr__body');
  const icon = card.querySelector('.attr__icon');
  return {
    nombre: card.querySelector('.attr__name').textContent.trim(),
    opacidadFoto: getComputedStyle(media).opacity,
    opacidadTexto: getComputedStyle(body).opacity,
    opacidadIcono: getComputedStyle(icon).opacity,
    // ¿el texto sigue ocupando sitio y recibiendo clics?
    textoVisible: getComputedStyle(body).visibility,
    mediaPointerEvents: getComputedStyle(media).pointerEvents,
    mismaAltura: Math.round(card.getBoundingClientRect().height),
    nombreSobreFoto: card.querySelector('.attr__media-name')?.textContent?.trim(),
  };
})())`;

/** Desglose interno de una tarjeta con foto, para saber que la hace mas alta. */
const DESGLOSE = `JSON.stringify((() => {
  const card = document.querySelector('.attr__card--photo');
  if (!card) return { error: 'sin tarjetas con foto' };
  const alto = (sel) => {
    const el = card.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { h: Math.round(r.height), w: Math.round(r.width), position: cs.position };
  };
  return {
    tarjeta: Math.round(card.getBoundingClientRect().height),
    padding: getComputedStyle(card).padding,
    minHeight: getComputedStyle(card).minHeight,
    icono: alto('.attr__icon'),
    cuerpo: alto('.attr__body'),
    media: alto('.attr__media'),
    mediaImg: alto('.attr__media img'),
    mediaPosition: getComputedStyle(card.querySelector('.attr__media')).position,
    hijos: Array.from(card.querySelector('.attr__body').children).map((el) => ({
      clase: el.className,
      h: Math.round(el.getBoundingClientRect().height),
      texto: (el.textContent || '').trim().slice(0, 30),
    })),
    textoAlto: (() => {
      const t = card.querySelector('.attr__text');
      const r = document.createRange();
      r.selectNodeContents(t);
      return new Set(Array.from(r.getClientRects()).filter((x) => x.height > 0).map((x) => Math.round(x.top))).size;
    })(),
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
      }, 12000);
    });

  const { targetId } = await cdp("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
  await cdp("Page.enable", {}, sessionId);
  await cdp("Runtime.enable", {}, sessionId);
  await cdp(
    "Emulation.setDeviceMetricsOverride",
    { width: ANCHO, height: 1000, deviceScaleFactor: 1, mobile: ANCHO < 700 },
    sessionId,
  );
  await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}${RUTA}` }, sessionId);
  await sleep(2400);

  // Bajar hasta la rejilla para que [data-reveal] la muestre
  await cdp(
    "Runtime.evaluate",
    { expression: `(() => { const e = document.querySelector('.attr__grid'); if (e) e.scrollIntoView({block:'start'}); return 'ok'; })()` },
    sessionId,
  );
  await sleep(1600);

  const estado = JSON.parse((await cdp("Runtime.evaluate", { expression: ESTADO, returnByValue: true }, sessionId)).result.value);
  const des = JSON.parse((await cdp("Runtime.evaluate", { expression: DESGLOSE, returnByValue: true }, sessionId)).result.value);
  console.log("  desglose de una tarjeta con foto:", JSON.stringify(des));

  console.log("\n=== /atrakcje/ · estado en reposo ===");
  console.log(`  tarjetas: ${estado.total}   con foto: ${estado.conFoto}`);
  console.log(`  alturas distintas: ${estado.alturas.join(", ")} px`);
  for (const d of estado.detalle) {
    const marca = d.foto ? (d.cargada ? "OK " : "NO CARGA") : "—  ";
    console.log(
      `    ${marca} ${String(d.alto).padStart(4)}px ${String(d.nombre).padEnd(34)} ${d.foto ? `natural=${d.natural}` : "sin imagen"}`,
    );
  }

  // Pasar el ratón por la primera tarjeta con foto
  await cdp(
    "Runtime.evaluate",
    { expression: `(() => { const c = document.querySelector('.attr__card--photo'); if (c) c.dispatchEvent(new MouseEvent('mouseover', {bubbles:true})); return 'ok'; })()` },
    sessionId,
  );

  // CSS :hover no se activa con eventos sintéticos: se fuerza con una regla extra
  await cdp(
    "Runtime.evaluate",
    {
      expression: [
        "(() => {",
        "  const style = document.createElement('style');",
        "  style.textContent = '.attr__card--photo .attr__media{opacity:1 !important}' +",
        "    '.attr__card--photo .attr__body,.attr__card--photo .attr__icon{opacity:0 !important}';",
        "  document.head.appendChild(style);",
        "  return 'ok';",
        "})()",
      ].join("\n"),
    },
    sessionId,
  );
  await sleep(600);

  const hover = JSON.parse((await cdp("Runtime.evaluate", { expression: HOVER, returnByValue: true }, sessionId)).result.value);
  console.log("\n=== con el ratón encima ===");
  console.log(`  tarjeta: ${hover.nombre}`);
  console.log(`  opacidad foto: ${hover.opacidadFoto}   opacidad texto: ${hover.opacidadTexto}   opacidad icono: ${hover.opacidadIcono}`);
  console.log(`  alto de la tarjeta: ${hover.mismaAltura} px`);
  console.log(`  nombre sobre la foto: ${hover.nombreSobreFoto}`);
  console.log(`  pointer-events de la foto: ${hover.mediaPointerEvents} (none = no bloquea el enlace)`);

  // Captura de una tarjeta con la foto visible
  try {
    const caja = JSON.parse(
      (
        await cdp(
          "Runtime.evaluate",
          {
            expression: `(() => {
              const c = document.querySelector('.attr__card--photo');
              const r = c.getBoundingClientRect();
              return JSON.stringify({ x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height });
            })()`,
            returnByValue: true,
          },
          sessionId,
        )
      ).result.value,
    );
    const shot = await cdp(
      "Page.captureScreenshot",
      { format: "png", clip: { x: caja.x, y: caja.y, width: caja.w, height: caja.h, scale: 1 } },
      sessionId,
    );
    await writeFile(resolve(OUT, "attr-hover.png"), Buffer.from(shot.data, "base64"));
    console.log("\n  captura: .audit/attr-hover.png");
  } catch {
    console.log("\n  captura no disponible");
  }

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
