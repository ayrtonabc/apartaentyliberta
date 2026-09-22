/**
 * check-social-filter.mjs — comprueba en el navegador el filtro de las marcas
 * del propietario en los dos estados de la cabecera.
 *
 * AISLAMIENTO: abre su propia instancia de Chrome headless con perfil temporal
 * exclusivo (.audit-profile-filter) y puerto de depuración propio (9351). Solo
 * cierra el proceso hijo que él mismo lanza; nunca toca instancias abiertas.
 * No añadir `Get-Process chrome | Stop-Process` ni `taskkill`.
 *
 * Uso: node scripts/check-social-filter.mjs [puerto]
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
/**
 * Ruta a comprobar. Por defecto la home, cuyo estado inicial es "sobre el hero".
 * Con una ruta interior (p. ej. /cennik/) el estado inicial es el normal, con
 * la barra sobre fondo claro: sirve para verificar el filtro sin depender de
 * una segunda evaluación tras hacer scroll, que en este entorno rompe la sesión
 * de DevTools.
 */
const RUTA = process.argv[3] ?? "/";
const DEBUG_PORT = 9351;
const PROFILE = resolve(process.cwd(), ".audit-profile-filter");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Filtro computado de cada marca con etiqueta de red. */
const PROBE = `JSON.stringify((() => {
  const header = document.querySelector('[data-header]');
  const links = Array.from(document.querySelectorAll('.hdr__social .social__link'));
  return {
    estado: header.getAttribute('data-state'),
    tema: header.getAttribute('data-theme') || '(ninguno)',
    marcas: links
      .map((a) => {
        const img = a.querySelector('.social__img');
        const svg = a.querySelector('svg');
        const objetivo = img ?? svg;
        if (!objetivo) return null;
        return {
          red: (a.getAttribute('aria-label') || '').split(' ')[0],
          tipo: img ? 'img' : 'svg',
          filtro: getComputedStyle(objetivo).filter,
          opacidad: getComputedStyle(objetivo).opacity,
          // El SVG hereda por color: sirve para saber si es claro u oscuro
          color: getComputedStyle(objetivo).color,
        };
      })
      .filter(Boolean),
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
      }, 12000);
    });

  const { targetId } = await cdp("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
  await cdp("Page.enable", {}, sessionId);
  await cdp("Runtime.enable", {}, sessionId);
  await cdp(
    "Emulation.setDeviceMetricsOverride",
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}/` }, sessionId);
  await sleep(2400);

  const informe = (titulo, datos) => {
    console.log(`\n=== ${titulo} ===`);
    console.log(`  estado=${datos.estado}  tema=${datos.tema}`);
    for (const m of datos.marcas) {
      const blanco = m.filtro === "none";
      console.log(
        `    ${m.red.padEnd(14)} tipo=${m.tipo}  filtro=${m.filtro.padEnd(40)}` +
          ` opacidad=${m.opacidad}  → ${blanco ? "BLANCO (sin filtro)" : "oscuro (filtrado)"}`,
      );
    }
  };

  /**
   * Mide en una pestaña nueva con la ruta y el scroll indicados.
   *
   * Cada medición va en su propio destino porque reutilizar la pestaña entre
   * navegaciones deja la sesión de DevTools inservible en este entorno.
   */
  const medir = async (ruta, scrollY) => {
    const { targetId: t } = await cdp("Target.createTarget", {
      url: `http://localhost:${PORT_SITE}${ruta}`,
    });
    const attach = await cdp("Target.attachToTarget", { targetId: t, flatten: true });
    await cdp("Page.enable", {}, attach.sessionId);
    await cdp("Runtime.enable", {}, attach.sessionId);
    await cdp(
      "Emulation.setDeviceMetricsOverride",
      { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
      attach.sessionId,
    );
    await sleep(2400);
    if (scrollY > 0) {
      await cdp(
        "Runtime.evaluate",
        { expression: `window.scrollTo(0, ${scrollY}); 'ok'` },
        attach.sessionId,
      );
      await sleep(1200);
    }
    const out = await cdp("Runtime.evaluate", { expression: PROBE, returnByValue: true }, attach.sessionId);
    return JSON.parse(out.result.value);
  };

  const top = await medir(RUTA, 0);
  informe(`inicial · ${RUTA}`, top);

  // Veredicto sobre las marcas que son archivo (Facebook y Booking.com)
  const marcas = top.marcas.filter((m) => m.tipo === "img");
  const hayHero = top.tema === "on-dark";
  const correcto = hayHero
    ? marcas.every((m) => m.filtro === "none")
    : marcas.every((m) => m.filtro !== "none");

  console.log("\n--- veredicto ---");
  console.log(`  situación: ${hayHero ? "sobre el hero (fondo oscuro)" : "fondo claro"}`);
  console.log(`  esperado:  marcas ${hayHero ? "SIN filtro (blancas)" : "CON filtro (oscuras)"}`);
  console.log(`  resultado: ${correcto ? "CORRECTO" : "INCORRECTO"}`);

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
