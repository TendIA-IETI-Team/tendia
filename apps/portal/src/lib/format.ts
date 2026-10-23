const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function pesos(n: number): string {
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}

/** Millones con un decimal: 8.450.000 → "8,5 M". */
export function millones(n: number): string {
  return `${(n / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`;
}

export function mesCorto(mes: string): string {
  return `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(2, 4)}`;
}

export function fecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

export const ESTADOS: Record<
  string,
  { texto: string; tono: 'info' | 'warning' | 'success' | 'danger' }
> = {
  ENVIADA: { texto: 'Por revisar', tono: 'info' },
  GARANTIA_SOLICITADA: { texto: 'Esperando garantía', tono: 'warning' },
  GARANTIA_ENVIADA: { texto: 'Garantía por evaluar', tono: 'info' },
  APROBADA: { texto: 'Aprobada', tono: 'success' },
  RECHAZADA: { texto: 'Rechazada', tono: 'danger' },
};

export const RECOMENDACIONES: Record<string, string> = {
  APROBAR: 'Aprobar',
  PEDIR_GARANTIA: 'Pedir garantía',
  RECHAZAR: 'Rechazar',
};

export const GARANTIAS: Record<string, string> = {
  FNG: 'Fondo Nacional de Garantías',
  CODEUDOR: 'Codeudor',
  OTRA: 'Otra garantía',
};

export const NIVELES = ['En construcción', 'Básico', 'Bueno', 'Muy bueno', 'Excelente'];
export const CORTES_NIVEL = [0, 30, 45, 60, 72, 100];
