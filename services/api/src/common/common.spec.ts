import { decrypt, encrypt, lookupHash, maskPhone, normalizePhone } from './crypto';
import { comoMejorar, estadoTexto, recomendar, scoreVigente } from './vistas';

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
        { feature: 'on_time_ratio', points: -8, label: 'x' },
        { feature: 'avg_sales', points: 3, label: 'y' },
      ],
    } as never);
    expect(consejos).toEqual(['Paga las facturas de tu proveedor en la fecha acordada.']);
  });
});
