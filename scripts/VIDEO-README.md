# Vídeo del hero — gestionado por el propietario

## Regla

**Nadie del repositorio toca `public/assets/video/hero.mp4`.**

Es un archivo que el dueño del sitio reemplaza cuando exporta su propia versión a
medida. Instrucción literal: *"deja de tocar eso, déjame a mí encontrar la mejor
solución"*.

Si ves que `hero.mp4` cambia de duración o de peso, **es él exportando**. No es un
archivo corrupto, no hay nada que «arreglar», y recodificarlo pisa su trabajo.
Eso pasó varias veces antes de que lo aclarara.

## Consecuencias en el código

- `scripts/encode-hero-video.mjs` queda como **herramienta manual**. No lo llama
  ningún `npm run`, ningún test ni ningún paso de build. Solo se ejecuta si él lo
  pide expresamente.
- `tests/validate-structure.mjs` **ya no comprueba duración ni peso**: cualquier
  valor que él eligiera haría fallar la comprobación, y un test que da errores
  falsos sobre algo que gestiona otra persona es peor que no tenerlo. Quedan solo
  dos comprobaciones que sí dependen de la web:
  1. Que existan la variante de móvil y el póster (los usa el `<video>`).
  2. Que el archivo **no lleve pista de audio**: el hero va silenciado y varios
     navegadores bloquean el autoplay si el vídeo trae sonido, así que un export
     con audio se vería como un hueco negro. **Esto sí hay que avisarlo.**

## Lo que sigue valiendo de lo aprendido

| Script | Para qué |
|---|---|
| `tune-hero-full.mjs` | Peso y calidad por CRF a resolución completa. |
| `tune-hero-res.mjs` | Coste en calidad de bajar resolución. |
| `verify-video-advances.mjs` | Comprueba que reproduce en el navegador. |
| `measure-hero-contrast.mjs` | Contraste del texto sobre los fotogramas reales. |

Y de las mediciones quedó un dato útil por si algún día lo pide: el máster
original (11,36 MB, 1483 kbps, 1920×1080) está **muy** ajustado, así que
recodificarlo a la misma resolución sale **más pesado** que él. A 1920 el suelo
está en unos 8,9 MB con CRF 34.

## Obsoletos

Los cinco scripts de búsqueda de bucle (`check-loop-seam`, `find-best-hero-loop`,
`find-matching-frames`, `find-seamless-loop`, `tune-loop-crossfade`) existen
porque en su día el vídeo se recortaba a 1,5 s y había que buscar el mejor
empalme. No aplican. Están marcados como obsoletos en su cabecera.
