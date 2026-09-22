/**
 * measure-contact-block.mjs — mide el bloque de contacto.
 *
 * AISLAMIENTO: Chrome headless propio, perfil temporal exclusivo
 * (.audit-profile-contact) y puerto 9373. Solo cierra su propio proceso hijo.
 *
 * Comprueba lo que el usuario no quiere que pase: que el correo se parta en dos
 * líneas o se corte. Mide también si el texto desborda de su tarjeta.
 *
 * Uso: node scripts/measure-contact-block.mjs [puerto] [ancho] [ruta]
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const ANCHO = Number(process.argv[3] ?? 1440);
const RUTA = process.argv[4] ?? "/";
const DEBUG_PORT = 9373;
const PROFILE = resolve(process.cwd(), ".audit-profile-contact");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MEDIDA = `JSON.stringify((() => {
  const bloque = document.querySelector('.cblock');
  if (!bloque) return { error: 'no hay bloque de contacto' };
  const canales = Array.from(bloque.querySelectorAll('.cblock__channel'));
  return {
    bloque: Math.round(bloque.getBoundingClientRect().width),
    canales: canales.map((c) => {
      const txt = c.querySelector('.cblock__channel-text');
      const strong = c.querySelector('strong');
      const r = c.getBoundingClientRect();
      const rt = txt.getBoundingClientRect();
      const rs = strong.getBoundingClientRect();
      const cs = getComputedStyle(strong);

      // ¿El texto se parte en varias líneas? Se cuentan las cajas del rango
      const rango = document.createRange();
      rango.selectNodeContents(strong);
      const alturas = new Set(
        Array.from(rango.getClientRects()).filter((x) => x.height > 1).map((x) => Math.round(x.top)),
      );

      return {
        etiqueta: c.querySelector('.cblock__channel-label')?.textContent?.trim(),
        valor: strong.textContent.trim(),
        tarjeta: Math.round(r.width),
        textoAncho: Math.round(rt.width),
        strongAncho: Math.round(rs.width),
        lineas: alturas.size,
        // ¿se sale del contenedor de texto o de la tarjeta?
        desbordaTexto: Math.round(rs.width - rt.width) > 1,
        desbordaTarjeta: Math.round(rs.right - r.right) > 1,
        whiteSpace: cs.whiteSpace,
        overflowWrap: cs.overflowWrap,
        overflow: cs.overflow,
        fontSize: cs.fontSize,
      };
    }),
  };
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
    { width: ANCHO, height: 1000, deviceScaleFactor: 1, mobile: ANCHO < 700 },
    sessionId,
  );
  await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}${RUTA}` }, sessionId);
  await sleep(2800);

  await cdp(
    "Runtime.evaluate",
    { expression: `(() => { const c = document.querySelector('.cblock'); if (c) c.scrollIntoView({block:'center'}); return 'ok'; })()` },
    sessionId,
  );
  await sleep(1200);

  const d = JSON.parse((await cdp("Runtime.evaluate", { expression: MEDIDA, returnByValue: true }, sessionId)).result.value);
  if (d.error) {
    console.log("  " + d.error);
    ws.close();
    child.kill();
    return;
  }

  console.log(`\n=== bloque de contacto · ${ANCHO} px · ${RUTA} ===`);
  console.log(`  ancho del bloque: ${d.bloque} px\n`);

  for (const c of d.canales) {
    const aviso = [];
    if (c.lineas > 1) aviso.push(`SE PARTE EN ${c.lineas} LÍNEAS`);
    if (c.desbordaTexto) aviso.push("sale del contenedor de texto");
    if (c.desbordaTarjeta) aviso.push("sale de la tarjeta");

    console.log(`  ${String(c.etiqueta).padEnd(10)} "${String(c.valor).slice(0, 34)}"`);
    console.log(
      `    tarjeta ${c.tarjeta} · texto ${c.textoAncho} · valor ${c.strongAncho}` +
        ` · líneas ${c.lineas} · nowrap=${c.whiteSpace} · overflow-wrap=${c.overflowWrap}`,
    );
    console.log(`    ${aviso.length ? "✗ " + aviso.join(" · ") : "✓ cabe en una línea"}`);
  }

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
