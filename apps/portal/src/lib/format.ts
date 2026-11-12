const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function pesos(n: number): string {
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}

/** Número con coma decimal, como se escribe en Colombia: 52.5 → "52,5". */
export function decimal(n: number, maximo = 1): string {
  return n.toLocaleString('es-CO', { maximumFractionDigits: maximo });
}

/** "Franja" es femenino: "franja media", no "franja medio". */
export function franjaFemenino(nombre: string): string {
  return (
    { bajo: 'baja', medio: 'media', bueno: 'buena' }[nombre.toLowerCase()] ?? nombre.toLowerCase()
  );
}

/** Puntos con signo; los valores que redondean a cero se muestran como 0. */
export function puntos(p: number, decimales = 1): string {
  const r = Number(p.toFixed(decimales));
  const texto = Math.abs(r).toLocaleString('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
  if (r === 0) return texto;
  return `${r > 0 ? '+' : '-'}${texto}`;
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

export function porcentaje(x: number): string {
  return `${Math.round(x * 100)} %`;
}

export const FRANJAS = [
  { valor: 'bajo', texto: 'Bajo (0-499)' },
  { valor: 'medio', texto: 'Medio (500-649)' },
  { valor: 'bueno', texto: 'Bueno (650-1000)' },
] as const;

/** Acciones de la bitácora en palabras: el código interno (snake_case) queda como respaldo. */
const ACCIONES: Record<string, string> = {
  aceptar_invitacion: 'Aceptó la invitación',
  actualizar_politica: 'Actualizó la política',
  autorizar_fuente: 'Autorizó una fuente de datos',
  bloqueo_por_intentos: 'Bloqueo por intentos fallidos',
  compartir_score: 'Compartió su puntaje',
  confirmar_cuaderno: 'Confirmó la lectura del cuaderno',
  consulta_score_api: 'Consultó un puntaje por API',
  consultar_bitacora: 'Consultó la bitácora',
  crear_aliado: 'Dio de alta un aliado',
  crear_api_key: 'Creó una llave de API',
  decision_aprobar: 'Aprobó el crédito',
  decision_pedir_garantia: 'Pidió una garantía',
  decision_rechazar: 'Rechazó el crédito',
  garantia_aceptada: 'Aceptó la garantía',
  garantia_rechazada: 'Rechazó la garantía',
  ingreso: 'Ingresó',
  invitar_usuario: 'Invitó a una persona',
  justificar_variacion: 'Justificó un mes',
  registro: 'Se registró',
  reinicio_mfa: 'Reinició la verificación en dos pasos',
  responder_garantia: 'Respondió la garantía',
  revocar_api_key: 'Revocó una llave de API',
  revocar_fuente: 'Quitó una autorización',
  ver_adjunto: 'Vio un documento adjunto',
  ver_solicitud: 'Vio la solicitud',
};

export function accion(codigo: string): string {
  return ACCIONES[codigo] ?? codigo.replaceAll('_', ' ');
}
