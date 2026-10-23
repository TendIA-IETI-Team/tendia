import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FuenteTipo } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { decrypt, maskPhone } from '../common/crypto';
import { ConectoresService } from '../conectores/conectores.service';
import { lastClosedMonth, monthAdd } from '../conectores/simulacion';
import { PrismaService } from '../prisma.service';
import { ConsentimientoDto, NegocioDto, VentaManualDto } from './dto';

/** Versión del texto de autorización que vio el tendero (Ley 1581). Cambiarla exige nuevo consentimiento. */
export const VERSION_TEXTO_CONSENTIMIENTO = '2026-10-v1';

@Injectable()
export class TenderoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conectores: ConectoresService,
    private readonly audit: AuditService,
  ) {}

  async perfil(tenderoId: string) {
    const t = await this.prisma.tendero.findUnique({
      where: { id: tenderoId },
      include: { negocio: true },
    });
    if (!t) throw new NotFoundException('No encontramos tu cuenta');
    const n = t.negocio;
    return {
      id: t.id,
      celular: maskPhone(decrypt(t.celularCifrado)),
      nombre: t.nombre,
      negocio: n && {
        nombre: n.nombre,
        tipo: n.tipo,
        barrio: n.barrio,
        ciudad: n.ciudad,
        antiguedadMeses: n.antiguedadMeses,
        ventasMensualesDeclaradas: n.ventasMensualesDeclaradas,
      },
    };
  }

  /** Completar información del negocio a mano (T5, TND-034). */
  async actualizarNegocio(tenderoId: string, dto: NegocioDto) {
    const { nombrePropietario, ...negocio } = dto;
    if (nombrePropietario !== undefined) {
      await this.prisma.tendero.update({
        where: { id: tenderoId },
        data: { nombre: nombrePropietario },
      });
    }
    await this.prisma.negocio.update({ where: { tenderoId }, data: negocio });
    return this.perfil(tenderoId);
  }

  async ventasManuales(tenderoId: string, meses: VentaManualDto[]) {
    const negocio = await this.negocioDe(tenderoId);
    const hasta = lastClosedMonth();
    const desde = monthAdd(hasta, -23);
    for (const m of meses) {
      if (m.mes > hasta || m.mes < desde) {
        throw new BadRequestException(`El mes ${m.mes} debe estar entre ${desde} y ${hasta}`);
      }
    }
    for (const m of meses) {
      await this.prisma.datoMensual.upsert({
        where: {
          negocioId_fuente_mes: { negocioId: negocio.id, fuente: FuenteTipo.MANUAL, mes: m.mes },
        },
        create: { negocioId: negocio.id, fuente: FuenteTipo.MANUAL, mes: m.mes, ventas: m.ventas },
        update: { ventas: m.ventas },
      });
    }
    return this.datosNegocio(tenderoId);
  }

  async datosNegocio(tenderoId: string) {
    const negocio = await this.negocioDe(tenderoId);
    const datos = await this.prisma.datoMensual.findMany({
      where: { negocioId: negocio.id },
      orderBy: [{ mes: 'asc' }, { fuente: 'asc' }],
      select: {
        fuente: true,
        mes: true,
        ventas: true,
        compras: true,
        facturas: true,
        pagadasATiempo: true,
      },
    });
    return { datos };
  }

  // --- Consentimientos (T2, TND-020 y TND-021) ----------------------------
  fuentesDisponibles() {
    return this.conectores.catalogo().map((c) => ({ ...c, ...TEXTOS_FUENTE[c.fuente] }));
  }

  async consentimientos(tenderoId: string) {
    return this.prisma.consentimiento.findMany({
      where: { tenderoId },
      orderBy: { otorgadoEn: 'desc' },
    });
  }

  async autorizar(tenderoId: string, dto: ConsentimientoDto) {
    const conector = this.conectores.porFuente(dto.fuente);
    if (!conector || !(conector.proveedores as readonly string[]).includes(dto.proveedor)) {
      throw new BadRequestException('Esa fuente o proveedor no está disponible');
    }
    const vigente = await this.prisma.consentimiento.findFirst({
      where: { tenderoId, fuente: dto.fuente, revocadoEn: null },
    });
    if (vigente) return vigente;
    const c = await this.prisma.consentimiento.create({
      data: {
        tenderoId,
        fuente: dto.fuente,
        proveedor: dto.proveedor,
        versionTexto: VERSION_TEXTO_CONSENTIMIENTO,
      },
    });
    await this.audit.log({
      actorTipo: 'TENDERO',
      actorId: tenderoId,
      accion: 'autorizar_fuente',
      entidad: 'Consentimiento',
      entidadId: c.id,
      detalle: { fuente: dto.fuente, versionTexto: VERSION_TEXTO_CONSENTIMIENTO },
    });
    return c;
  }

  /** Revocar corta el acceso y borra los datos ya traídos de esa fuente (supresión, Ley 1581). */
  async revocar(tenderoId: string, consentimientoId: string) {
    const c = await this.prisma.consentimiento.findFirst({
      where: { id: consentimientoId, tenderoId },
    });
    if (!c) throw new NotFoundException('No encontramos esa autorización');
    if (c.revocadoEn) return c;
    const negocio = await this.negocioDe(tenderoId);
    const [revocado] = await this.prisma.$transaction([
      this.prisma.consentimiento.update({
        where: { id: c.id },
        data: { revocadoEn: new Date() },
      }),
      this.prisma.datoMensual.deleteMany({ where: { negocioId: negocio.id, fuente: c.fuente } }),
    ]);
    await this.audit.log({
      actorTipo: 'TENDERO',
      actorId: tenderoId,
      accion: 'revocar_fuente',
      entidad: 'Consentimiento',
      entidadId: c.id,
      detalle: { fuente: c.fuente },
    });
    return revocado;
  }

  async aliados() {
    return this.prisma.aliado.findMany({
      select: { id: true, nombre: true, tipo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async negocioDe(tenderoId: string) {
    const negocio = await this.prisma.negocio.findUnique({ where: { tenderoId } });
    if (!negocio) throw new NotFoundException('No encontramos tu negocio');
    return negocio;
  }
}

/** Textos en lenguaje simple (cambios de la prueba con doña Gloria: nada de "open finance" ni "POS"). */
const TEXTOS_FUENTE: Record<
  FuenteTipo,
  { titulo: string; descripcion: string; queUsamos: string }
> = {
  DATAFONO: {
    titulo: 'Ventas con datáfono',
    descripcion: 'Las ventas que haces con tarjeta o código QR.',
    queUsamos: 'Cuánto vendes cada mes. No vemos quién te compra.',
  },
  DISTRIBUIDOR: {
    titulo: 'Pagos a tu proveedor',
    descripcion: 'Lo que le compras a crédito a tu distribuidor y si le pagas a tiempo.',
    queUsamos: 'Cuánto compras y si pagas en la fecha acordada.',
  },
  OPEN_FINANCE: {
    titulo: 'Cuentas del banco',
    descripcion: 'La plata que entra a tu cuenta de ahorros o billetera digital.',
    queUsamos: 'Cuánto dinero entra cada mes. No movemos tu plata.',
  },
  MANUAL: {
    titulo: 'Lo que tú nos cuentas',
    descripcion: 'Las ventas que anotas en tu cuaderno.',
    queUsamos: 'Tus ventas de cada mes.',
  },
};
