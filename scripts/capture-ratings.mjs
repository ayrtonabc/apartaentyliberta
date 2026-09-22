/**
 * capture-ratings.mjs — captura las valoraciones en los tres sitios donde salen.
 *
 * AISLAMIENTO: abre su propia instancia de Chrome headless con perfil temporal
 * exclusivo (.audit-profile-ratings2) y puerto de depuración propio (9356).
 * Solo cierra el proceso hijo que él mismo lanza; nunca toca instancias
 * abiertas. No añadir `Get-Process chrome | Stop-Process` ni `taskkill`.
 *
 * Uso: node scripts/capture-ratings.mjs [puerto]
 */
import { spawn } from "node:child_process";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const DEBUG_PORT = 9356;
const PROFILE = resolve(process.cwd(), ".audit-profile-ratings2");
const OUT = resolve(process.cwd(), ".audit");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Datos visibles del bloque de valoraciones, para comprobar que no se mezclan. */
const DATOS = `JSON.stringify((() => {
  const bloques = Array.from(document.querySelectorAll('.rsummary'));
  return bloques.map((b) => {
    const r = b.getBoundingClientRect();
    return {
      caja: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      plataformas: Array.from(b.querySelectorAll('.rsource')).map((a) => ({
        etiqueta: (a.getAttribute('aria-label') || ''),
        visible: a.getBoundingClientRect().width > 0,
      })),
      estrellasPorPlataforma: Array.from(b.querySelectorAll('.rsummary__stars')).map(
        (s) => s.querySelectorAll('.rsummary__star.is-on').length,
      ),
      total: b.querySelector('.rsummary__total')?.textContent?.replace(/\\s+/g, ' ').trim(),
    };
  });
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

  const visitar = async (ruta, archivo, selectorScroll) => {
    const { targetId } = await cdp("Target.createTarget", { url: `http://localhost:${PORT_SITE}${ruta}` });
    const attach = await cdp("Target.attachToTarget", { targetId, flatten: true });
    await cdp("Page.enable", {}, attach.sessionId);
    await cdp("Runtime.enable", {}, attach.sessionId);
    await cdp(
      "Emulation.setDeviceMetricsOverride",
      { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false },
      attach.sessionId,
    );
    await sleep(2400);

    // Hay que acercarse para que [data-reveal] las muestre
    await cdp(
      "Runtime.evaluate",
      { expression: `(() => { const e = document.querySelector('${selectorScroll}'); if (e) e.scrollIntoView({block:'center'}); return 'ok'; })()` },
      attach.sessionId,
    );
    await sleep(1400);

    const out = await cdp("Runtime.evaluate", { expression: DATOS, returnByValue: true }, attach.sessionId);
    const bloques = JSON.parse(out.result.value);
    console.log(`\n=== ${ruta} ===`);
    for (const b of bloques) {
      console.log(`  bloque ${b.caja.w}×${b.caja.h} en y=${b.caja.y}`);
      for (let i = 0; i < b.plataformas.length; i++) {
        console.log(
          `    ${b.plataformas[i].etiqueta.padEnd(42)} estrellas=${b.estrellasPorPlataforma[i]}  visible=${b.plataformas[i].visible}`,
        );
      }
      console.log(`    total: ${b.total}`);
    }

    const { result } = await cdp(
      "Runtime.evaluate",
      {
        expression: `(() => {
          const b = document.querySelector('.rsummary').closest('section, .trust__rating, .rev__summary') || document.querySelector('.rsummary');
          const r = b.getBoundingClientRect();
          return JSON.stringify({ y: r.top + window.scrollY, h: r.height, x: r.left, w: r.width });
        })()`,
        returnByValue: true,
      },
      attach.sessionId,
    );
    const caja = JSON.parse(result.value);
    const clip = {
      x: Math.max(0, caja.x - 16),
      y: Math.max(0, caja.y - 16),
      width: Math.min(caja.w + 32, 1440),
      height: Math.min(caja.h + 32, 900),
      scale: 2,
    };
    const shot = await cdp("Page.captureScreenshot", { format: "png", clip }, attach.sessionId);
    await writeFile(resolve(OUT, archivo), Buffer.from(shot.data, "base64"));
    console.log(`  captura: .audit/${archivo}`);
  };

  await visitar("/", "ratings-trust.png", ".trust__rating");
  await visitar("/opinie/", "ratings-page.png", ".scores");

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
