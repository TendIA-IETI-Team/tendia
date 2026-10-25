import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { config } from '../config';

/** Contrato v2 del servicio de scoring (ver services/scoring/tendia_scoring/schemas.py). */
export interface ScoreRequest {
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
    paid_amount?: number | null;
    credit_limit?: number | null;
  }[];
  adjustments: { month: string; reason: string }[];
}

export interface Contribution {
  feature: string;
  component: 'pagos' | 'negocio';
  label: string;
  value: number;
  display_value: string;
  points: number;
}

export interface DataQuality {
  sufficient: boolean;
  months_of_sales: number;
  months_of_distributor: number;
  issues: { code: string; message: string }[];
}

export type FranjaCodigo = 'bajo' | 'medio' | 'bueno';

export interface Band {
  code: FranjaCodigo;
  name: string;
  min_score: number;
  max_score: number;
}

/** Segmento del negocio con datos reales de EMICRON 2024 (DANE). */
export interface Segment {
  code: string;
  name: string;
  description: string;
  share_of_businesses: number;
  median_monthly_sales: number;
  median_age_months: number;
  requested_credit: number;
  obtained_credit: number;
  used_loan_sharks: number;
  n_sample: number;
}

export interface ComponentScore {
  name: 'pagos' | 'negocio';
  label: string;
  points: number;
  trained_on: string;
}

export interface ScoreResponse {
  contract_version: string;
  model_version: string;
  request_id: string;
  probability_default: number | null;
  score: number | null;
  band: Band | null;
  segment: Segment | null;
  components: ComponentScore[];
  contributions: Contribution[];
  top_positive: Contribution[];
  top_negative: Contribution[];
  adjusted_months: string[];
  data_quality: DataQuality;
}

/** Datos reales de mercado que publica el servicio de scoring (EMICRON y Superfinanciera). */
export interface Referencias {
  emicron: Record<string, unknown>;
  tasas: {
    fuente: string;
    filtro: string;
    desde: string;
    hasta: string;
    creditos: number;
    tasa_efectiva_anual: { p25: number; p50: number; p75: number };
    con_garantia_fng: { p25: number; p50: number; p75: number } | null;
    sin_garantia_fng: { p25: number; p50: number; p75: number } | null;
    entidades: { entidad: string; creditos: number; tasa_promedio_ponderada: number }[];
  };
}

@Injectable()
export class ScoringClient {
  private readonly logger = new Logger(ScoringClient.name);

  async score(body: ScoreRequest, requestId?: string): Promise<ScoreResponse> {
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
    return (await res.json()) as ScoreResponse;
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

  private referenciasCache?: { valor: Referencias; hasta: number };

  /** Referencias de mercado reales; se guardan en memoria una hora (cambian con cada reentrenamiento). */
  async referencias(): Promise<Referencias> {
    if (this.referenciasCache && this.referenciasCache.hasta > Date.now()) {
      return this.referenciasCache.valor;
    }
    try {
      const res = await fetch(`${config().SCORING_URL}/referencias`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const valor = (await res.json()) as Referencias;
      this.referenciasCache = { valor, hasta: Date.now() + 3_600_000 };
      return valor;
    } catch (err) {
      this.logger.error(`Referencias no disponibles: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Las referencias de mercado no están disponibles');
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
