import { Injectable } from '@nestjs/common';
import { FuenteTipo, Negocio, Prisma, Solicitud, Variacion } from '@prisma/client';
import { ConectoresService } from '../conectores/conectores.service';
import { lastClosedMonth } from '../conectores/simulacion';
import { ExplicacionService } from '../explicacion/explicacion.service';
import { PrismaService } from '../prisma.service';
import { ScoreRequestV1, ScoreResponseV1, ScoringClient } from '../scoring/scoring.client';

const VENTANA_MESES = 12;

/** Orquesta conectores → validación → scoring → explicación (TND-030 a TND-053). */
@Injectable()
export class EvaluacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conectores: ConectoresService,
    private readonly scoring: ScoringClient,
    private readonly explicacion: ExplicacionService,
  ) {}

  async fuentesConsentidas(tenderoId: string): Promise<FuenteTipo[]> {
    const vigentes = await this.prisma.consentimiento.findMany({
      where: { tenderoId, revocadoEn: null },
      select: { fuente: true },
    });
    return [...new Set(vigentes.map((c) => c.fuente))];
  }

  /** Trae el historial de cada fuente autorizada y lo guarda. Solo fuentes con consentimiento vigente. */
  async recolectar(negocio: Negocio, fuentes: FuenteTipo[]): Promise<void> {
    const hasta = lastClosedMonth();
    for (const fuente of fuentes) {
      const conector = this.conectores.porFuente(fuente);
      if (!conector) continue;
      const registros = await conector.obtenerHistorial(negocio, VENTANA_MESES, hasta);
      for (const r of registros) {
        const data = {
          ventas: r.ventas ?? null,
          compras: r.compras ?? null,
          facturas: r.facturas ?? null,
          pagadasATiempo: r.pagadasATiempo ?? null,
          diasRetrasoPromedio: r.diasRetrasoPromedio ?? null,
        };
        await this.prisma.datoMensual.upsert({
          where: { negocioId_fuente_mes: { negocioId: negocio.id, fuente, mes: r.mes } },
          create: { negocioId: negocio.id, fuente, mes: r.mes, ...data },
          update: data,
        });
      }
    }
  }

  async construirRequest(
    negocio: Negocio,
    fuentes: FuenteTipo[],
    variaciones: Pick<Variacion, 'mes' | 'motivo'>[],
  ): Promise<ScoreRequestV1> {
    const permitidas = [...fuentes, FuenteTipo.MANUAL];
    const datos = await this.prisma.datoMensual.findMany({
      where: { negocioId: negocio.id, fuente: { in: permitidas } },
      orderBy: { mes: 'asc' },
    });
    const sourceMap = {
      DATAFONO: 'datafono',
      OPEN_FINANCE: 'open_finance',
      MANUAL: 'declarado',
    } as const;
    return {
      business: {
        business_age_months: negocio.antiguedadMeses ?? 0,
        business_type: negocio.tipo,
        declared_monthly_sales: negocio.ventasMensualesDeclaradas,
      },
      sales: datos
        .filter((d) => d.ventas !== null && d.fuente !== FuenteTipo.DISTRIBUIDOR)
        .map((d) => ({
          month: d.mes,
          amount: d.ventas!,
          source: sourceMap[d.fuente as keyof typeof sourceMap],
        })),
      distributor: datos
        .filter((d) => d.fuente === FuenteTipo.DISTRIBUIDOR)
        .map((d) => ({
          month: d.mes,
          purchases: d.compras ?? 0,
          invoices: d.facturas ?? 0,
          paid_on_time: d.pagadasATiempo ?? 0,
          avg_days_late: d.diasRetrasoPromedio ?? 0,
        })),
      adjustments: variaciones.map((v) => ({ month: v.mes, reason: v.motivo })),
    };
  }

  /**
   * Calcula y guarda un score para la solicitud. Devuelve el resultado del motor.
   * version 1 = original; version 2 = recalculado con las variaciones justificadas (TND-045).
   */
  async calcular(solicitud: Solicitud, negocio: Negocio, version: 1 | 2): Promise<ScoreResponseV1> {
    const fuentes = await this.fuentesConsentidas(solicitud.tenderoId);
    const variaciones =
      version === 2
        ? await this.prisma.variacion.findMany({ where: { solicitudId: solicitud.id } })
        : [];
    const req = await this.construirRequest(negocio, fuentes, variaciones);
    const res = await this.scoring.score(req, `${solicitud.id}:v${version}`);
    if (negocio.antiguedadMeses === null) {
      res.data_quality.sufficient = false;
      res.data_quality.issues.unshift({
        code: 'falta_antiguedad',
        message: 'Cuéntanos cuánto tiempo lleva abierto tu negocio.',
      });
      res.score = null;
    }
    if (res.score === null) return res;

    const { explicacion, fuente } = await this.explicacion.explicar(res);
    const data = {
      puntaje: res.score,
      probabilidadIncumplimiento: res.probability_default!,
      nivel: res.level!.name,
      modeloVersion: res.model_version,
      contribuciones: res.contributions as unknown as Prisma.InputJsonValue,
      calidadDatos: res.data_quality as unknown as Prisma.InputJsonValue,
      explicacion: explicacion as unknown as Prisma.InputJsonValue,
      explicacionFuente: fuente,
      conVariaciones: version === 2,
    };
    await this.prisma.score.upsert({
      where: { solicitudId_version: { solicitudId: solicitud.id, version } },
      create: { solicitudId: solicitud.id, version, ...data },
      update: data,
    });
    return res;
  }
}
