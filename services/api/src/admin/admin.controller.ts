import {
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { TipoAliado } from '@prisma/client';
import { IsEmail, IsEnum, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AuditService } from '../common/audit.service';
import { Actor, CurrentActor, Roles } from '../common/auth';
import { lookupHash, normalizePhone } from '../common/crypto';
import { crearInvitacion } from '../common/invitaciones';
import { resumenSatisfaccion } from '../common/satisfaccion';
import { PrismaService } from '../prisma.service';

export class BitacoraTenderoDto {
  @ApiProperty({ example: '3001234567', description: 'Celular del tendero que pide su bitácora' })
  @Matches(/^[\d\s+-]{10,16}$/, { message: 'Escribe un celular de 10 dígitos' })
  celular: string;
}

export class AdministradorAliadoDto {
  @ApiProperty({ example: 'Sofía Rincón' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre: string;

  @ApiProperty({ example: 'sofia.rincon@cooperativa.co' })
  @IsEmail({}, { message: 'Escribe un correo válido' })
  @MaxLength(160)
  email: string;
}

export class CrearAliadoDto extends AdministradorAliadoDto {
  @ApiProperty({ example: 'Cooperativa del Barrio' })
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  entidad: string;

  @ApiProperty({ enum: TipoAliado })
  @IsEnum(TipoAliado, { message: 'Elige el tipo de entidad' })
  tipo: TipoAliado;
}

/** "Cooperativa Ñapa & Cía." -> "cooperativa-napa-cia" */
function slugDe(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
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

  // --- Alta de aliados ---------------------------------------------------------
  async aliados() {
    const aliados = await this.prisma.aliado.findMany({
      select: {
        id: true,
        nombre: true,
        tipo: true,
        usuarios: { select: { rol: true, mfaActivo: true } },
        invitaciones: {
          where: { usadaEn: null, expiraEn: { gt: new Date() } },
          select: { email: true, expiraEn: true },
        },
        _count: { select: { solicitudes: true } },
      },
      orderBy: { nombre: 'asc' },
    });
    return aliados.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      tipo: a.tipo,
      administradores: a.usuarios.filter((u) => u.rol === 'ADMIN_ALIADO').length,
      usuarios: a.usuarios.length,
      conMfa: a.usuarios.filter((u) => u.mfaActivo).length,
      invitacionesPendientes: a.invitaciones,
      solicitudes: a._count.solicitudes,
    }));
  }

  /**
   * TendIA da de alta a la entidad después de su vinculación comercial: no hay registro abierto,
   * porque una entidad del portal ve datos personales de tenderos. Se crea la entidad y una
   * invitación de un solo uso para su primer administrador, que crea su contraseña y activa la
   * verificación en dos pasos al entrar; luego él invita a sus analistas desde Equipo.
   */
  async crearAliado(actor: Actor, dto: CrearAliadoDto) {
    const email = dto.email.toLowerCase();
    await this.exigirCorreoLibre(email);
    const nombre = dto.entidad.trim();
    if (
      await this.prisma.aliado.findFirst({
        where: { nombre: { equals: nombre, mode: 'insensitive' } },
      })
    ) {
      throw new ConflictException('Ya existe una entidad con ese nombre');
    }
    const base = slugDe(nombre) || 'aliado';
    let slug = base;
    for (let n = 2; await this.prisma.aliado.findUnique({ where: { slug } }); n++)
      slug = `${base}-${n}`;

    const aliado = await this.prisma.aliado.create({ data: { nombre, slug, tipo: dto.tipo } });
    await this.audit.log({
      actorTipo: 'USUARIO',
      actorId: actor.sub,
      aliadoId: aliado.id,
      accion: 'crear_aliado',
      entidad: 'Aliado',
      entidadId: aliado.id,
      finalidad: 'administrar_cuenta',
    });
    return {
      aliado: { id: aliado.id, nombre: aliado.nombre, tipo: aliado.tipo },
      ...(await this.invitarAdministrador(actor, aliado.id, { nombre: dto.nombre, email })),
    };
  }

  /** Nueva invitación de administrador, por ejemplo si la primera venció sin usarse. */
  async invitarAdministrador(actor: Actor, aliadoId: string, dto: AdministradorAliadoDto) {
    const email = dto.email.toLowerCase();
    await this.exigirCorreoLibre(email);
    if (!(await this.prisma.aliado.findUnique({ where: { id: aliadoId } }))) {
      throw new NotFoundException('No encontramos esa entidad');
    }
    const { inv, enlace, mailto } = await crearInvitacion(this.prisma, {
      aliadoId,
      email,
      nombre: dto.nombre,
      rol: 'ADMIN_ALIADO',
      creadaPor: actor.sub,
    });
    await this.audit.log({
      actorTipo: 'USUARIO',
      actorId: actor.sub,
      aliadoId,
      accion: 'invitar_usuario',
      entidad: 'Invitacion',
      entidadId: inv.id,
      finalidad: 'administrar_cuenta',
    });
    return { invitacion: { id: inv.id, email, expiraEn: inv.expiraEn, enlace, mailto } };
  }

  private async exigirCorreoLibre(email: string) {
    if (await this.prisma.usuario.findUnique({ where: { email } })) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }
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

  @Get('aliados')
  aliados() {
    return this.admin.aliados();
  }

  @Post('aliados')
  crearAliado(@CurrentActor() a: Actor, @Body() dto: CrearAliadoDto) {
    return this.admin.crearAliado(a, dto);
  }

  @Post('aliados/:id/invitaciones')
  invitarAdministrador(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdministradorAliadoDto,
  ) {
    return this.admin.invitarAdministrador(a, id, dto);
  }
}

@Module({ controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
