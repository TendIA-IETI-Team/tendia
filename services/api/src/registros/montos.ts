/**
 * Lectura de montos como los escribe un tendero: "350 mil", "$1.200.000", "2 millones",
 * "1,5 palos", "80k". Devuelve pesos enteros o null si no hay un monto claro.
 */
export function parseMonto(texto: string): number | null {
  const t = texto.toLowerCase().replace(/\s+/g, ' ').trim();
  const m =
    /\$?\s*(\d{1,3}(?:[.\s]\d{3})+|\d+(?:[.,]\d+)?)\s*(millones|millón|millon|palos?|mil|k|lucas?)?/.exec(
      t,
    );
  if (!m) return null;
  const [, numero, unidad] = m;
  // "1.200.000" o "1 200 000" son miles; "1,5" o "1.5" con unidad son decimales.
  const esMiles = /^\d{1,3}([.\s]\d{3})+$/.test(numero);
  const base = esMiles ? Number(numero.replace(/[.\s]/g, '')) : Number(numero.replace(',', '.'));
  if (!Number.isFinite(base)) return null;
  const factor =
    unidad && /mill|palo/.test(unidad)
      ? 1_000_000
      : unidad && /mil|k|luca/.test(unidad)
        ? 1_000
        : 1;
  const valor = Math.round(base * factor);
  return valor > 0 ? valor : null;
}

export function formatoPesos(n: number): string {
  return `$${Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** Fecha de hoy en Bogotá (UTC−5), formato YYYY-MM-DD. */
export function hoyBogota(ahora = new Date()): string {
  return new Date(ahora.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
