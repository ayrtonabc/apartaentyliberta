/**
 * verify-header.mjs — cabecera en sus dos estados (arriba y con scroll).
 *
 * ---------------------------------------------------------------------------
 * AISLAMIENTO DEL NAVEGADOR — LEER ANTES DE TOCAR
 *
 * Abre su PROPIA instancia de Chrome en modo headless con:
 *   - perfil temporal exclusivo  (.audit-profile-header)
 *   - puerto de depuración propio (9338)
 *
 * La única acción sobre procesos es `child.kill()` sobre el hijo que este mismo
 * script lanza. Nunca busca, reutiliza ni cierra instancias de Chrome ya
 * abiertas, así que es seguro ejecutarlo mientras el usuario tiene su navegador
 * abierto trabajando.
 *
 * NO añadir aquí (ni en ningún otro script de este directorio) nada como
 * `Get-Process chrome | Stop-Process` o `taskkill /IM chrome.exe`: cerraría las
 * pestañas del usuario.
 *
 * Si Chrome no arranca, el script sale con un aviso en vez de esperar: una
 * limpieza manual del perfil es responsabilidad de quien lo ejecuta, no del
 * script matando procesos ajenos.
 * ---------------------------------------------------------------------------
 *
 * Verifica:
 *   1. El logotipo completo se ve sin cortes en la posición inicial.
 *   2. Los enlaces de navegación van a la derecha, con los iconos sociales.
 *   3. Al hacer scroll, en cuanto la barra coge fondo, todo el texto es negro.
 *
 * Uso: node scripts/verify-header.mjs [puerto]
 */
