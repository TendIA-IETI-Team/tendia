import { EstadoSolicitud, Politica, Score } from '@prisma/client';
import { CONSEJOS, Explicacion } from '../explicacion/explicacion.service';
import type { ContributionV1 } from '../scoring/scoring.client';

export const NIVELES = ['En construcción', 'Básico', 'Bueno', 'Muy bueno', 'Excelente'];

export function scoreView(s: Score) {
  const contribuciones = s.contribuciones as unknown as ContributionV1[];
  return {
    version: s.version,
    puntaje: s.puntaje,
    nivel: s.nivel,
    nivelIndice: Math.max(0, NIVELES.indexOf(s.nivel)),
    conVariaciones: s.conVariaciones,
    modeloVersion: s.modeloVersion,
    explicacion: s.explicacion as unknown as Explicacion,
    explicacionFuente: s.explicacionFuente,
    contribuciones: [...contribuciones].sort((a, b) => b.points - a.points),
    creadoEn: s.creadoEn,
  };
}

/** Texto del estado para el tendero: siempre dice quién revisa (T9) y nunca que TendIA presta. */
export function estadoTexto(estado: EstadoSolicitud, aliado?: string | null): string {
  const quien = aliado ?? 'la entidad';
  switch (estado) {
    case 'BORRADOR':
      return 'Falta autorizar los datos de tu negocio';
    case 'DATOS_INCOMPLETOS':
      return 'Necesitamos un poco más de información de tu negocio';
    case 'SCORE_LISTO':
      return 'Tu Puntaje TendIA está listo';
    case 'ENVIADA':
      return `${quien} está revisando tu solicitud`;
    case 'GARANTIA_SOLICITADA':
      return `${quien} te pide una garantía`;
    case 'GARANTIA_ENVIADA':
      return `${quien} está revisando tu garantía`;
    case 'APROBADA':
      return `${quien} aprobó tu crédito`;
    case 'RECHAZADA':
      return `${quien} no aprobó tu crédito esta vez`;
  }
}

export function comoMejorar(s: Score | undefined): string[] {
  if (!s) return [];
  const contribuciones = s.contribuciones as unknown as ContributionV1[];
  return contribuciones
    .filter((c) => c.points < 0)
    .sort((a, b) => a.points - b.points)
    .slice(0, 3)
    .map((c) => CONSEJOS[c.feature] ?? c.label);
}

export type Recomendacion = 'APROBAR' | 'PEDIR_GARANTIA' | 'RECHAZAR';

/** Recomendación según la política del aliado (TND-061). La decisión final es del analista. */
export function recomendar(
  puntaje: number,
  monto: number,
  p: Pick<Politica, 'scoreMinAprobar' | 'scoreMinConGarantia' | 'montoMaximo'>,
): { recomendacion: Recomendacion; motivo: string } {
  if (monto > p.montoMaximo) {
    return {
      recomendacion: puntaje >= p.scoreMinAprobar ? 'PEDIR_GARANTIA' : 'RECHAZAR',
      motivo: `El monto supera el máximo de la política ($${p.montoMaximo.toLocaleString('es-CO')}).`,
    };
  }
  if (puntaje >= p.scoreMinAprobar) {
    return { recomendacion: 'APROBAR', motivo: `Puntaje ≥ ${p.scoreMinAprobar}.` };
  }
  if (puntaje >= p.scoreMinConGarantia) {
    return {
      recomendacion: 'PEDIR_GARANTIA',
      motivo: `Puntaje entre ${p.scoreMinConGarantia} y ${p.scoreMinAprobar - 1}.`,
    };
  }
  return { recomendacion: 'RECHAZAR', motivo: `Puntaje menor a ${p.scoreMinConGarantia}.` };
}

/** Score vigente: el recalculado con variaciones si existe; si no, el original. */
export function scoreVigente<T extends { version: number }>(scores: T[]): T | undefined {
  return [...scores].sort((a, b) => b.version - a.version)[0];
}
