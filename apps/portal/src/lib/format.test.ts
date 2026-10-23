import { describe, expect, it } from 'vitest';
import { CORTES_NIVEL, ESTADOS, fecha, mesCorto, millones, NIVELES, pesos } from './format';

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

  it('los cortes de nivel coinciden con los del motor de scoring', () => {
    expect(NIVELES).toHaveLength(5);
    expect(CORTES_NIVEL).toEqual([0, 30, 45, 60, 72, 100]);
  });
});