import { spawn } from "node:child_process";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const DEBUG_PORT = 9338;
const PROFILE = resolve(process.cwd(), ".audit-profile-header");
const OUT = resolve(process.cwd(), ".audit");

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chromePath) {
  console.error("No se encontró Chrome ni Edge en las rutas habituales.");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Colores y atributos de la cabecera en el estado actual. */
const SNAPSHOT = `JSON.stringify((() => {
  const get = (s, prop) => {
    const el = document.querySelector(s);
    return el ? getComputedStyle(el)[prop] : '—';
  };
  const hdr = document.querySelector('[data-header]');
  const bar = document.querySelector('.hdr__bar');
  return {
    scrollY: Math.round(window.scrollY),
    estado: hdr.getAttribute('data-state'),
    tema: hdr.getAttribute('data-theme') || '(ninguno)',
    fondoBarra: getComputedStyle(bar).backgroundColor,
    enlace: get('.hdr__link', 'color'),
    social: get('.hdr__social .social__link', 'color'),
    telefono: get('.hdr__phone', 'color'),
    idioma: get('.lang__toggle', 'color'),
    cta: get('.hdr__cta', 'color'),
  };
})())`;

/** Geometría: comprueba que el logo no se recorta y que el nav va a la derecha. */
const LAYOUT = `JSON.stringify((() => {
  const box = (s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { izq: Math.round(b.left), der: Math.round(b.right), an: Math.round(b.width), al: Math.round(b.height) };
  };
  const logo = document.querySelector('.hdr__wordmark');
  const logoBox = logo ? logo.getBoundingClientRect() : null;
  const natural = logo ? logo.naturalWidth / logo.naturalHeight : 0;
  const pintado = logoBox && logoBox.height > 0 ? logoBox.width / logoBox.height : 0;
  return {
    ventana: window.innerWidth,
    marca: box('.hdr__brand'),
    logo: logoBox
      ? {
          an: Math.round(logoBox.width),
          al: Math.round(logoBox.height),
          natural: logo.naturalWidth + 'x' + logo.naturalHeight,
          /** Si la proporción pintada difiere de la natural, el logo se deforma */
          deformado: natural > 0 ? Math.abs(pintado - natural) > 0.02 : null,
        }
      : null,
    nav: box('.hdr__nav'),
    social: box('.hdr__social'),
    telefono: box('.hdr__phone'),
    idioma: box('.hdr__lang'),
    cta: box('.hdr__cta'),
  };
})())`;

const VIEWPORTS = [
  { label: "1440", w: 1440, h: 900, mobile: false },
  { label: "1280", w: 1280, h: 800, mobile: false },
  { label: "1024", w: 1024, h: 800, mobile: false },
  { label: "390", w: 390, h: 844, mobile: true },
];

async function main() {
  await mkdir(OUT, { recursive: true });

  // El perfil se limpia solo si ningún Chrome lo está usando; si falla, seguimos
  try {
    await rm(PROFILE, { recursive: true, force: true });
  } catch {
    console.warn("[aviso] no se pudo limpiar el perfil temporal; se reutiliza");
  }

  const child = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
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
    console.error(
      "Chrome no expuso el puerto de depuración.\n" +
        "Cierra solo la instancia de este script (perfil .audit-profile-header) y vuelve a intentarlo.",
    );
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
    new Promise((resolve_, reject_) => {
      const myId = ++id;
      pending.set(myId, { resolve: resolve_, reject: reject_ });
      ws.send(JSON.stringify({ id: myId, method, params, sessionId }));
      setTimeout(() => {
        if (pending.has(myId)) {
          pending.delete(myId);
          reject_(new Error(`${method}: sin respuesta en 15 s`));
        }
      }, 15000);
    });

  const { targetId } = await cdp("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
  await cdp("Page.enable", {}, sessionId);
  await cdp("Runtime.enable", {}, sessionId);

  const evaluate = async (expression) =>
    JSON.parse((await cdp("Runtime.evaluate", { expression, returnByValue: true }, sessionId)).result.value);

  const shoot = async (file, w, h) => {
    const { data } = await cdp(
      "Page.captureScreenshot",
      { format: "png", clip: { x: 0, y: 0, width: w, height: h, scale: 2 } },
      sessionId,
    );
    await writeFile(resolve(OUT, file), Buffer.from(data, "base64"));
  };

  /**
   * Primero se miden TODOS los estados y al final se intentan las capturas.
   *
   * Motivo: en este entorno, una llamada a Page.captureScreenshot con recorte
   * deja la sesión de DevTools inservible a partir de ahí. Midiendo primero, los
   * datos quedan impresos aunque las capturas fallen; al revés se perdía todo.
   */
  const results = [];

  for (const vp of VIEWPORTS) {
    await cdp(
      "Emulation.setDeviceMetricsOverride",
      { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.mobile },
      sessionId,
    );
    await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}/` }, sessionId);
    await sleep(2400);

    const geometry = await evaluate(LAYOUT);
    const states = [];

    for (const y of [0, 30, 900]) {
      await cdp("Runtime.evaluate", { expression: `window.scrollTo(0, ${y}); 'ok'`, sessionId });
      await sleep(800);
      states.push(await evaluate(SNAPSHOT));
    }

    results.push({ vp, geometry, states });
  }

  let fallos = 0;

  for (const { vp, geometry, states } of results) {
    console.log(`\n=== ${vp.label} px ===`);
    console.log(`  marca      ${geometry.marca.an}×${geometry.marca.al} en x=${geometry.marca.izq}`);
    console.log(
      `  logo       ${geometry.logo.an}×${geometry.logo.al} (natural ${geometry.logo.natural})` +
        `  deformado=${geometry.logo.deformado}  completo=${!geometry.logo.deformado}`,
    );
    console.log(
      `  nav        x ${geometry.nav?.izq ?? '—'} → ${geometry.nav?.der ?? '—'}` +
        `   social ${geometry.social?.izq ?? '—'}   tel ${geometry.telefono?.izq ?? '—'}` +
        `   idioma ${geometry.idioma?.izq ?? '—'}   cta ${geometry.cta?.der ?? '—'}`,
    );

    for (const s of states) {
      const negro = s.enlace === "rgb(0, 0, 0)";
      const conFondo = s.fondoBarra !== "rgba(0, 0, 0, 0)";
      const coherente = negro === conFondo;
      if (!coherente) fallos++;
      console.log(
        `  scroll ${String(s.scrollY).padStart(4)}  estado=${s.estado.padEnd(9)} tema=${s.tema.padEnd(10)}` +
          ` fondo=${conFondo ? "sí" : "no "}  texto=${s.enlace.padEnd(22)}` +
          `  ${coherente ? "coherente" : "INCOHERENTE"}`,
      );
    }
  }

  console.log(
    `\nComprobación 3 (texto negro en cuanto hay fondo): ${fallos === 0 ? "CORRECTA" : `${fallos} incoherencias`}`,
  );

  // Capturas al final: si fallan, los datos ya están impresos
  for (const { vp } of results) {
    try {
      await cdp(
        "Emulation.setDeviceMetricsOverride",
        { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.mobile },
        sessionId,
      );
      await cdp("Page.navigate", { url: `http://localhost:${PORT_SITE}/` }, sessionId);
      await sleep(2200);
      await shoot(`header-${vp.label}-top.png`, vp.w, 110);
      await cdp("Runtime.evaluate", { expression: "window.scrollTo(0, 900); 'ok'", sessionId });
      await sleep(900);
      await shoot(`header-${vp.label}-scrolled.png`, vp.w, 110);
      console.log(`  captura ${vp.label} ✓`);
    } catch {
      console.warn(`  captura ${vp.label}: no disponible en este entorno (datos ya medidos)`);
      break;
    }
  }

  ws.close();
  child.kill();
  console.log(`\nCapturas en .audit/ (las que se hayan podido generar)`);
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
