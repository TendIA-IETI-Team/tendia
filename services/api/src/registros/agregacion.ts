/**
 * Convierte las ventas del día en totales mensuales para el scoring (RF-04).
 * Un mes cuenta solo si tiene al menos MIN_DIAS registrados; el total se estima con el promedio
 * diario por los días del mes, porque el tendero no registra todos los días.
 */
export const MIN_DIAS = 7;

export function diasDelMes(mes: string): number {
  const [y, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function ventasMensualesDesdeDiarias(
  diarias: { fecha: string; monto: number }[],
): { mes: string; ventas: number; dias: number }[] {
  const porMes = new Map<string, number[]>();
  for (const d of diarias) {
    const mes = d.fecha.slice(0, 7);
    porMes.set(mes, [...(porMes.get(mes) ?? []), d.monto]);
  }
  return [...porMes.entries()]
    .filter(([, montos]) => montos.length >= MIN_DIAS)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, montos]) => {
      const promedio = montos.reduce((a, b) => a + b, 0) / montos.length;
      return {
        mes,
        ventas: Math.round((promedio * diasDelMes(mes)) / 1000) * 1000,
        dias: montos.length,
      };
    });
}

/**
 * Estimación de ventas del mes a partir de un día normal y uno flojo (T5, prueba con doña Gloria:
 * "yo sé cuánto hago en un día bueno y en un día malo, pero por semana tocaría la calculadora").
 */
export function estimarVentasMes(diaNormal: number, diaFlojo: number, diasFlojosPorSemana: number) {
  const flojos = Math.min(Math.max(diasFlojosPorSemana, 0), 7);
  const semana = diaNormal * (7 - flojos) + diaFlojo * flojos;
  return { semana, mes: Math.round((semana * 52) / 12 / 1000) * 1000 };
}
