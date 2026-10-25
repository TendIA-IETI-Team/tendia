import Anthropic from '@anthropic-ai/sdk';
import type { ScoreResponse } from '../scoring/scoring.client';
import { ExplicacionService } from './explicacion.service';

export const scoreV2: ScoreResponse = {
  contract_version: '2',
  model_version: 'tendia-v2',
  request_id: 'r1',
  probability_default: 0.06,
  score: 680,
  band: { code: 'bueno', name: 'Bueno', min_score: 650, max_score: 1000 },
  segment: {
    code: 'tradicional',
    name: 'Tienda tradicional',
    description: 'Ventas modestas y una larga trayectoria en el barrio.',
    share_of_businesses: 0.32,
    median_monthly_sales: 1_400_000,
    median_age_months: 168,
    requested_credit: 0.14,
    obtained_credit: 0.13,
    used_loan_sharks: 0.05,
    n_sample: 6782,
  },
  components: [],
  contributions: [],
  top_positive: [
    {
      feature: 'pago_meses_al_dia',
      component: 'pagos',
      label: 'Meses en que le pagaste a tiempo a tu proveedor',
      value: 1,
      display_value: '100 %',
      points: 60,
    },
  ],
  top_negative: [
    {
      feature: 'sales_cv',
      component: 'negocio',
      label: 'Qué tan estables son tus ventas',
      value: 0.3,
      display_value: '30 %',
      points: -40,
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
    const r = await new ExplicacionService().explicar(scoreV2);
    expect(r.fuente).toBe('plantilla');
    expect(r.explicacion.resumen).toContain('680 de 1000');
    expect(r.explicacion.fortalezas[0]).toContain('pagaste a tiempo');
    expect(r.explicacion.aMejorar[0]).toContain('datáfono');
  });

  it('explica la falta de datos sin puntaje', async () => {
    const r = await new ExplicacionService().explicar({
      ...scoreV2,
      score: null,
      data_quality: {
        ...scoreV2.data_quality,
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
    const r = await withFakeClient(parse).explicar(scoreV2);
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
      expect((await withFakeClient(parse).explicar(scoreV2)).fuente).toBe('plantilla');
    }
  });

  it('cae a la plantilla ante rechazo o error de la API', async () => {
    const refusal = jest.fn().mockResolvedValue({ stop_reason: 'refusal', parsed_output: null });
    expect((await withFakeClient(refusal).explicar(scoreV2)).fuente).toBe('plantilla');
    const apiError = jest
      .fn()
      .mockRejectedValue(new Anthropic.APIError(529, undefined, 'overloaded', undefined));
    expect((await withFakeClient(apiError).explicar(scoreV2)).fuente).toBe('plantilla');
    const otherError = jest.fn().mockRejectedValue(new Error('timeout'));
    expect((await withFakeClient(otherError).explicar(scoreV2)).fuente).toBe('plantilla');
  });
});
