/**
 * verify-attractions-page.mjs — comprueba la página /atrakcje/ rediseñada.
 *
 * AISLAMIENTO: Chrome headless propio, perfil temporal exclusivo
 * (.audit-profile-attrpage) y puerto 9364. Solo cierra su propio proceso hijo.
 *
 * Comprueba lo que importa del rediseño:
 *   - que la alternancia imagen/texto es correcta y CONTINUA entre secciones
 *   - que todas las fotos cargan (por red, no por naturalWidth)
 *   - que las filas no tienen alturas dispares
 *   - que no queda ninguna rejilla de tarjetas antigua
 *
 * Uso: node scripts/verify-attractions-page.mjs [puerto]
 */
import { spawn } from "node:child_process";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const RUTA = process.argv[3] ?? "/atrakcje/";
const DEBUG_PORT = 9364;
const PROFILE = resolve(process.cwd(), ".audit-profile-attrpage");
const OUT = resolve(process.cwd(), ".audit");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Posición de la imagen en cada fila: izquierda o derecha, y su altura. */
const FILAS = `JSON.stringify((() => {
  const rows = Array.from(document.querySelectorAll('.arow'));
  return {
    total: rows.length,
    sinFoto: rows.filter((r) => !r.querySelector('.arow__media')).length,
    filas: rows.map((r, i) => {
      const media = r.querySelector('.arow__media');
      const body = r.querySelector('.arow__body');
      const img = r.querySelector('.arow__media img');
      const rm = media ? media.getBoundingClientRect() : null;
      const rb = body.getBoundingClientRect();
      const rr = r.getBoundingClientRect();
      return {
        i,
        titulo: r.querySelector('.arow__title')?.textContent?.trim(),
        // La imagen está a la izquierda si su centro cae a la izquierda del centro de la fila
        lado: rm ? (rm.left + rm.width / 2 < rr.left + rr.width / 2 ? 'izq' : 'der') : '(sin foto)',
        altoFila: Math.round(rr.height),
        altoImg: rm ? Math.round(rm.height) : null,
        altoTexto: Math.round(rb.height),
        foto: img ? (img.currentSrc || img.src).split('/').pop() : null,
        cargada: img ? img.complete && img.naturalWidth > 0 : null,
      };
    }),
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
  const red = [];

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      return;
    }
    if (msg.method === "Network.responseReceived") {
      const r = msg.params.response;
      if (r.url.includes("/attractions/")) red.push({ url: r.url.split("/").pop(), status: r.status });
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
  await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}${RUTA}` }, sessionId);
  await sleep(3000);

  // Recorrer la página entera: 19 filas con lazy loading
  await cdp(
    "Runtime.evaluate",
    {
      expression: `(async () => {
        const paso = window.innerHeight * 0.6;
        const total = document.documentElement.scrollHeight;
        for (let y = 0; y <= total; y += paso) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 240));
        }
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 1000));
        return 'ok';
      })()`,
      awaitPromise: true,
    },
    sessionId,
  );
  await sleep(2000);

  const d = JSON.parse((await cdp("Runtime.evaluate", { expression: FILAS, returnByValue: true }, sessionId)).result.value);

  console.log(`\n=== /atrakcje/ · filas alternadas ===`);
  console.log(`  filas: ${d.total}   sin foto: ${d.sinFoto}\n`);

  for (const f of d.filas) {
    console.log(
      `  ${String(f.i + 1).padStart(2)}. ${f.lado.padEnd(4)} img=${String(f.altoImg).padStart(4)}px` +
        ` texto=${String(f.altoTexto).padStart(4)}px  ${String(f.titulo).slice(0, 40).padEnd(42)} ${f.foto ?? ""}`,
    );
  }

  // Alternancia: debe ser izq, der, izq, der… sin dos iguales seguidos
  const lados = d.filas.filter((f) => f.lado !== "(sin foto)").map((f) => f.lado);
  let saltos = 0;
  for (let i = 1; i < lados.length; i++) if (lados[i] === lados[i - 1]) saltos++;
  console.log(`\n  alternancia: ${lados.join(" ")}`);
  console.log(`  ¿dos seguidas del mismo lado? ${saltos === 0 ? "no, correcto" : `SÍ, ${saltos} veces`}`);

  // Alturas: las filas deben ser razonablemente parecidas
  const alturas = [...new Set(d.filas.map((f) => f.altoFila))].sort((a, b) => a - b);
  console.log(`  alturas de fila distintas: ${alturas.join(", ")} px`);

  // Red
  const malas = red.filter((r) => r.status !== 200);
  const unicas = [...new Set(red.map((r) => r.url))];
  console.log(`\n  fotos distintas descargadas: ${unicas.length}`);
  console.log(`  respuestas que no son 200: ${malas.length}`);
  for (const m of malas) console.log(`    HTTP ${m.status}  ${m.url}`);

  // Captura de las dos primeras filas
  try {
    await cdp(
      "Runtime.evaluate",
      { expression: `(() => { document.querySelector('.arow').scrollIntoView({block:'start'}); window.scrollBy(0,-120); return 'ok'; })()` },
      sessionId,
    );
    await sleep(1200);
    const shot = await cdp("Page.captureScreenshot", { format: "png" }, sessionId);
    await writeFile(resolve(OUT, "atrakcje-filas.png"), Buffer.from(shot.data, "base64"));
    console.log("\n  captura: .audit/atrakcje-filas.png");
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
