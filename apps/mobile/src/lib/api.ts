import { Platform } from 'react-native';
import { tokenStore } from './session';

/**
 * URL de la API. En un celular físico con Expo Go, define EXPO_PUBLIC_API_URL con la IP
 * del computador en la red local (ej. http://192.168.1.20:4000) en apps/mobile/.env.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000');

export type Estado =
  | 'BORRADOR'
  | 'DATOS_INCOMPLETOS'
  | 'SCORE_LISTO'
  | 'ENVIADA'
  | 'GARANTIA_SOLICITADA'
  | 'GARANTIA_ENVIADA'
  | 'APROBADA'
  | 'RECHAZADA';

export interface Contribucion {
  feature: string;
  component: 'pagos' | 'negocio';
  label: string;
  display_value: string;
  points: number;
}

/** Segmento del negocio con datos reales de EMICRON 2024 (DANE). */
export interface Segmento {
  code: string;
  name: string;
  description: string;
  median_monthly_sales: number;
  requested_credit: number;
  used_loan_sharks: number;
}

export interface ScoreView {
  version: number;
  puntaje: number;
  franja: 'bajo' | 'medio' | 'bueno';
  franjaNombre: string;
  segmento: Segmento | null;
  componentes: { name: 'pagos' | 'negocio'; label: string; points: number }[];
  conVariaciones: boolean;
  explicacion: { resumen: string; fortalezas: string[]; aMejorar: string[] };
  contribuciones: Contribucion[];
}

/** Tasa real que cobran las entidades a tiendas de Bogotá (Superfinanciera). No es una oferta. */
export interface Mercado {
  tasaEfectivaAnual: number;
  rango: { desde: number; hasta: number };
  creditos: number;
}

export interface AdjuntoInfo {
  id: string;
  nombre: string;
  tipo: string;
  tamano: number;
}

export interface Solicitud {
  id: string;
  monto: number;
  destino: string;
  plazoMeses: number;
  estado: Estado;
  estadoTexto: string;
  aliado: { id: string; nombre: string } | null;
  calidadDatos: { sufficient: boolean; issues: { code: string; message: string }[] } | null;
  score: ScoreView | null;
  scoreOriginal: ScoreView | null;
  variaciones: { mes: string; motivo: string; evidencia: AdjuntoInfo | null }[];
  documentoGarantia: AdjuntoInfo | null;
  /** La entidad decidió algo que el tendero aún no ha visto (T11-T13). */
  novedad: boolean;
  garantia: {
    tipo: string;
    notaAliado: string | null;
    respuesta: string | null;
    estado: string;
  } | null;
  notaDecision: string | null;
  comoMejorar: string[];
  satisfaccion: number | null;
  mercado: Mercado | null;
  aprobado: { monto: number; plazoMeses: number; tasaEfectivaAnual: number | null } | null;
}

export interface Registros {
  hoy: string;
  ventaHoy: number | null;
  ventasSemana: number;
  ventasMes: number;
  diasRegistradosMes: number;
  ventasRecientes: { fecha: string; monto: number; canal: string }[];
  fiadosPendientes: { id: string; cliente: string; monto: number; fecha: string }[];
  totalFiado: number;
}

export interface LecturaCuaderno {
  id: string;
  legible: boolean;
  motivo: string | null;
  registros: {
    fecha: string | null;
    ventas: number | null;
    fiados: { cliente: string; monto: number }[];
  }[];
}

export interface MensajeChat {
  rol: 'user' | 'assistant';
  contenido: string;
  creadoEn?: string;
}

export interface Fuente {
  fuente: 'DATAFONO' | 'DISTRIBUIDOR' | 'OPEN_FINANCE';
  proveedores: string[];
  simulado: boolean;
  titulo: string;
  descripcion: string;
  queUsamos: string;
}

export interface Consentimiento {
  id: string;
  fuente: Fuente['fuente'];
  proveedor: string;
  otorgadoEn: string;
  revocadoEn: string | null;
}

export interface Perfil {
  id: string;
  celular: string;
  nombre: string | null;
  negocio: {
    nombre: string | null;
    tipo: string;
    barrio: string | null;
    antiguedadMeses: number | null;
    ventasMensualesDeclaradas: number | null;
  } | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = await tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'No pudimos conectarnos. Revisa tu internet e inténtalo de nuevo.');
  }
  if (res.status === 401 && !path.startsWith('/auth')) onUnauthorized?.();
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = Array.isArray(body?.message) ? body.message[0] : body?.message;
    throw new ApiError(res.status, msg ?? 'Algo salió mal. Inténtalo de nuevo.');
  }
  return body as T;
}

/** La solicitud en curso (o la más reciente). */
export async function solicitudActual(): Promise<Solicitud | null> {
  const lista = await api<Solicitud[]>('/solicitudes');
  return lista[0] ?? null;
}
