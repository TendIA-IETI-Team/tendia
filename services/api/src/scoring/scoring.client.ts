import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { config } from '../config';

/** Contrato v1 del servicio de scoring (ver services/scoring/tendia_scoring/schemas.py). */
export interface ScoreRequestV1 {
  business: {
    business_age_months: number;
    business_type?: string;
    declared_monthly_sales?: number | null;
  };
  sales: { month: string; amount: number; source: 'datafono' | 'declarado' | 'open_finance' }[];
  distributor: {
    month: string;
    purchases: number;
    invoices: number;
    paid_on_time: number;
    avg_days_late: number;
  }[];
  adjustments: { month: string; reason: string }[];
}

export interface ContributionV1 {
  feature: string;
  label: string;
  value: number;
  display_value: string;
  points: number;
}

export interface DataQualityV1 {
  sufficient: boolean;
  months_of_sales: number;
  months_of_distributor: number;
  issues: { code: string; message: string }[];
}

export interface ScoreResponseV1 {
  model_version: string;
  request_id: string;
  probability_default: number | null;
  score: number | null;
  level: { index: number; name: string } | null;
  contributions: ContributionV1[];
  top_positive: ContributionV1[];
  top_negative: ContributionV1[];
  adjusted_months: string[];
  data_quality: DataQualityV1;
}

@Injectable()
export class ScoringClient {
  private readonly logger = new Logger(ScoringClient.name);

  async score(body: ScoreRequestV1, requestId?: string): Promise<ScoreResponseV1> {
    let res: Response;
    try {
      res = await fetch(`${config().SCORING_URL}/score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(requestId ? { 'x-request-id': requestId } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      this.logger.error(`Scoring no disponible: ${(err as Error).message}`);
      throw new ServiceUnavailableException('El motor de scoring no está disponible');
    }
    if (!res.ok) {
      this.logger.error(`Scoring respondió ${res.status}`);
      throw new ServiceUnavailableException('El motor de scoring no pudo calcular el puntaje');
    }
    return (await res.json()) as ScoreResponseV1;
  }

  /** Para la API pública: devuelve también los errores de validación del motor (422). */
  async scoreRaw(body: unknown, requestId: string): Promise<{ status: number; body: unknown }> {
    try {
      const res = await fetch(`${config().SCORING_URL}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-request-id': requestId },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      return { status: res.status, body: await res.json() };
    } catch (err) {
      this.logger.error(`Scoring no disponible: ${(err as Error).message}`);
      throw new ServiceUnavailableException('El motor de scoring no está disponible');
    }
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${config().SCORING_URL}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
