import { parseMonto } from '../registros/montos';

/**
 * Intérprete sin IA para el asistente: entiende las frases más comunes del tendero cuando no hay
 * ANTHROPIC_API_KEY o la IA falla. Con IA, Claude decide qué herramienta usar.
 */
export type Intencion =
  | { tipo: 'venta'; monto: number; dia: 'hoy' | 'ayer' }
  | { tipo: 'fiado'; monto: number; cliente: string }
  | { tipo: 'pago_fiado'; cliente: string }
  | { tipo: 'resumen' }
  | { tipo: 'solicitud' }
  | { tipo: 'ayuda' };

// Perezoso: "don pedro me pagó" debe capturar "don pedro", no "don pedro me".
const NOMBRE = "([a-záéíóúñü][a-záéíóúñü.' ]{1,40}?)";

export function interpretar(texto: string): Intencion {
  const t = texto.toLowerCase().trim();
  const monto = parseMonto(t);

  // "le fié 20 mil a don Pedro", "fiado 15.000 doña Rosa"
  const fiado = new RegExp(`fi[eé]|fiad|anot[aeé]\\w* .*debe`).test(t);
  if (fiado && monto) {
    const m =
      new RegExp(`\\ba\\s+${NOMBRE}$`).exec(t) ??
      new RegExp(`(?:fiado|fi[eé])\\s+[\\d.,$\\s]+(?:mil|k|millones?)?\\s+${NOMBRE}$`).exec(t);
    if (m) return { tipo: 'fiado', monto, cliente: capitalizar(m[1]) };
  }

  // "don Pedro me pagó", "pagó doña Rosa", "abonó Juan"
  const pago = new RegExp(
    `${NOMBRE}\\s+(?:me\\s+)?(?:pag[oó]|abon[oó])|(?:pag[oó]|abon[oó])\\s+${NOMBRE}`,
  ).exec(t);
  if (pago && !/vend/.test(t)) {
    return {
      tipo: 'pago_fiado',
      cliente: capitalizar((pago[1] ?? pago[2]).replace(/^(el|la)\s+/, '')),
    };
  }

  if (/vend[ií]|ventas? de hoy|hice\s|hicimos|caja/.test(t) && monto) {
    return { tipo: 'venta', monto, dia: /ayer/.test(t) ? 'ayer' : 'hoy' };
  }
  if (/resumen|cu[aá]nto (vend|llevo)|c[oó]mo voy|me deben|fiados/.test(t))
    return { tipo: 'resumen' };
  if (/puntaje|score|solicitud|cr[eé]dito|pr[eé]stamo|banco/.test(t)) return { tipo: 'solicitud' };
  return { tipo: 'ayuda' };
}

function capitalizar(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(^|\s)(\p{L})/gu, (_, sp: string, l: string) => sp + l.toUpperCase());
}

export const AYUDA =
  'Puedo anotar tus ventas y fiados, y contarte cómo va tu crédito. Prueba con: "Hoy vendí 350 mil", ' +
  '"Le fié 20 mil a don Pedro", "Don Pedro me pagó" o "¿Cómo va mi solicitud?".';
