import type { Solicitud } from './api';

/** A dónde lleva "Continuar" según el estado de la solicitud. */
export function rutaPara(
  s: Pick<Solicitud, 'estado'>,
): '/autorizar' | '/completar' | '/puntaje' | '/seguimiento' {
  switch (s.estado) {
    case 'BORRADOR':
      return '/autorizar';
    case 'DATOS_INCOMPLETOS':
      return '/completar';
    case 'SCORE_LISTO':
      return '/puntaje';
    default:
      return '/seguimiento';
  }
}
