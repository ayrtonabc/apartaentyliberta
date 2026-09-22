/**
 * audit-computed.mjs — extrae estilos computados reales del navegador.
 * Sirve para auditar contraste y coherencia con datos, no con impresiones.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const PORT = process.argv[2] ?? "4410";
const BASE = `http://localhost:${PORT}`;
const DEBUG_PORT = 9334;
const PROFILE = resolve(process.cwd(), ".audit-profile-2");

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp(ws, method, params = {}, sessionId) {
  const id = Math.floor(Math.random() * 1e9);
  return new Promise((res, rej) => {
    const onMessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id !== id) return;
      ws.removeEventListener("message", onMessage);
      m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result);
    };
    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

const TARGETS = [
  { url: "/", label: "hero", sel: ".hero__subtitle" },
  { url: "/", label: "hero-title", sel: ".hero__title" },
  { url: "/", label: "hero-badge/eyebrow", sel: ".hero__eyebrow" },
  { url: "/", label: "hero-submit", sel: ".hero__submit" },
  { url: "/", label: "trust-score", sel: ".trust__score" },
  { url: "/", label: "trust-pillar-sub", sel: ".trust__pillar-text span" },
  { url: "/", label: "amen-caption-title", sel: ".amen__photo-title" },
  { url: "/", label: "amen-caption-text", sel: ".amen__photo-text" },
  { url: "/", label: "amen-photo-bg", sel: ".amen__photo" },
  { url: "/", label: "attr-name", sel: ".attr__name" },
  { url: "/", label: "attr-tag", sel: ".attr__tag" },
  { url: "/", label: "loc-distance-value", sel: ".loc__distance-value" },
  { url: "/", label: "price-note", sel: ".price-preview__note" },
  { url: "/", label: "reason-num", sel: ".reasons__num" },
  { url: "/", label: "rev-overall-label", sel: ".rev__overall-label" },
  { url: "/", label: "rev-source-count", sel: ".rev__source-count" },
  { url: "/", label: "rev-source-score", sel: ".rev__source-score" },
  { url: "/", label: "rev-date", sel: ".rev__date" },
  { url: "/", label: "footer-heading", sel: ".ftr__title" },
  { url: "/", label: "footer-logo-img", sel: ".ftr__logo img" },
  { url: "/", label: "footer-social", sel: ".ftr__social a" },
  { url: "/", label: "footer-legal", sel: ".ftr__legal a" },
  { url: "/", label: "footer-copy", sel: ".ftr__copy" },
  { url: "/", label: "cta-band-title", sel: ".cta-band__title" },
  { url: "/", label: "cta-band-media-img", sel: ".cta-band__media img" },
  { url: "/", label: "skip-link", sel: ".skip-link" },
  { url: "/", label: "skip-link-parent-pos", sel: ".hdr" },
  { url: "/rezerwacja/", label: "form-input", sel: "#bf-main-name" },
  { url: "/rezerwacja/", label: "form-label", sel: ".form-field__label" },
  { url: "/rezerwacja/", label: "form-icon", sel: ".form-field--icon .icon" },
  { url: "/cennik/", label: "rates-th", sel: ".rates thead th" },
  { url: "/cennik/", label: "rates-td", sel: ".rates tbody td" },
  { url: "/apartamenty/", label: "cmp-name", sel: ".cmp__name" },
  { url: "/apartamenty/", label: "cmp-row-th", sel: ".cmp__table tbody th" },
  { url: "/opinie/", label: "scores-star-off", sel: ".scores__stars svg" },
  { url: "/", label: "star-on", sel: ".trust__stars svg" },
];

const EXPR = (sel) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return JSON.stringify({ missing: true });
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const parent = el.parentElement;
  const pcs = parent ? getComputedStyle(parent) : null;
  return JSON.stringify({
    color: cs.color,
    background: cs.backgroundColor,
    fill: cs.fill,
    stroke: cs.stroke,
    strokeWidth: cs.strokeWidth,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    letterSpacing: cs.letterSpacing,
    lineHeight: cs.lineHeight,
    opacity: cs.opacity,
    position: cs.position,
    top: cs.top,
    width: Math.round(r.width),
    height: Math.round(r.height),
    text: (el.textContent || "").trim().slice(0, 42),
    parentPosition: pcs ? pcs.position : null,
    parentOverflow: pcs ? pcs.overflow : null,
  });
})()`;

async function main() {
  await rm(PROFILE, { recursive: true, force: true });

  const chrome = spawn(
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

  let version;
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    try {
      version = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json();
      break;
    } catch {}
  }

  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener("open", r);
    ws.addEventListener("error", j);
  });

  const { targetId } = await cdp(ws, "Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp(ws, "Target.attachToTarget", { targetId, flatten: true });
  await cdp(ws, "Page.enable", {}, sessionId);
  await cdp(ws, "Runtime.enable", {}, sessionId);
  await cdp(
    ws,
    "Emulation.setDeviceMetricsOverride",
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );

  let currentUrl = null;
  const results = {};

  for (const t of TARGETS) {
    if (currentUrl !== t.url) {
      await cdp(ws, "Page.navigate", { url: `${BASE}${t.url}` }, sessionId);
      await sleep(1500);
      await cdp(
        ws,
        "Runtime.evaluate",
        { expression: "window.scrollTo(0, document.body.scrollHeight); 'x'" },
        sessionId,
      );
      await sleep(1200);
      await cdp(ws, "Runtime.evaluate", { expression: "window.scrollTo(0, 0); 'x'" }, sessionId);
      await sleep(400);
      currentUrl = t.url;
    }
    const { result } = await cdp(ws, "Runtime.evaluate", { expression: EXPR(t.sel), returnByValue: true }, sessionId);
    const data = JSON.parse(result.value);
    results[t.label] = data;
  }

  console.log(JSON.stringify(results, null, 1));

  ws.close();
  chrome.kill();
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exitCode = 1;
});
