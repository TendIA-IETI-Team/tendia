import Anthropic from '@anthropic-ai/sdk';
import type { ScoreResponseV1 } from '../scoring/scoring.client';
import { ExplicacionService } from './explicacion.service';

const score: ScoreResponseV1 = {
  model_version: 'scorecard-v1',
  request_id: 'r1',
  probability_default: 0.06,
  score: 58,
  level: { index: 2, name: 'Bueno' },
  contributions: [],
  top_positive: [
    {
      feature: 'on_time_ratio',
      label: 'Pagos a tiempo a tus proveedores',
      value: 0.95,
      display_value: '95 %',
      points: 6,
    },
  ],
  top_negative: [
    {
      feature: 'sales_cv',
      label: 'Qué tan estables son tus ventas',
      value: 0.3,
      display_value: '30 %',
      points: -4,
    },
  ],
  adjusted_months: [],
  data_quality: { sufficient: true, months_of_sales: 12, months_of_distributor: 12, issues: [] },
};

function withFakeClient(parse: jest.Mock) {
  const svc = new ExplicacionService();
  Object.defineProperty(svc, 'client', { value: { messages: { parse } } });
  return svc;
}

describe('ExplicacionService', () => {
  it('usa la plantilla cuando no hay llave de Claude', async () => {
    const r = await new ExplicacionService().explicar(score);
    expect(r.fuente).toBe('plantilla');
    expect(r.explicacion.resumen).toContain('58 de 100');
    expect(r.explicacion.fortalezas[0]).toContain('Pagos a tiempo');
    expect(r.explicacion.aMejorar[0]).toContain('datáfono');
  });

  it('explica la falta de datos sin puntaje', async () => {
    const r = await new ExplicacionService().explicar({
      ...score,
      score: null,
      data_quality: {
        ...score.data_quality,
        sufficient: false,
        issues: [{ code: 'x', message: 'Faltan meses' }],
      },
    });
    expect(r.explicacion.aMejorar).toEqual(['Faltan meses']);
  });

  it('acepta la respuesta estructurada de Claude y solo envía datos no personales', async () => {
    const parse = jest.fn().mockResolvedValue({
      stop_reason: 'end_turn',
      parsed_output: {
        resumen: 'Tu negocio muestra buenos pagos.',
        fortalezas: ['Pagas a tiempo', 'a', 'b', 'c'],
        aMejorar: ['Registra todas tus ventas'],
      },
    });
    const r = await withFakeClient(parse).explicar(score);
    expect(r.fuente).toBe('ia');
    expect(r.explicacion.fortalezas).toHaveLength(3);
    const enviado = JSON.stringify(parse.mock.calls[0][0].messages);
    expect(enviado).not.toMatch(/celular|cedula|nombre/i);
    expect(parse.mock.calls[0][0].output_config.effort).toBe('low');
  });

  it('descarta respuestas que prometen crédito o hablan de DataCrédito', async () => {
    for (const resumen of ['Tu crédito está aprobado', 'Es como tu puntaje de DataCrédito']) {
      const parse = jest.fn().mockResolvedValue({
        stop_reason: 'end_turn',
        parsed_output: { resumen, fortalezas: [], aMejorar: [] },
      });
      expect((await withFakeClient(parse).explicar(score)).fuente).toBe('plantilla');
    }
  });

  it('cae a la plantilla ante rechazo o error de la API', async () => {
    const refusal = jest.fn().mockResolvedValue({ stop_reason: 'refusal', parsed_output: null });
    expect((await withFakeClient(refusal).explicar(score)).fuente).toBe('plantilla');
    const apiError = jest
      .fn()
      .mockRejectedValue(new Anthropic.APIError(529, undefined, 'overloaded', undefined));
    expect((await withFakeClient(apiError).explicar(score)).fuente).toBe('plantilla');
    const otherError = jest.fn().mockRejectedValue(new Error('timeout'));
    expect((await withFakeClient(otherError).explicar(score)).fuente).toBe('plantilla');
  });
});
