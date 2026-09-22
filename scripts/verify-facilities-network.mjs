/**
 * verify-facilities-network.mjs — comprueba por RED que las fotos de las
 * instalaciones se descargan de verdad.
 *
 * POR QUÉ POR RED Y NO POR GEOMETRÍA
 *
 * Las fotos llevan loading="lazy": medir `naturalWidth` en un instante dado
 * depende de dónde esté el scroll, y en una rejilla de 1.9 km de alto eso da
 * falsos negativos (salían como "no cargadas" fotos que aún no se habían pedido).
 * Escuchando las respuestas HTTP se sabe con certeza cuáles se descargaron y con
 * qué código, sin depender del scroll.
 *
 * AISLAMIENTO: Chrome headless propio, perfil temporal exclusivo
 * (.audit-profile-net) y puerto 9361. Solo cierra su propio proceso hijo.
 *
 * Uso: node scripts/verify-facilities-network.mjs [puerto]
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const DEBUG_PORT = 9361;
const PROFILE = resolve(process.cwd(), ".audit-profile-net");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const respuestas = [];

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      return;
    }
    // Respuestas de red de la pestaña del sitio
    if (msg.method === "Network.responseReceived") {
      const r = msg.params.response;
      if (r.url.includes("/facilities/")) {
        respuestas.push({ url: r.url, status: r.status, tipo: r.mimeType, bytes: r.encodedDataLength });
      }
    }
    if (msg.method === "Network.loadingFailed") {
      const req = msg.params;
      if ((req.requestId || "").length) {
        respuestas.push({ url: "(fallo) " + (req.errorText ?? "?"), status: 0, tipo: "", bytes: 0 });
      }
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
  await cdp("Network.enable", {}, sessionId);
  await cdp(
    "Emulation.setDeviceMetricsOverride",
    { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}/apartamenty/` }, sessionId);
  await sleep(3000);

  // Recorrer toda la página despacio para que el lazy loading pida todo
  await cdp(
    "Runtime.evaluate",
    {
      expression: `(async () => {
        const paso = window.innerHeight * 0.7;
        const total = document.documentElement.scrollHeight;
        for (let y = 0; y <= total; y += paso) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 420));
        }
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 800));
        return 'ok';
      })()`,
      awaitPromise: true,
    },
    sessionId,
  );
  await sleep(2500);

  // Resumen por nombre de archivo
  const porArchivo = new Map();
  for (const r of respuestas) {
    const nombre = r.url.split("/").pop().split("?")[0];
    if (!porArchivo.has(nombre)) porArchivo.set(nombre, []);
    porArchivo.get(nombre).push(r.status);
  }

  // Qué fotos declara la página
  const declaradas = JSON.parse(
    (
      await cdp(
        "Runtime.evaluate",
        {
          expression: `JSON.stringify(Array.from(document.querySelectorAll('.fac__media img')).map((i) => ({
            archivo: (i.currentSrc || i.src || '').split('/').pop().split('?')[0],
            alt: i.alt,
          })))`,
          returnByValue: true,
        },
        sessionId,
      )
    ).result.value,
  );

  console.log(`\n=== red · /apartamenty/ ===`);
  console.log(`  fotos declaradas en la página: ${declaradas.length}`);
  console.log(`  respuestas de /facilities/: ${respuestas.length}\n`);

  let fallos = 0;
  for (const d of declaradas) {
    const estados = porArchivo.get(d.archivo);
    if (!estados) {
      // Puede haberse servido otro ancho del srcset: se busca por prefijo
      const base = d.archivo.replace(/-\d+\.webp$/, "");
      const alternativas = [...porArchivo.entries()].filter(([n]) => n.startsWith(base));
      if (alternativas.length === 0) {
        console.log(`  ✗ ${d.archivo.padEnd(34)} NUNCA SE PIDIÓ`);
        fallos++;
      } else {
        const ok = alternativas.some(([, ss]) => ss.every((s) => s === 200));
        console.log(
          `  ${ok ? "✓" : "✗"} ${d.archivo.padEnd(34)} servido como ${alternativas.map(([n]) => n).join(", ")}`,
        );
        if (!ok) fallos++;
      }
      continue;
    }
    const ok = estados.every((s) => s === 200);
    console.log(`  ${ok ? "✓" : "✗"} ${d.archivo.padEnd(34)} HTTP ${estados.join(", ")}`);
    if (!ok) fallos++;
  }

  // Detalle de todo lo que no sea 200
  const malas = respuestas.filter((r) => r.status !== 200);
  if (malas.length) {
    console.log("\n  respuestas que NO son 200:");
    for (const m of malas) console.log(`    HTTP ${m.status}  ${m.url}`);
  }

  const codigos = [...new Set(respuestas.map((r) => r.status))].sort();
  console.log(`\n  códigos HTTP vistos: ${codigos.join(", ") || "ninguno"}`);
  console.log(`  fotos con problema: ${fallos}`);

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
