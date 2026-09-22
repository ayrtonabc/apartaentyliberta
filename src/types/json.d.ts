/**
 * Declaraciones de tipos para datos JSON importados directamente.
 * Los manifiestos generados en build (imágenes responsivas) no llevan tipos,
 * así que se declaran aquí para no perder seguridad de tipos.
 */

declare module "~/data/image-manifest.json" {
  const value: Record<
    string,
    {
      width: number;
      height: number;
      mtimeMs: number;
      lqip: string;
      widths: number[];
      fallback: string;
    }
  >;
  export default value;
}
