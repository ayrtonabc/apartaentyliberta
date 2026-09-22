/**
 * capture-cards.mjs — captura las tarjetas de apartamento.
 *
 * AISLAMIENTO: abre su propia instancia de Chrome headless con perfil temporal
 * exclusivo (.audit-profile-cards) y puerto de depuración propio (9354). Solo
 * cierra el proceso hijo que él mismo lanza; nunca toca instancias abiertas.
 * No añadir `Get-Process chrome | Stop-Process` ni `taskkill`.
 *
 * Uso: node scripts/capture-cards.mjs [puerto]
 */
import { spawn } from "node:child_process";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT_SITE = process.argv[2] ?? "8080";
const DEBUG_PORT = 9354;
const PROFILE = resolve(process.cwd(), ".audit-profile-cards");
const OUT = resolve(process.cwd(), ".audit");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Caja del bloque de tarjetas y de cada tarjeta, para medir igualdad. */
const BOXES = `JSON.stringify((() => {
  const box = (el) => {
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) };
  };
  /** Detecta texto recortado o envuelto de más. */
  const textFit = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      texto: el.textContent.trim(),
      ancho: Math.round(el.getBoundingClientRect().width),
      scrollW: el.scrollWidth,
      alto: Math.round(el.getBoundingClientRect().height),
      lineHeight: Math.round(parseFloat(cs.lineHeight)),
      recortado: el.scrollWidth > el.clientWidth + 1,
    };
  };
  const cards = Array.from(document.querySelectorAll('.acard'));
  const grid = document.querySelector('.apt-grid') || cards[0]?.parentElement;
  return {
    contenedor: grid ? box(grid) : null,
    tarjetas: cards.map((c, i) => {
      const lineas = (el) => {
        if (!el) return 0;
        const r = document.createRange();
        r.selectNodeContents(el);
        return new Set(Array.from(r.getClientRects()).filter((x) => x.height > 0).map((x) => Math.round(x.top))).size;
      };
      return {
        i,
        caja: box(c),
        titulo: c.querySelector('.acard__title')?.textContent?.trim(),
        vista: c.querySelector('.acard__view')?.textContent?.trim(),
        alto: Math.round(c.getBoundingClientRect().height),
        sellosLineas: Array.from(c.querySelectorAll('.acard__points li')).map((l) => ({ t: l.textContent.trim(), lineas: lineas(l) })),
        etiquetas: Array.from(c.querySelectorAll('.acard__spec-text span')).map(textFit),
        chips: Array.from(c.querySelectorAll('.acard__points li')).map((l) => ({
          t: l.textContent.trim(),
          ancho: Math.round(l.getBoundingClientRect().width),
        })),
        // Hueco sobrante antes del pie, señal de espacio muerto
        huecoAntesDelPie: (() => {
          const marks = c.querySelector('.acard__points');
          const foot = c.querySelector('.acard__foot');
          if (!marks || !foot) return null;
          return Math.round(foot.getBoundingClientRect().top - marks.getBoundingClientRect().bottom);
        })(),
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

  const medirYcapturar = async (ruta, archivo, ancho, modo) => {
    const { targetId } = await cdp("Target.createTarget", {
      url: `http://localhost:${PORT_SITE}${ruta}`,
    });
    const attach = await cdp("Target.attachToTarget", { targetId, flatten: true });
    await cdp("Page.enable", {}, attach.sessionId);
    await cdp("Runtime.enable", {}, attach.sessionId);
    await cdp(
      "Emulation.setDeviceMetricsOverride",
      { width: ancho, height: 1000, deviceScaleFactor: 1, mobile: false },
      attach.sessionId,
    );
    await sleep(2400);

    /*
     * Hay que BAJAR hasta las tarjetas antes de medir y capturar.
     *
     * Llevan [data-reveal], que las deja en opacidad 0 hasta que el
     * IntersectionObserver las ve. Midiendo desde arriba salían invisibles y la
     * captura era una franja vacía que parecía un fallo de diseño.
     */
    await cdp(
      "Runtime.evaluate",
      {
        expression: `(() => {
          const c = document.querySelector('.acard');
          if (c) c.scrollIntoView({ block: 'center' });
          return 'ok';
        })()`,
      },
      attach.sessionId,
    );
    await sleep(1400);

    const out = await cdp("Runtime.evaluate", { expression: BOXES, returnByValue: true }, attach.sessionId);
    const datos = JSON.parse(out.result.value);

    console.log(`\n=== ${ruta} (${ancho} px) ===`);
    for (const t of datos.tarjetas) {
      console.log(`  ${String(t.titulo).padEnd(24)} ${t.caja.w}×${t.caja.h}  hueco antes del pie: ${t.huecoAntesDelPie}px`);
    }
    const alturas = datos.tarjetas.map((t) => t.alto);
    console.log(`  alturas: ${alturas.join(", ")}  → ${new Set(alturas).size === 1 ? "iguales" : "DESIGUALES"}`);

    const recortadas = datos.tarjetas.flatMap((t) => t.etiquetas.filter((e) => e && e.recortado).map((e) => e.texto));
    console.log(`  etiquetas recortadas: ${recortadas.length ? recortadas.join(", ") : "ninguna"}`);

    const multi = datos.tarjetas.flatMap((t) => t.sellosLineas.filter((s) => s.lineas > 1).map((s) => s.t));
    console.log(`  sellos en varias líneas: ${multi.length ? multi.join(", ") : "ninguno"}`);

    const anchosChips = datos.tarjetas[0]?.chips.map((c) => `${c.t}=${c.ancho}px`).join(", ");
    console.log(`  ancho de sellos (tarjeta 1): ${anchosChips}`);

    // Las coordenadas de la captura son de la PÁGINA, no del viewport
    const { result } = await cdp(
      "Runtime.evaluate",
      {
        expression: `(() => {
          const c = document.querySelector('.acard');
          const cont = document.querySelector('.apt-grid') || c.parentElement;
          const r = cont.getBoundingClientRect();
          return JSON.stringify({ y: r.top + window.scrollY, h: r.height });
        })()`,
        returnByValue: true,
      },
      attach.sessionId,
    );
    const caja = JSON.parse(result.value);

    const soloPrimera = modo === "primera";
    const tarjeta = datos.tarjetas[0].caja;
    const clip = soloPrimera
      ? {
          x: Math.max(0, tarjeta.x),
          y: Math.max(0, caja.y),
          width: tarjeta.w,
          height: tarjeta.h,
          scale: 1,
        }
      : {
          x: 0,
          y: Math.max(0, caja.y - 20),
          width: ancho,
          height: Math.min(caja.h + 40, 2400),
          scale: 1,
        };
    const shot = await cdp("Page.captureScreenshot", { format: "png", clip }, attach.sessionId);
    await writeFile(resolve(OUT, archivo), Buffer.from(shot.data, "base64"));
    console.log(`  captura: .audit/${archivo}`);
  };

  await medirYcapturar("/", "cards-home.png", 1440);
  await medirYcapturar("/apartamenty/", "cards-listado.png", 1440);
  // Primer plano de la primera tarjeta del listado, para revisar el detalle
  await medirYcapturar("/apartamenty/", "card-zoom.png", 1440, "primera");
  // Móvil: la tarjeta pasa a una columna y las cifras vuelven a 2×2
  await medirYcapturar("/", "cards-movil.png", 390);
  await medirYcapturar("/", "cards-tableta.png", 820);

  ws.close();
  child.kill();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
