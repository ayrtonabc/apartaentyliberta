/**
 * diagnose-card-width.mjs — mide la cadena de contenedores de las tarjetas.
 *
 * AISLAMIENTO: Chrome headless propio, perfil temporal exclusivo
 * (.audit-profile-width) y puerto 9355. Solo cierra su propio proceso hijo.
 * No añadir `Get-Process chrome | Stop-Process` ni `taskkill`.
 *
 * Uso: node scripts/diagnose-card-width.mjs [puerto] [ruta]
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const RUTA = process.argv[3] ?? "/apartamenty/";
const DEBUG_PORT = 9355;
const PROFILE = resolve(process.cwd(), ".audit-profile-width");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Sube desde la tarjeta hasta el body anotando el ancho de cada nivel. */
const CADENA = `JSON.stringify((() => {
  const card = document.querySelector('.acard');
  const link = document.querySelector('.acard__link');
  const out = {
    ventana: window.innerWidth,
    tarjeta: card ? Math.round(card.getBoundingClientRect().width) : null,
    enlace: link ? Math.round(link.getBoundingClientRect().width) : null,
    enlaceDisplay: link ? getComputedStyle(link).display : null,
    enlaceWidthCss: link ? getComputedStyle(link).width : null,
  };
  const cadena = [];
  let el = card?.parentElement;
  while (el && el.tagName !== 'BODY') {
    const cs = getComputedStyle(el);
    cadena.push({
      tag: el.tagName.toLowerCase(),
      clase: (el.className || '').toString().slice(0, 60),
      ancho: Math.round(el.getBoundingClientRect().width),
      display: cs.display,
      width: cs.width,
      maxWidth: cs.maxWidth,
      gridCols: cs.gridTemplateColumns,
      flexDirection: cs.flexDirection,
    });
    el = el.parentElement;
  }
  out.cadena = cadena;
  return out;
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
  await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}${RUTA}` }, sessionId);
  await sleep(2400);

  const out = await cdp("Runtime.evaluate", { expression: CADENA, returnByValue: true }, sessionId);
  const d = JSON.parse(out.result.value);

  console.log(`\n=== ${RUTA} · ventana ${d.ventana} px ===`);
  console.log(`  tarjeta: ${d.tarjeta} px`);
  console.log(`  enlace : ${d.enlace} px  display=${d.enlaceDisplay}  width=${d.enlaceWidthCss}`);
  console.log("\n  cadena de contenedores (de dentro hacia fuera):");
  for (const c of d.cadena) {
    console.log(
      `    ${c.tag.padEnd(7)} ${String(c.ancho).padStart(5)}px  display=${c.display.padEnd(12)}` +
        ` width=${String(c.width).padEnd(9)} max=${String(c.maxWidth).padEnd(9)}` +
        (c.gridCols && c.gridCols !== "none" ? ` cols=${c.gridCols}` : "") +
        `  .${c.clase}`,
    );
  }

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
