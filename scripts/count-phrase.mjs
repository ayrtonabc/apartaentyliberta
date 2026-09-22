/**
 * count-phrase.mjs — cuenta una frase en la home y dice EN QUÉ SECCIÓN aparece.
 *
 * Sirve para detectar repetición: ver 12 apariciones de una palabra no dice
 * nada; saber que 6 están en la misma sección sí.
 *
 * AISLAMIENTO: Chrome headless propio, perfil temporal exclusivo
 * (.audit-profile-count) y puerto 9363. Solo cierra su propio proceso hijo.
 *
 * Uso: node scripts/count-phrase.mjs [puerto] "frase" [ruta]
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const FRASE = process.argv[3] ?? "Balia góralska";
const RUTA = process.argv[4] ?? "/";
const DEBUG_PORT = 9363;
const PROFILE = resolve(process.cwd(), ".audit-profile-count");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Para cada aparición, la sección que la contiene. */
const PROBE = (frase) => `JSON.stringify((() => {
  const frase = ${JSON.stringify(frase)};
  const out = [];
  const walk = (el) => {
    for (const nodo of el.childNodes) {
      if (nodo.nodeType === 3) {
        if (nodo.textContent.includes(frase)) {
          // Busca el ancestro con clase de sección
          let sec = nodo.parentElement;
          let etiqueta = "(sin sección)";
          while (sec && sec !== document.body) {
            const cls = (sec.className || "").toString();
            if (/^(section|hero|trust|rev|fac|amen|apt|cta|cards)/.test(cls.split(" ")[0] || "") || sec.tagName === "SECTION") {
              etiqueta = sec.tagName.toLowerCase() + "." + (cls.split(" ")[0] || "");
              break;
            }
            sec = sec.parentElement;
          }
          out.push({ seccion: etiqueta, texto: nodo.textContent.trim().slice(0, 60) });
        }
      } else if (nodo.nodeType === 1) {
        walk(nodo);
      }
    }
  };
  walk(document.body);
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
  await sleep(3000);

  const apariciones = JSON.parse(
    (await cdp("Runtime.evaluate", { expression: PROBE(FRASE), returnByValue: true }, sessionId)).result.value,
  );

  console.log(`\n=== "${FRASE}" en ${RUTA} ===`);
  console.log(`  apariciones: ${apariciones.length}\n`);

  const porSeccion = new Map();
  for (const a of apariciones) {
    if (!porSeccion.has(a.seccion)) porSeccion.set(a.seccion, []);
    porSeccion.get(a.seccion).push(a.texto);
  }

  for (const [seccion, textos] of [...porSeccion.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(textos.length).padStart(2)} × ${seccion}`);
    for (const t of [...new Set(textos)]) console.log(`       "${t}"`);
  }

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
