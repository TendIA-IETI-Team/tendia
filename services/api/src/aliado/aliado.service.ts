import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoSolicitud, Prisma } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import type { Actor } from '../common/auth';
import { randomToken, sha256 } from '../common/crypto';
import { recomendar, scoreView, scoreVigente } from '../common/vistas';
import { PrismaService } from '../prisma.service';
import { CrearApiKeyDto, DecisionDto, EvaluarGarantiaDto, PoliticaDto } from './dto';

/** Estados que el aliado puede ver: solo lo que el tendero decidió compartir. */
const VISIBLES: EstadoSolicitud[] = [
  'ENVIADA',
  'GARANTIA_SOLICITADA',
  'GARANTIA_ENVIADA',
  'APROBADA',
  'RECHAZADA',
];

const POLITICA_POR_DEFECTO = {
  scoreMinAprobar: 60,
  scoreMinConGarantia: 45,
  montoMaximo: 5_000_000,
};

@Injectable()
export class AliadoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async politica(aliadoId: string) {
    return (
      (await this.prisma.politica.findUnique({ where: { aliadoId } })) ?? {
        aliadoId,
        ...POLITICA_POR_DEFECTO,
      }
    );
  }

  /** A1: bandeja con score explicado y recomendación según la política (TND-060). */
  async bandeja(actor: Actor, estado?: EstadoSolicitud) {
    const aliadoId = actor.aliadoId!;
    const politica = await this.politica(aliadoId);
    const lista = await this.prisma.solicitud.findMany({
      // Aislamiento por aliado (TND-012): el filtro sale del token, nunca del cliente.
      where: { aliadoId, estado: estado ? estado : { in: VISIBLES } },
      include: { scores: true, tendero: { include: { negocio: true } }, variaciones: true },
      orderBy: { enviadaEn: 'desc' },
    });
    const pendientes = lista.filter(
      (s) => s.estado === 'ENVIADA' || s.estado === 'GARANTIA_ENVIADA',
    );
    return {
      resumen: {
        total: lista.length,
        pendientes: pendientes.length,
        aprobadas: lista.filter((s) => s.estado === 'APROBADA').length,
        rechazadas: lista.filter((s) => s.estado === 'RECHAZADA').length,
      },
      solicitudes: lista.map((s) => {
        const vigente = scoreVigente(s.scores);
        const view = vigente && scoreView(vigente);
        return {
          id: s.id,
          negocio: s.tendero.negocio?.nombre ?? 'Negocio sin nombre',
          barrio: s.tendero.negocio?.barrio,
          monto: s.monto,
          plazoMeses: s.plazoMeses,
          estado: s.estado,
          enviadaEn: s.enviadaEn,
          puntaje: view?.puntaje ?? null,
          nivel: view?.nivel ?? null,
          conVariaciones: s.variaciones.length > 0,
          principalesFactores: view
            ? [
                // El factor que más suma y el que más resta, si mueven al menos medio punto.
                ...view.contribuciones.filter((c) => c.points >= 0.5).slice(0, 1),
                ...view.contribuciones.filter((c) => c.points <= -0.5).slice(-1),
              ].map((c) => ({ label: c.label, points: c.points }))
            : [],
          ...(view ? recomendar(view.puntaje, s.monto, politica) : {}),
        };
      }),
    };
  }

  async detalle(actor: Actor, id: string) {
    const s = await this.cargar(actor, id);
    const politica = await this.politica(actor.aliadoId!);
    const original = s.scores.find((x) => x.version === 1);
    const vigente = scoreVigente(s.scores);
    const negocio = s.tendero.negocio;
    const datos = negocio
      ? await this.prisma.datoMensual.findMany({
          where: { negocioId: negocio.id },
          orderBy: { mes: 'asc' },
          select: {
            fuente: true,
            mes: true,
            ventas: true,
            compras: true,
            facturas: true,
            pagadasATiempo: true,
            diasRetrasoPromedio: true,
          },
        })
      : [];
    await this.audit.log({
      actorTipo: 'USUARIO',
      actorId: actor.sub,
      aliadoId: actor.aliadoId,
      accion: 'ver_solicitud',
      entidad: 'Solicitud',
      entidadId: id,
    });
    return {
      id: s.id,
      monto: s.monto,
      destino: s.destino,
      plazoMeses: s.plazoMeses,
      estado: s.estado,
      enviadaEn: s.enviadaEn,
      notaDecision: s.notaDecision,
      negocio: negocio && {
        nombre: negocio.nombre,
        propietario: s.tendero.nombre,
        tipo: negocio.tipo,
        barrio: negocio.barrio,
        ciudad: negocio.ciudad,
        antiguedadMeses: negocio.antiguedadMeses,
        ventasMensualesDeclaradas: negocio.ventasMensualesDeclaradas,
      },
      score: vigente ? scoreView(vigente) : null,
      scoreOriginal: original && vigente && vigente.version !== 1 ? scoreView(original) : null,
      variaciones: s.variaciones.map((v) => ({ mes: v.mes, motivo: v.motivo })),
      calidadDatos: s.calidadDatos,
      garantia: s.garantia,
      datos,
      politica,
      ...(vigente ? recomendar(vigente.puntaje, s.monto, politica) : {}),
    };
  }

  /** A2: aprobar, pedir garantía o rechazar (TND-062). */
  async decidir(actor: Actor, id: string, dto: DecisionDto) {
    const s = await this.cargar(actor, id);
    if (s.estado !== 'ENVIADA') {
      throw new ConflictException('Solo se puede decidir una solicitud en revisión');
    }
    if (dto.decision === 'PEDIR_GARANTIA') {
      if (!dto.tipoGarantia) throw new BadRequestException('Indica el tipo de garantía');
      await this.prisma.$transaction([
        this.prisma.garantia.create({
          data: { solicitudId: id, tipo: dto.tipoGarantia, notaAliado: dto.nota ?? null },
        }),
        this.prisma.solicitud.update({ where: { id }, data: { estado: 'GARANTIA_SOLICITADA' } }),
      ]);
    } else {
      await this.prisma.solicitud.update({
        where: { id },
        data: {
          estado: dto.decision === 'APROBAR' ? 'APROBADA' : 'RECHAZADA',
          notaDecision: dto.nota ?? null,
          decididaEn: new Date(),
          decididaPor: actor.sub,
        },
      });
    }
    await this.audit.log({
      actorTipo: 'USUARIO',
      actorId: actor.sub,
      aliadoId: actor.aliadoId,
      accion: `decision_${dto.decision.toLowerCase()}`,
      entidad: 'Solicitud',
      entidadId: id,
    });
    return this.detalle(actor, id);
  }

  /** A3/A4: evaluar la garantía y cerrar la solicitud (TND-063). */
  async evaluarGarantia(actor: Actor, id: string, dto: EvaluarGarantiaDto) {
    const s = await this.cargar(actor, id);
    if (s.estado !== 'GARANTIA_ENVIADA') {
      throw new ConflictException('El tendero todavía no ha enviado la garantía');
    }
    await this.prisma.$transaction([
      this.prisma.garantia.update({
        where: { solicitudId: id },
        data: { estado: dto.aceptar ? 'ACEPTADA' : 'RECHAZADA' },
      }),
      this.prisma.solicitud.update({
        where: { id },
        data: {
          estado: dto.aceptar ? 'APROBADA' : 'RECHAZADA',
          notaDecision: dto.nota ?? null,
          decididaEn: new Date(),
          decididaPor: actor.sub,
        },
      }),
    ]);
    await this.audit.log({
      actorTipo: 'USUARIO',
      actorId: actor.sub,
      aliadoId: actor.aliadoId,
      accion: dto.aceptar ? 'garantia_aceptada' : 'garantia_rechazada',
      entidad: 'Solicitud',
      entidadId: id,
    });
    return this.detalle(actor, id);
  }

  /** Configurar la política de riesgo (TND-061). */
  async guardarPolitica(actor: Actor, dto: PoliticaDto) {
    if (dto.scoreMinConGarantia > dto.scoreMinAprobar) {
      throw new BadRequestException(
        'El puntaje mínimo con garantía no puede ser mayor que el puntaje para aprobar',
      );
    }
    const p = await this.prisma.politica.upsert({
      where: { aliadoId: actor.aliadoId! },
      create: { aliadoId: actor.aliadoId!, ...dto },
      update: { ...dto, version: { increment: 1 } },
    });
    await this.audit.log({
      actorTipo: 'USUARIO',
      actorId: actor.sub,
      aliadoId: actor.aliadoId,
      accion: 'actualizar_politica',
      entidad: 'Politica',
      entidadId: p.id,
      detalle: { ...dto },
    });
    return p;
  }

  // --- Credenciales de API (TND-013) y consumo (TND-065) -------------------
  async apiKeys(actor: Actor) {
    return this.prisma.apiKey.findMany({
      where: { aliadoId: actor.aliadoId! },
      select: {
        id: true,
        nombre: true,
        prefijo: true,
        creadaEn: true,
        revocadaEn: true,
        ultimoUso: true,
      },
      orderBy: { creadaEn: 'desc' },
    });
  }

  /** La llave completa se muestra una sola vez; solo se guarda su hash. */
  async crearApiKey(actor: Actor, dto: CrearApiKeyDto) {
    const prefijo = randomToken(6).replace(/[-_]/g, 'x').slice(0, 8);
    const llave = `tnd_${prefijo}_${randomToken(24)}`;
    const k = await this.prisma.apiKey.create({
      data: { aliadoId: actor.aliadoId!, nombre: dto.nombre, prefijo, hash: sha256(llave) },
    });
    await this.audit.log({
      actorTipo: 'USUARIO',
      actorId: actor.sub,
      aliadoId: actor.aliadoId,
      accion: 'crear_api_key',
      entidad: 'ApiKey',
      entidadId: k.id,
    });
    return { id: k.id, nombre: k.nombre, prefijo, llave };
  }

  async revocarApiKey(actor: Actor, id: string) {
    const k = await this.prisma.apiKey.findFirst({ where: { id, aliadoId: actor.aliadoId! } });
    if (!k) throw new NotFoundException('No encontramos esa llave');
    await this.prisma.apiKey.update({ where: { id }, data: { revocadaEn: new Date() } });
    await this.audit.log({
      actorTipo: 'USUARIO',
      actorId: actor.sub,
      aliadoId: actor.aliadoId,
      accion: 'revocar_api_key',
      entidad: 'ApiKey',
      entidadId: id,
    });
    return { revocada: true };
  }

  async consumo(actor: Actor, dias = 30) {
    const desde = new Date(Date.now() - dias * 86_400_000);
    const rows = await this.prisma.$queryRaw<{ dia: Date; consultas: bigint; exitosas: bigint }[]>(
      Prisma.sql`SELECT date_trunc('day', "creadoEn") AS dia,
                        count(*) AS consultas,
                        count(*) FILTER (WHERE estado < 400) AS exitosas
                 FROM "ConsumoApi"
                 WHERE "aliadoId" = ${actor.aliadoId} AND "creadoEn" >= ${desde}
                 GROUP BY 1 ORDER BY 1`,
    );
    const porDia = rows.map((r) => ({
      dia: r.dia.toISOString().slice(0, 10),
      consultas: Number(r.consultas),
      exitosas: Number(r.exitosas),
    }));
    return {
      dias,
      total: porDia.reduce((a, r) => a + r.consultas, 0),
      exitosas: porDia.reduce((a, r) => a + r.exitosas, 0),
      porDia,
    };
  }

  async auditoria(actor: Actor) {
    return this.prisma.auditoria.findMany({
      where: { aliadoId: actor.aliadoId! },
      orderBy: { creadoEn: 'desc' },
      take: 200,
      select: {
        id: true,
        actorTipo: true,
        actorId: true,
        accion: true,
        entidad: true,
        entidadId: true,
        creadoEn: true,
      },
    });
  }

  private async cargar(actor: Actor, id: string) {
    const s = await this.prisma.solicitud.findFirst({
      where: { id, aliadoId: actor.aliadoId!, estado: { in: VISIBLES } },
      include: {
        scores: true,
        variaciones: { orderBy: { mes: 'asc' } },
        garantia: true,
        tendero: { include: { negocio: true } },
      },
    });
    // 404 (no 403) para no revelar que la solicitud existe en otro aliado.
    if (!s) throw new NotFoundException('No encontramos esa solicitud');
    return s;
  }
}
