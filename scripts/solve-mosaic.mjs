/**
 * solve-mosaic.mjs — busca composiciones de mosaico que se puedan COLOCAR sin
 * huecos, no solo que sumen bien.
 *
 * POR QUÉ
 *
 * Llevo varios intentos de acomodar las fotos "a ojo" y todos dejaron huecos. El
 * problema es aritmético y además geométrico: una composición puede sumar las 60
 * celdas y aun así no caber. Aquí se resuelve con un backtracking que coloca las
 * piezas de verdad, así que si encuentra una solución está garantizado que encaja.
 *
 * No abre navegador.
 *
 * Uso: node scripts/solve-mosaic.mjs [fotosDeseadas]
 */
const COLUMNAS = 12;
const FILAS = 5;

/** Piezas: nombre → ancho × alto en celdas. */
const PIEZAS = {
  big: { w: 6, h: 2 },
  tall: { w: 3, h: 2 },
  wide: { w: 6, h: 1 },
  base: { w: 3, h: 1 },
};

/**
 * Coloca las piezas en la retícula. Devuelve las posiciones o null.
 * Backtracking simple: la primera celda libre se rellena con una pieza que quepa.
 */
function colocar(cantidades) {
  const rejilla = Array.from({ length: FILAS }, () => new Array(COLUMNAS).fill(null));
  const restante = { ...cantidades };
  const colocadas = [];

  const primeraLibre = () => {
    for (let f = 0; f < FILAS; f++) {
      for (let c = 0; c < COLUMNAS; c++) {
        if (rejilla[f][c] === null) return { f, c };
      }
    }
    return null;
  };

  const cabe = (f, c, w, h) => {
    if (f + h > FILAS || c + w > COLUMNAS) return false;
    for (let y = f; y < f + h; y++) {
      for (let x = c; x < c + w; x++) {
        if (rejilla[y][x] !== null) return false;
      }
    }
    return true;
  };

  const marcar = (f, c, w, h, valor) => {
    for (let y = f; y < f + h; y++) {
      for (let x = c; x < c + w; x++) {
        rejilla[y][x] = valor;
      }
    }
  };

  const paso = () => {
    const libre = primeraLibre();
    if (!libre) return true;

    // Ordena las piezas de mayor a menor para que el backtracking no se dispare
    const candidatas = Object.keys(PIEZAS)
      .filter((n) => restante[n] > 0 && cabe(libre.f, libre.c, PIEZAS[n].w, PIEZAS[n].h))
      .sort((a, b) => PIEZAS[b].w * PIEZAS[b].h - PIEZAS[a].w * PIEZAS[a].h);

    for (const nombre of candidatas) {
      const { w, h } = PIEZAS[nombre];
      restante[nombre]--;
      marcar(libre.f, libre.c, w, h, nombre);
      colocadas.push({ nombre, f: libre.f, c: libre.c, w, h });

      if (paso()) return true;

      colocadas.pop();
      marcar(libre.f, libre.c, w, h, null);
      restante[nombre]++;
    }

    return false;
  };

  return paso() ? { colocadas, rejilla } : null;
}

const objetivo = Number(process.argv[2] ?? 14);

console.log(`  buscando composiciones COLOCABLES de ${objetivo} fotos en ${COLUMNAS}×${FILAS}\n`);

const encontradas = [];

for (let big = 0; big <= 2; big++) {
  for (let tall = 0; tall <= 5; tall++) {
    for (let wide = 0; wide <= 5; wide++) {
      const base = objetivo - big - tall - wide;
      if (base < 0 || base > 20) continue;

      const celdas = big * 12 + tall * 6 + wide * 6 + base * 3;
      if (celdas !== COLUMNAS * FILAS) continue;

      const res = colocar({ big, tall, wide, base });
      if (res) {
        encontradas.push({ big, tall, wide, base, colocadas: res.colocadas });
      }
    }
  }
}

if (encontradas.length === 0) {
  console.log(`  ✗ ninguna composición de ${objetivo} fotos se puede colocar sin huecos\n`);
} else {
  console.log(`  ✓ ${encontradas.length} composición(es) colocable(s):\n`);
  for (const s of encontradas) {
    console.log(`    big=${s.big} tall=${s.tall} wide=${s.wide} base=${s.base}`);
  }

  // Muestra el mapa de la primera
  const primera = encontradas[0];
  const rejilla = Array.from({ length: FILAS }, () => new Array(COLUMNAS).fill("·"));
  const letra = { big: "B", tall: "T", wide: "W", base: "b" };
  const orden = [];
  for (const p of primera.colocadas) {
    orden.push(p);
    for (let y = p.f; y < p.f + p.h; y++) {
      for (let x = p.c; x < p.c + p.w; x++) rejilla[y][x] = letra[p.nombre];
    }
  }

  console.log(`\n  MAPA de la primera (B=big T=tall W=wide b=base)\n`);
  console.log("       " + Array.from({ length: COLUMNAS }, (_, i) => (i + 1) % 10).join(" "));
  for (const [f, fila] of rejilla.entries()) {
    console.log(`  f${f + 1}   ` + fila.join(" "));
  }

  console.log(`\n  ORDEN de colocación (así van las fotos en el array):\n`);
  for (const [i, p] of orden.entries()) {
    console.log(`    ${String(i + 1).padStart(2)}. ${p.nombre.padEnd(4)}  fila ${p.f + 1} col ${p.c + 1}  ${p.w}×${p.h}`);
  }
}
