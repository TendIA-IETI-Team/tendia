import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoSolicitud, Prisma } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import {
  comoMejorar,
  estadoTexto,
  scoreView,
  scoreVigente,
  tasaReferencia,
} from '../common/vistas';
import { PrismaService } from '../prisma.service';
import { Referencias, ScoringClient } from '../scoring/scoring.client';
import { CrearSolicitudDto, RespuestaGarantiaDto, SatisfaccionDto, VariacionDto } from './dto';
import { EvaluacionService } from './evaluacion.service';
import { TenderoService } from './tendero.service';

const incluir = {
  aliado: { select: { id: true, nombre: true } },
  scores: true,
  variaciones: { orderBy: { mes: 'asc' } },
  garantia: true,
} satisfies Prisma.SolicitudInclude;

type SolicitudCompleta = Prisma.SolicitudGetPayload<{ include: typeof incluir }>;

const EDITABLES: EstadoSolicitud[] = ['BORRADOR', 'DATOS_INCOMPLETOS', 'SCORE_LISTO'];

@Injectable()
export class SolicitudesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluacion: EvaluacionService,
    private readonly tendero: TenderoService,
    private readonly audit: AuditService,
    private readonly scoring: ScoringClient,
  ) {}

  /** T1: solicitar crédito con monto y destino (TND-050). */
  async crear(tenderoId: string, dto: CrearSolicitudDto) {
    const abierta = await this.prisma.solicitud.findFirst({
      where: {
        tenderoId,
        estado: { in: [...EDITABLES, 'ENVIADA', 'GARANTIA_SOLICITADA', 'GARANTIA_ENVIADA'] },
      },
    });
    if (abierta) {
      throw new ConflictException(
        'Ya tienes una solicitud en curso. Termínala antes de crear otra.',
      );
    }
    const s = await this.prisma.solicitud.create({ data: { tenderoId, ...dto }, include: incluir });
    return this.vista(s);
  }

  async listar(tenderoId: string) {
    const lista = await this.prisma.solicitud.findMany({
      where: { tenderoId },
      include: incluir,
      orderBy: { creadaEn: 'desc' },
    });
    const tasas = await this.tasas();
    return lista.map((s) => this.vista(s, tasas));
  }

  async detalle(tenderoId: string, id: string) {
    const [s, tasas] = await Promise.all([this.cargar(tenderoId, id), this.tasas()]);
    return this.vista(s, tasas);
  }

  /**
   * T4/T6: trae los datos autorizados, valida suficiencia y calcula el score.
   * Si faltan datos, la solicitud queda en DATOS_INCOMPLETOS y la app muestra T5.
   */
  async evaluar(tenderoId: string, id: string) {
    const s = await this.cargar(tenderoId, id);
    this.exigirEstado(s, EDITABLES);
    const negocio = await this.tendero.negocioDe(tenderoId);
    const fuentes = await this.evaluacion.fuentesConsentidas(tenderoId);
    await this.evaluacion.recolectar(negocio, fuentes);

    // Una nueva evaluación reemplaza las anteriores (los datos pudieron cambiar).
    await this.prisma.$transaction([
      this.prisma.score.deleteMany({ where: { solicitudId: id } }),
      this.prisma.variacion.deleteMany({ where: { solicitudId: id } }),
    ]);
    const res = await this.evaluacion.calcular(s, negocio, 1);
    const estado: EstadoSolicitud = res.score === null ? 'DATOS_INCOMPLETOS' : 'SCORE_LISTO';
    await this.prisma.solicitud.update({
      where: { id },
      data: { estado, calidadDatos: res.data_quality as unknown as Prisma.InputJsonValue },
    });
    return this.detalle(tenderoId, id);
  }

  /** T8: justificar una variación y recalcular antes de enviar al aliado (TND-045, TND-054). */
  async justificar(tenderoId: string, id: string, dto: VariacionDto) {
    const s = await this.cargar(tenderoId, id);
    this.exigirEstado(s, ['SCORE_LISTO']);
    await this.prisma.variacion.upsert({
      where: { solicitudId_mes: { solicitudId: id, mes: dto.mes } },
      create: { solicitudId: id, ...dto },
      update: { motivo: dto.motivo },
    });
    const negocio = await this.tendero.negocioDe(tenderoId);
    await this.evaluacion.calcular(s, negocio, 2);
    return this.detalle(tenderoId, id);
  }

  async quitarVariacion(tenderoId: string, id: string, mes: string) {
    const s = await this.cargar(tenderoId, id);
    this.exigirEstado(s, ['SCORE_LISTO']);
    await this.prisma.variacion.deleteMany({ where: { solicitudId: id, mes } });
    const quedan = await this.prisma.variacion.count({ where: { solicitudId: id } });
    if (quedan === 0) {
      await this.prisma.score.deleteMany({ where: { solicitudId: id, version: 2 } });
    } else {
      await this.evaluacion.calcular(s, await this.tendero.negocioDe(tenderoId), 2);
    }
    return this.detalle(tenderoId, id);
  }

  /** T9: enviar al aliado elegido; desde aquí el tendero ve quién revisa (TND-055). */
  async enviar(tenderoId: string, id: string, aliadoId: string) {
    const s = await this.cargar(tenderoId, id);
    this.exigirEstado(s, ['SCORE_LISTO']);
    const aliado = await this.prisma.aliado.findUnique({ where: { id: aliadoId } });
    if (!aliado) throw new NotFoundException('No encontramos esa entidad');
    await this.prisma.solicitud.update({
      where: { id },
      data: { estado: 'ENVIADA', aliadoId, enviadaEn: new Date() },
    });
    await this.audit.log({
      actorTipo: 'TENDERO',
      actorId: tenderoId,
      aliadoId,
      accion: 'compartir_score',
      entidad: 'Solicitud',
      entidadId: id,
    });
    return this.detalle(tenderoId, id);
  }

  /** T10: responder la solicitud de garantía (TND-056). */
  async responderGarantia(tenderoId: string, id: string, dto: RespuestaGarantiaDto) {
    const s = await this.cargar(tenderoId, id);
    this.exigirEstado(s, ['GARANTIA_SOLICITADA']);
    await this.prisma.$transaction([
      this.prisma.garantia.update({
        where: { solicitudId: id },
        data: { respuesta: dto.respuesta, estado: 'ENVIADA' },
      }),
      this.prisma.solicitud.update({ where: { id }, data: { estado: 'GARANTIA_ENVIADA' } }),
    ]);
    return this.detalle(tenderoId, id);
  }

  /** Pregunta de satisfacción al terminar (TND-081). */
  async satisfaccion(tenderoId: string, id: string, dto: SatisfaccionDto) {
    const s = await this.cargar(tenderoId, id);
    this.exigirEstado(s, ['APROBADA', 'RECHAZADA']);
    await this.prisma.solicitud.update({
      where: { id },
      data: { satisfaccion: dto.calificacion, comentarioSatisfaccion: dto.comentario ?? null },
    });
    return this.detalle(tenderoId, id);
  }

  async cancelar(tenderoId: string, id: string) {
    const s = await this.cargar(tenderoId, id);
    this.exigirEstado(s, EDITABLES);
    await this.prisma.solicitud.delete({ where: { id } });
    return { eliminada: true };
  }

  // --- utilidades --------------------------------------------------------
  private async cargar(tenderoId: string, id: string): Promise<SolicitudCompleta> {
    // Aislamiento: el tendero solo ve sus propias solicitudes.
    const s = await this.prisma.solicitud.findFirst({ where: { id, tenderoId }, include: incluir });
    if (!s) throw new NotFoundException('No encontramos esa solicitud');
    return s;
  }

  private exigirEstado(s: { estado: EstadoSolicitud }, permitidos: EstadoSolicitud[]) {
    if (!permitidos.includes(s.estado)) {
      throw new ConflictException(
        `La solicitud está en estado ${s.estado} y no permite esta acción`,
      );
    }
  }

  private tasas(): Promise<Referencias['tasas'] | null> {
    return this.scoring
      .referencias()
      .then((r) => r.tasas)
      .catch(() => null);
  }

  vista(s: SolicitudCompleta, tasas: Referencias['tasas'] | null = null) {
    const original = s.scores.find((x) => x.version === 1);
    const vigente = scoreVigente(s.scores);
    const view = vigente ? scoreView(vigente) : null;
    return {
      id: s.id,
      monto: s.monto,
      destino: s.destino,
      plazoMeses: s.plazoMeses,
      estado: s.estado,
      estadoTexto: estadoTexto(s.estado, s.aliado?.nombre),
      aliado: s.aliado,
      creadaEn: s.creadaEn,
      enviadaEn: s.enviadaEn,
      calidadDatos: s.calidadDatos,
      score: view,
      scoreOriginal: original && vigente && vigente.version !== 1 ? scoreView(original) : null,
      // Tasa de referencia real del mercado para su franja (Superfinanciera). No es una oferta.
      mercado: view && tasas ? tasaReferencia(view.franja, tasas) : null,
      // T11-T13: condiciones con que la entidad aprobó.
      aprobado:
        s.estado === 'APROBADA'
          ? {
              monto: s.montoAprobado ?? s.monto,
              plazoMeses: s.plazoAprobado ?? s.plazoMeses,
              tasaEfectivaAnual: s.tasaAprobada,
            }
          : null,
      variaciones: s.variaciones.map((v) => ({ mes: v.mes, motivo: v.motivo })),
      garantia: s.garantia && {
        tipo: s.garantia.tipo,
        notaAliado: s.garantia.notaAliado,
        respuesta: s.garantia.respuesta,
        estado: s.garantia.estado,
      },
      notaDecision: s.notaDecision,
      comoMejorar: s.estado === 'RECHAZADA' ? comoMejorar(vigente) : [],
      satisfaccion: s.satisfaccion,
    };
  }
}
