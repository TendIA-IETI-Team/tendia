import { describe, expect, it } from 'vitest';
import { ESTADOS, fecha, FRANJAS, mesCorto, millones, pesos, porcentaje } from './format';

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
});
