import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { config } from '../config';
import { crearClienteClaude } from '../ia/claude';
import type { Contribution, ScoreResponse } from '../scoring/scoring.client';

export const ExplicacionSchema = z.object({
  resumen: z.string(),
  fortalezas: z.array(z.string()),
  aMejorar: z.array(z.string()),
});
export type Explicacion = z.infer<typeof ExplicacionSchema>;

/** Consejos concretos por variable: base de la plantilla y de "cómo mejorar" tras un rechazo. */
export const CONSEJOS: Record<string, string> = {
  pago_meses_al_dia: 'Paga las facturas de tu proveedor en la fecha acordada, todos los meses.',
  pago_max_meses_mora:
    'Evita atrasos largos con el proveedor: si te vas a demorar, abona algo y avísale.',
  pago_proporcion_pagada: 'Paga completo lo que te fía el proveedor antes de pedir más.',
  pago_uso_cupo: 'No uses todo el cupo que te da el proveedor: deja un margen libre.',
  pago_tendencia_compras: 'Compra al proveedor de forma pareja, según lo que vendes.',
  sales_cv:
    'Registra todas tus ventas en el datáfono o con el asistente para mostrar ventas más estables.',
  low_months_ratio: 'Si un mes fue malo por algo puntual, justifícalo en la app.',
  sales_trend: 'Mantén o sube tus ventas de los próximos meses: la tendencia cuenta.',
  avg_sales:
    'Registrar todas tus ventas, no solo las de tarjeta, muestra el tamaño real de tu tienda.',
  purchases_to_sales: 'Compra al proveedor de acuerdo con lo que vendes.',
  business_age_months:
    'Tu negocio gana historial con el tiempo: vuelve a intentarlo en unos meses.',
};

// La IA nunca puede prometer crédito ni sugerir que TendIA presta (hallazgo de la prueba con doña Gloria).
const FRASES_PROHIBIDAS = [
  /aprobad/i,
  /te prest/i,
  /garantizad/i,
  /datacr[ée]dito/i,
  /tendia (te )?presta/i,
];

const SYSTEM = `Eres el asistente de TendIA. Explicas a tenderos de barrio en Colombia su Puntaje TendIA (0 a 1000, en tres franjas: bajo, medio y bueno) con palabras sencillas, en español colombiano, tratando de "tú".
Reglas:
- TendIA no presta dinero: evalúa el negocio y le comparte el puntaje al aliado que el tendero elija. Nunca digas que el crédito está aprobado ni prometas un resultado.
- No es un puntaje de DataCrédito; no lo compares con centrales de riesgo.
- Usa solo los datos que recibes. No inventes cifras.
- Evita palabras técnicas como "open finance", "POS", "variable", "modelo" o "probabilidad".
- "resumen": máximo 2 frases. "fortalezas" y "aMejorar": máximo 3 frases cortas cada una, concretas y accionables.`;

@Injectable()
export class ExplicacionService {
  private readonly logger = new Logger(ExplicacionService.name);
  private readonly client = crearClienteClaude(20_000);

  /** Explicación en lenguaje simple (TND-053). Si la IA falla o no está configurada, usa la plantilla. */
  async explicar(
    score: ScoreResponse,
  ): Promise<{ explicacion: Explicacion; fuente: 'ia' | 'plantilla' }> {
    const plantilla = this.plantilla(score);
    if (!this.client || score.score === null)
      return { explicacion: plantilla, fuente: 'plantilla' };

    // Solo viajan el puntaje y las contribuciones: nunca datos que identifiquen al tendero.
    const datos = {
      puntaje: score.score,
      franja: score.band?.name,
      tipo_de_negocio: score.segment?.name,
      ayudan: score.top_positive.map(pick),
      restan: score.top_negative.map(pick),
      meses_justificados: score.adjusted_months,
    };
    try {
      const response = await this.client.messages.parse({
        model: config().ANTHROPIC_MODEL,
        max_tokens: 2000,
        system: SYSTEM,
        output_config: { effort: 'low', format: zodOutputFormat(ExplicacionSchema) },
        messages: [
          {
            role: 'user',
            content: `Explica este resultado al tendero:\n${JSON.stringify(datos)}`,
          },
        ],
      });
      const out = response.parsed_output;
      if (response.stop_reason === 'refusal' || !out || !this.esSegura(out)) {
        this.logger.warn('Explicación de IA descartada; se usa la plantilla');
        return { explicacion: plantilla, fuente: 'plantilla' };
      }
      return {
        explicacion: {
          resumen: out.resumen,
          fortalezas: out.fortalezas.slice(0, 3),
          aMejorar: out.aMejorar.slice(0, 3),
        },
        fuente: 'ia',
      };
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        this.logger.warn(`Claude API ${err.status ?? 'sin estado'}: se usa la plantilla`);
      } else {
        this.logger.warn(`Error generando explicación: ${(err as Error).message}`);
      }
      return { explicacion: plantilla, fuente: 'plantilla' };
    }
  }

  esSegura(e: Explicacion): boolean {
    const texto = [e.resumen, ...e.fortalezas, ...e.aMejorar].join(' ');
    return !FRASES_PROHIBIDAS.some((re) => re.test(texto)) && e.resumen.length <= 600;
  }

  plantilla(score: ScoreResponse): Explicacion {
    if (score.score === null) {
      return {
        resumen:
          'Todavía no tenemos suficiente información de tu negocio para calcular tu Puntaje TendIA.',
        fortalezas: [],
        aMejorar: score.data_quality.issues.map((i) => i.message),
      };
    }
    return {
      resumen: `Tu Puntaje TendIA es ${score.score} de 1000, franja ${score.band?.name.toLowerCase()}. Lo calculamos con las ventas de tu negocio y cómo le pagas a tu proveedor, no con tu historial en bancos.`,
      fortalezas: score.top_positive.map((c) => `${c.label} (${c.display_value}) te ayuda.`),
      aMejorar: score.top_negative.map((c) => CONSEJOS[c.feature] ?? c.label),
    };
  }
}

function pick(c: Contribution) {
  return { que: c.label, valor: c.display_value, puntos: Math.round(c.points) };
}
