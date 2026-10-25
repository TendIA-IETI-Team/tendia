import { Controller, Get, Injectable, Module, NotFoundException, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { AuditService } from '../common/audit.service';
import { Actor, CurrentActor, Roles } from '../common/auth';
import { lookupHash, normalizePhone } from '../common/crypto';
import { resumenSatisfaccion } from '../common/satisfaccion';
import { PrismaService } from '../prisma.service';

export class BitacoraTenderoDto {
  @ApiProperty({ example: '3001234567', description: 'Celular del tendero que pide su bitácora' })
  @Matches(/^[\d\s+-]{10,16}$/, { message: 'Escribe un celular de 10 dígitos' })
  celular: string;
}

/** Equipo de TendIA (ADMIN_TENDIA): bitácora por tendero para responder ante la SIC (TND-022). */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async bitacoraTendero(actor: Actor, celularCrudo: string) {
    const celular = normalizePhone(celularCrudo);
    const tendero = celular
      ? await this.prisma.tendero.findUnique({
          where: { celularHash: lookupHash(celular) },
          include: { solicitudes: { select: { id: true } }, negocio: { select: { id: true } } },
        })
      : null;
    if (!tendero) throw new NotFoundException('No hay un tendero registrado con ese celular');
    const ids = [tendero.id, ...tendero.solicitudes.map((s) => s.id)];
    if (tendero.negocio) ids.push(tendero.negocio.id);
    const eventos = await this.prisma.auditoria.findMany({
      where: { OR: [{ actorId: tendero.id }, { entidadId: { in: ids } }] },
      orderBy: { creadoEn: 'desc' },
      take: 500,
    });
    const aliados = await this.prisma.aliado.findMany({ select: { id: true, nombre: true } });
    const nombre = new Map(aliados.map((a) => [a.id, a.nombre]));
    await this.audit.log({
      actorTipo: 'USUARIO',
      actorId: actor.sub,
      accion: 'consultar_bitacora',
      entidad: 'Tendero',
      entidadId: tendero.id,
      finalidad: 'atender_titular',
    });
    return {
      tenderoId: tendero.id,
      registradoEn: tendero.creadoEn,
      eventos: eventos.map((e) => ({
        id: e.id,
        creadoEn: e.creadoEn,
        actorTipo: e.actorTipo,
        actorId: e.actorId,
        aliado: e.aliadoId ? (nombre.get(e.aliadoId) ?? e.aliadoId) : null,
        accion: e.accion,
        entidad: e.entidad,
        finalidad: e.finalidad,
      })),
    };
  }

  satisfaccion() {
    return resumenSatisfaccion(this.prisma, {});
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN_TENDIA')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('bitacora')
  bitacora(@CurrentActor() a: Actor, @Query() q: BitacoraTenderoDto) {
    return this.admin.bitacoraTendero(a, q.celular);
  }

  @Get('satisfaccion')
  satisfaccion() {
    return this.admin.satisfaccion();
  }
}

@Module({ controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
