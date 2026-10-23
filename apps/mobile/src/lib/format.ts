const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export function pesos(n: number): string {
  return `$${Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export function soloDigitos(s: string): number {
  return Number(s.replace(/\D/g, '')) || 0;
}

export function mesLargo(mes: string): string {
  return `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;
}

/** Últimos n meses cerrados en formato AAAA-MM, del más reciente al más antiguo. */
export function ultimosMeses(n: number, hoy = new Date()): string[] {
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export const NIVELES = ['En construcción', 'Básico', 'Bueno', 'Muy bueno', 'Excelente'];
export const CORTES_NIVEL = [0, 30, 45, 60, 72, 100];
