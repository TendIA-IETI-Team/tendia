import { createHmac } from 'node:crypto';
import { firmaTwilio, resumenLectura, twiml } from '../asistente/whatsapp.controller';
import { interpretar } from '../asistente/interprete';
import { diasDelMes, estimarVentasMes, ventasMensualesDesdeDiarias } from './agregacion';
import { limpiar } from './cuaderno.service';
import { formatoPesos, hoyBogota, parseMonto, sumarDias } from './montos';

describe('montos como los escribe un tendero', () => {
  it.each([
    ['350 mil', 350_000],
    ['vendí 350mil', 350_000],
    ['$1.200.000', 1_200_000],
    ['1 200 000', 1_200_000],
    ['2 millones', 2_000_000],
    ['1,5 millones', 1_500_000],
    ['un palo y medio', null],
    ['2 palos', 2_000_000],
    ['80k', 80_000],
    ['20 lucas', 20_000],
    ['15000', 15_000],
    ['hola', null],
  ])('%s → %s', (texto, esperado) => {
    expect(parseMonto(texto)).toBe(esperado);
  });

  it('formatea pesos y fechas de Bogotá', () => {
    expect(formatoPesos(1234567)).toBe('$1.234.567');
    expect(hoyBogota(new Date('2026-10-25T03:00:00Z'))).toBe('2026-10-24'); // 10 p. m. en Bogotá
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('agregación de ventas diarias', () => {
  it('estima el mes con el promedio diario cuando hay al menos 7 días', () => {
    const dias = Array.from({ length: 10 }, (_, i) => ({
      fecha: `2026-09-${String(i + 1).padStart(2, '0')}`,
      monto: 100_000,
    }));
    const pocos = [{ fecha: '2026-08-01', monto: 500_000 }];
    expect(ventasMensualesDesdeDiarias([...dias, ...pocos])).toEqual([
      { mes: '2026-09', ventas: 3_000_000, dias: 10 },
    ]);
    expect(diasDelMes('2026-02')).toBe(28);
  });

  it('estima la semana y el mes con un día normal y uno flojo (T5)', () => {
    expect(estimarVentasMes(150_000, 60_000, 2)).toEqual({ semana: 870_000, mes: 3_770_000 });
    expect(estimarVentasMes(100_000, 0, 9).semana).toBe(0); // máximo 7 días flojos
  });
});

describe('intérprete sin IA', () => {
  it.each([
    ['Hoy vendí 350 mil', { tipo: 'venta', monto: 350_000, dia: 'hoy' }],
    ['ayer vendí $420.000', { tipo: 'venta', monto: 420_000, dia: 'ayer' }],
    ['Le fié 20 mil a don Pedro', { tipo: 'fiado', monto: 20_000, cliente: 'Don Pedro' }],
    ['don pedro me pagó', { tipo: 'pago_fiado', cliente: 'Don Pedro' }],
    ['¿Cómo voy este mes?', { tipo: 'resumen' }],
    ['cómo va mi solicitud de crédito', { tipo: 'solicitud' }],
    ['buenas', { tipo: 'ayuda' }],
  ])('%s', (texto, esperado) => {
    expect(interpretar(texto)).toEqual(esperado);
  });
});

describe('lectura del cuaderno', () => {
  it('descarta fechas futuras, montos vacíos y fiados sin nombre', () => {
    const l = limpiar({
      legible: true,
      motivo: null,
      registros: [
        { fecha: '2026-01-05', ventas: 210000.4, fiados: [{ cliente: 'Rosa', monto: 5000 }] },
        { fecha: '2999-01-01', ventas: 1000, fiados: [] },
        { fecha: 'ayer', ventas: null, fiados: [{ cliente: ' ', monto: 100 }] },
      ],
    });
    expect(l.registros).toEqual([
      { fecha: '2026-01-05', ventas: 210000, fiados: [{ cliente: 'Rosa', monto: 5000 }] },
      { fecha: null, ventas: 1000, fiados: [] },
    ]);
  });

  it('resume lo leído para WhatsApp y pide confirmación', () => {
    const texto = resumenLectura({
      legible: true,
      motivo: null,
      registros: [
        { fecha: '2026-10-20', ventas: 180000, fiados: [{ cliente: 'Luis', monto: 8000 }] },
      ],
    });
    expect(texto).toContain('2026-10-20: ventas $180.000, fiados: Luis $8.000');
    expect(texto).toContain('SÍ');
    expect(resumenLectura({ legible: false, motivo: 'Está borrosa', registros: [] })).toContain(
      'Está borrosa',
    );
  });
});

describe('WhatsApp (Twilio)', () => {
  it('calcula la firma como Twilio: URL + parámetros ordenados por nombre, HMAC-SHA1 en base64', () => {
    // twilio.com/docs/usage/security: se ordenan los parámetros alfabéticamente y se concatenan
    // nombre+valor después de la URL completa.
    const firma = firmaTwilio(
      'https://api.tendia.co/whatsapp/webhook',
      { From: 'whatsapp:+573001234567', Body: 'hola' },
      'token',
    );
    const esperada = createHmac('sha1', 'token')
      .update('https://api.tendia.co/whatsapp/webhookBodyholaFromwhatsapp:+573001234567')
      .digest('base64');
    expect(firma).toBe(esperada);
  });

  it('responde TwiML escapando el texto', () => {
    expect(twiml('Hola <Pedro> & "Rosa"')).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Hola &#60;Pedro&#62; &#38; &#34;Rosa&#34;</Message></Response>',
    );
  });
});
