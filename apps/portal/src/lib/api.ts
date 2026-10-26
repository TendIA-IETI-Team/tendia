'use client';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type Estado =
  'ENVIADA' | 'GARANTIA_SOLICITADA' | 'GARANTIA_ENVIADA' | 'APROBADA' | 'RECHAZADA';

export type Recomendacion = 'APROBAR' | 'PEDIR_GARANTIA' | 'RECHAZAR';

export type Franja = 'bajo' | 'medio' | 'bueno';

export interface Contribucion {
  feature: string;
  component: 'pagos' | 'negocio';
  label: string;
  value: number;
  display_value: string;
  points: number;
}

/** Segmento del negocio con datos reales de EMICRON 2024 (DANE). */
export interface Segmento {
  code: string;
  name: string;
  description: string;
  share_of_businesses: number;
  median_monthly_sales: number;
  median_age_months: number;
  requested_credit: number;
  obtained_credit: number;
  used_loan_sharks: number;
  n_sample: number;
}

export interface Componente {
  name: 'pagos' | 'negocio';
  label: string;
  points: number;
  trained_on: string;
}

/** Tasa real del mercado (Superfinanciera) para la franja del tendero. */
export interface Mercado {
  tasaEfectivaAnual: number;
  rango: { desde: number; hasta: number };
  creditos: number;
  periodo: { desde: string; hasta: string };
  fuente: string;
  entidades?: { entidad: string; creditos: number; tasa_promedio_ponderada: number }[];
}

/** Indicadores descriptivos del negocio (TND-042): contextualizan, no entran al puntaje. */
export interface Indicadores {
  avg_ticket: number | null;
  repurchase_regularity: number | null;
  days_between_purchases: number | null;
  sales_per_peso_purchased: number | null;
  seasonality: number | null;
}

/** Evidencia de una variación (T8) o documento de la garantía (T10). */
export interface Adjunto {
  id: string;
  proposito: 'variacion' | 'garantia';
  mes: string | null;
  nombre: string;
  tipo: string;
  tamano: number;
}

export interface ScoreView {
  version: number;
  puntaje: number;
  franja: Franja;
  franjaNombre: string;
  segmento: Segmento | null;
  componentes: Componente[];
  conVariaciones: boolean;
  modeloVersion: string;
  explicacion: { resumen: string; fortalezas: string[]; aMejorar: string[] };
  explicacionFuente: 'ia' | 'plantilla';
  contribuciones: Contribucion[];
  indicadores: Indicadores | null;
}

export interface FilaBandeja {
  id: string;
  negocio: string;
  barrio: string | null;
  monto: number;
  plazoMeses: number;
  estado: Estado;
  enviadaEn: string;
  puntaje: number | null;
  franja: Franja | null;
  segmento: string | null;
  conVariaciones: boolean;
  principalesFactores: { label: string; points: number }[];
  recomendacion?: Recomendacion;
  motivo?: string;
}

export interface Bandeja {
  resumen: { total: number; pendientes: number; aprobadas: number; rechazadas: number };
  solicitudes: FilaBandeja[];
}

export interface Politica {
  scoreMinAprobar: number;
  scoreMinConGarantia: number;
  montoMaximo: number;
  version?: number;
}

export interface DetalleSolicitud {
  id: string;
  monto: number;
  destino: string;
  plazoMeses: number;
  estado: Estado;
  enviadaEn: string;
  notaDecision: string | null;
  aprobado: { monto: number; plazoMeses: number; tasaEfectivaAnual: number | null } | false;
  mercado: Mercado | null;
  negocio: {
    nombre: string | null;
    propietario: string | null;
    tipo: string;
    barrio: string | null;
    ciudad: string;
    antiguedadMeses: number | null;
    ventasMensualesDeclaradas: number | null;
  } | null;
  score: ScoreView | null;
  scoreOriginal: ScoreView | null;
  variaciones: { mes: string; motivo: string; evidencia: Adjunto | null }[];
  documentoGarantia: Adjunto | null;
  calidadDatos: { issues: { code: string; message: string }[] } | null;
  garantia: {
    tipo: string;
    notaAliado: string | null;
    respuesta: string | null;
    estado: string;
  } | null;
  datos: {
    fuente: string;
    mes: string;
    ventas: number | null;
    compras: number | null;
    facturas: number | null;
    pagadasATiempo: number | null;
    diasRetrasoPromedio: number | null;
    pagado: number | null;
    cupo: number | null;
  }[];
  politica: Politica;
  recomendacion?: Recomendacion;
  motivo?: string;
}

export interface Usuario {
  nombre: string;
  email: string;
  rol: Rol;
}

export type Rol = 'ANALISTA' | 'ADMIN_ALIADO' | 'ADMIN_TENDIA';

/** A dónde entra cada rol después del login. */
export const inicioDe = (rol: Rol) => (rol === 'ADMIN_TENDIA' ? '/admin' : '/bandeja');

const TOKEN = 'tendia.token';
const USER = 'tendia.usuario';

export const session = {
  get token() {
    return typeof window === 'undefined' ? null : sessionStorage.getItem(TOKEN);
  },
  /** JSON del usuario tal como está guardado (texto estable para useSyncExternalStore). */
  get usuarioGuardado(): string | null {
    if (typeof window === 'undefined' || !sessionStorage.getItem(TOKEN)) return null;
    return sessionStorage.getItem(USER);
  },
  get usuario(): Usuario | null {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(USER);
    return raw ? (JSON.parse(raw) as Usuario) : null;
  },
  save(token: string, usuario: Usuario) {
    sessionStorage.setItem(TOKEN, token);
    sessionStorage.setItem(USER, JSON.stringify(usuario));
  },
  clear() {
    sessionStorage.removeItem(TOKEN);
    sessionStorage.removeItem(USER);
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Abre un adjunto protegido (necesita el token, así que no sirve un enlace directo). */
export async function abrirArchivo(path: string): Promise<void> {
  const ventana = window.open('', '_blank');
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (!res.ok) {
    ventana?.close();
    throw new ApiError(res.status, 'No pudimos abrir el archivo.');
  }
  const url = URL.createObjectURL(await res.blob());
  if (ventana) ventana.location.href = url;
  else window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (session.token) headers.set('Authorization', `Bearer ${session.token}`);
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth')) {
    session.clear();
    window.location.href = '/login';
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const msg = Array.isArray(body?.message) ? body.message.join('. ') : body?.message;
    throw new ApiError(res.status, msg ?? 'Algo salió mal. Inténtalo de nuevo.');
  }
  return body as T;
}
