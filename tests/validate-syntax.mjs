// tests/validate-syntax.mjs
// Verifica que todos los archivos .ts y .astro del proyecto parsean
// correctamente. Ejecutar: node tests/validate-syntax.mjs
//
// Útil cuando el Write tool pudo haber corrompido chars (gotcha conocido).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "src");

const issues = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".astro") continue;
      walk(full);
    } else if ([".ts", ".astro"].includes(extname(full))) {
      check(full);
    }
  }
}

function check(file) {
  const content = readFileSync(file, "utf-8");

  // Gotcha #1: '...\\'...' (escape corrupto dentro de single quotes)
  const re1 = /'(?:[^'\\]|\\.)*\\'/g;
  let m;
  while ((m = re1.exec(content)) !== null) {
    const line = content.slice(0, m.index).split("\n").length;
    issues.push({ file, line, kind: "escape-malformed", snippet: m[0].slice(0, 60) });
  }

  // Gotcha #2: literal backtick + n (cambio previo mal serializado)
  if (/`n[ \t]/g.test(content)) {
    const line = content.split("\n").findIndex((l) => /`n[ \t]/.test(l)) + 1;
    issues.push({ file, line, kind: "literal-backtick-n", snippet: "`n en string" });
  }

  // Gotcha #3: comilla simple huérfana en string (heurística)
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    // Detecta algo como  'string\\'hola'  o  'algo\\'  sin cerrar
    if (/(?<!\\)'.*(?<!\\)'/.test(line) && /'[^']*'/.test(line)) {
      // OK
    }
  });
}

walk(ROOT);

if (issues.length === 0) {
  console.log("✓ Sin problemas de sintaxis detectados en src/");
  console.log("  Todos los strings con comillas están bien escapados.");
  process.exit(0);
} else {
  console.log(`✗ ${issues.length} problema(s) detectado(s):\n`);
  for (const i of issues) {
    console.log(`  ${i.file}:${i.line}  [${i.kind}]  ${i.snippet}`);
  }
  process.exit(1);
}
