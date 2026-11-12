import { describe, expect, it } from 'vitest';
import {
  accion,
  decimal,
  ESTADOS,
  fecha,
  FRANJAS,
  franjaFemenino,
  mesCorto,
  millones,
  pesos,
  porcentaje,
  puntos,
} from './format';

describe('format', () => {
  it('formatea pesos colombianos', () => {
    expect(pesos(3000000)).toBe('$3.000.000');
    expect(millones(8450000)).toBe('8,5 M');
  });

  it('formatea meses y fechas', () => {
    expect(mesCorto('2026-01')).toBe('ene 26');
    expect(fecha(null)).toBe('—');
    expect(fecha('2026-10-23T15:00:00Z')).toMatch(/oct 2026/);
  });

  it('tiene un texto para cada estado visible por el aliado', () => {
    for (const e of [
      'ENVIADA',
      'GARANTIA_SOLICITADA',
      'GARANTIA_ENVIADA',
      'APROBADA',
      'RECHAZADA',
    ]) {
      expect(ESTADOS[e].texto).toBeTruthy();
    }
  });

  it('las franjas coinciden con las del motor de scoring (0-1000)', () => {
    expect(FRANJAS.map((f) => f.valor)).toEqual(['bajo', 'medio', 'bueno']);
    expect(porcentaje(0.051)).toBe('5 %');
  });

  it('escribe decimales con coma y la franja en femenino', () => {
    expect(decimal(52.5)).toBe('52,5');
    expect(decimal(10.83)).toBe('10,8');
    expect(puntos(20.44)).toBe('+20,4');
    expect(puntos(-66.9)).toBe('-66,9');
    expect(puntos(0.02)).toBe('0,0');
    expect(franjaFemenino('Medio')).toBe('media');
    expect(franjaFemenino('bueno')).toBe('buena');
  });

  it('nombra las acciones de la bitácora en palabras', () => {
    expect(accion('garantia_aceptada')).toBe('Aceptó la garantía');
    expect(accion('decision_pedir_garantia')).toBe('Pidió una garantía');
    expect(accion('accion_nueva')).toBe('accion nueva');
  });
});
