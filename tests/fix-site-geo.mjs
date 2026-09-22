// tests/fix-site-geo.mjs
// Fix byte-exacto de data/site.ts para evitar el gotcha del Write tool
// con strings que tienen caracteres especiales (comillas, escapes unicode).
// Ejecutar: node tests/fix-site-geo.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FILE = join(__dirname, "..", "src", "data", "site.ts");

const content = readFileSync(FILE, "utf-8");

// Verificar y corregir los strings de coordenadas
// En disco, el archivo puede tener:
//   - Template literal correcto: `53°42'12.1" N` (✅ válido)
//   - Comillas simples con escape corrupto: '53°42\\'12.1" N' (❌ roto)
//   - Comillas dobles con escape: "53°42'12.1\" N" (✅ válido)

const expectedLat = "`53\u00b042'12.1\" N`"; // backticks, comilla simple interna, doble comilla escapada
const expectedLng = "`20\u00b004'40.8\" E`";

// Reemplaza ambas formas incorrectas con la correcta
let fixed = content;
let changes = 0;

// Reemplaza template literal corrupto (con \\' literal) por correcto
const beforeTemplate = fixed;
fixed = fixed.replace(
  /latDMS:\s*'53°42\\'12\.1"\s*N'/,
  `latDMS: ${expectedLat},`,
);
fixed = fixed.replace(
  /lngDMS:\s*'20°04\\'40\.8"\s*E'/,
  `lngDMS: ${expectedLng},`,
);

if (fixed !== beforeTemplate) {
  changes += 2;
}

// Reemplaza la versión con comillas dobles si está mal
fixed = fixed.replace(
  /latDMS:\s*"53°42'12\.1"\s*N"/,
  `latDMS: ${expectedLat},`,
);
fixed = fixed.replace(
  /lngDMS:\s*"20°04'40\.8"\s*E"/,
  `lngDMS: ${expectedLng},`,
);

if (fixed !== beforeTemplate) {
  changes += 2;
}

// Reemplaza la versión ya correcta (idempotente)
fixed = fixed.replace(/latDMS:\s*`53°42'12\.1"\s*N`/, `latDMS: ${expectedLat},`);
fixed = fixed.replace(/lngDMS:\s*`20°04'40\.8"\s*E`/, `lngDMS: ${expectedLng},`);

writeFileSync(FILE, fixed, "utf-8");

console.log(`Archivo: ${FILE}`);
console.log(`Bytes: ${fixed.length}`);
console.log(`Línea 35: ${fixed.split("\n")[34]}`);
console.log(`Línea 36: ${fixed.split("\n")[35]}`);
console.log(`Cambios: ${changes > 0 ? "REALIZADOS" : "ninguno (ya estaba correcto)"}`);

// Verificar que es parseable por TypeScript usando un trick simple:
// Si el archivo tiene '...\\'...' o "...\\'..." eso es bug.
if (fixed.match(/'(?:[^'\\]|\\.)*\\'/)) {
  console.error("⚠️ ATENCIÓN: el archivo aún contiene '\\' literal dentro de un string con comillas simples.");
  console.error("Busca el patrón y reemplázalo manualmente.");
  process.exit(1);
} else {
  console.log("✓ Sin '\\' literales en strings con comillas simples");
}
