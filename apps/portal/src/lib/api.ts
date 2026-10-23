'use client';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type Estado =
  | 'ENVIADA'
  | 'GARANTIA_SOLICITADA'
  | 'GARANTIA_ENVIADA'
  | 'APROBADA'
  | 'RECHAZADA';

export type Recomendacion = 'APROBAR' | 'PEDIR_GARANTIA' | 'RECHAZAR';

export interface Contribucion {
  feature: string;
  label: string;
  value: number;
  display_value: string;
  points: number;
}

export interface ScoreView {
  version: number;
  puntaje: number;
  nivel: string;
  nivelIndice: number;
  conVariaciones: boolean;
  modeloVersion: string;
  explicacion: { resumen: string; fortalezas: string[]; aMejorar: string[] };
  explicacionFuente: 'ia' | 'plantilla';
  contribuciones: Contribucion[];
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
  nivel: string | null;
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
}

export interface DetalleSolicitud {
  id: string;
  monto: number;
  destino: string;
  plazoMeses: number;
  estado: Estado;
  enviadaEn: string;
  notaDecision: string | null;
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
  variaciones: { mes: string; motivo: string }[];
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
  }[];
  politica: Politica;
  recomendacion?: Recomendacion;
  motivo?: string;
}

export interface Usuario {
  nombre: string;
  email: string;
  rol: 'ANALISTA' | 'ADMIN_ALIADO';
}

const TOKEN = 'tendia.token';
const USER = 'tendia.usuario';

export const session = {
  get token() {
    return typeof window === 'undefined' ? null : sessionStorage.getItem(TOKEN);
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
