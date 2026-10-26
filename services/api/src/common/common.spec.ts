import { decrypt, encrypt, lookupHash, maskPhone, normalizePhone } from './crypto';
import {
  comoMejorar,
  estadoTexto,
  franjaDe,
  recomendar,
  scoreView,
  scoreVigente,
  tasaReferencia,
} from './vistas';

describe('crypto', () => {
  it('cifra y descifra sin dejar el dato en claro', () => {
    const c = encrypt('1012345678');
    expect(c).not.toContain('1012345678');
    expect(decrypt(c)).toBe('1012345678');
    expect(encrypt('x')).not.toBe(encrypt('x')); // IV aleatorio
  });

  it('el hash de búsqueda es determinístico', () => {
    expect(lookupHash('3001234567')).toBe(lookupHash('3001234567'));
  });

  it.each([
    ['300 123 4567', '3001234567'],
    ['+57 300-123-4567', '3001234567'],
    ['573001234567', '3001234567'],
    ['2001234567', null],
    ['300123', null],
  ])('normaliza %s', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it('enmascara el celular', () => {
    expect(maskPhone('3001234567')).toBe('300 ••• 67');
  });
});

describe('vistas', () => {
  const politica = { scoreMinAprobar: 60, scoreMinConGarantia: 45, montoMaximo: 5_000_000 };

  it.each([
    [70, 1_000_000, 'APROBAR'],
    [50, 1_000_000, 'PEDIR_GARANTIA'],
    [30, 1_000_000, 'RECHAZAR'],
    [70, 9_000_000, 'PEDIR_GARANTIA'],
    [50, 9_000_000, 'RECHAZAR'],
  ])('puntaje %i y monto %i → %s', (puntaje, monto, esperado) => {
    expect(recomendar(puntaje, monto, politica).recomendacion).toBe(esperado);
  });

  it('el texto del estado dice quién revisa y nunca que TendIA presta', () => {
    const estados = [
      'BORRADOR',
      'DATOS_INCOMPLETOS',
      'SCORE_LISTO',
      'ENVIADA',
      'GARANTIA_SOLICITADA',
      'GARANTIA_ENVIADA',
      'APROBADA',
      'RECHAZADA',
    ] as const;
    for (const e of estados) {
      expect(estadoTexto(e, 'Banco X')).not.toMatch(/TendIA (te )?presta/);
    }
    expect(estadoTexto('ENVIADA', 'Banco X')).toContain('Banco X');
    expect(estadoTexto('ENVIADA')).toContain('la entidad');
  });

  it('elige el score vigente y arma consejos de mejora', () => {
    expect(scoreVigente([{ version: 1 }, { version: 2 }])?.version).toBe(2);
    expect(comoMejorar(undefined)).toEqual([]);
    const consejos = comoMejorar({
      contribuciones: [
        { feature: 'pago_meses_al_dia', points: -80, label: 'x' },
        { feature: 'avg_sales', points: 30, label: 'y' },
      ],
    } as never);
    expect(consejos).toEqual([
      'Paga las facturas de tu proveedor en la fecha acordada, todos los meses.',
    ]);
  });

  it('franjas de la escala 0-1000 y tasa de referencia por franja', () => {
    expect(franjaDe(499)).toBe('bajo');
    expect(franjaDe(500)).toBe('medio');
    expect(franjaDe(650)).toBe('bueno');
    const tasas = {
      fuente: 'Superintendencia Financiera',
      filtro: 'x',
      desde: '2025-08-01',
      hasta: '2026-07-31',
      creditos: 100,
      tasa_efectiva_anual: { p25: 48.8, p50: 61.9, p75: 65.5 },
      con_garantia_fng: null,
      sin_garantia_fng: null,
      entidades: [],
    };
    expect(tasaReferencia('bueno', tasas).tasaEfectivaAnual).toBe(48.8);
    expect(tasaReferencia('medio', tasas).tasaEfectivaAnual).toBe(61.9);
    expect(tasaReferencia('bajo', tasas).rango).toEqual({ desde: 48.8, hasta: 65.5 });
  });

  it('las vistas de puntajes viejos (v1) calculan su franja', () => {
    const v = scoreView({
      version: 1,
      puntaje: 560,
      nivel: 'Bueno',
      contribuciones: [],
      explicacion: {},
      segmento: null,
      componentes: null,
    } as never);
    expect(v.franja).toBe('medio');
    expect(v.componentes).toEqual([]);
  });
});
