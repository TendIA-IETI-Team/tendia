import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { estimarVentasMes, ventasMensualesDesdeDiarias } from './agregacion';
import { formatoPesos, hoyBogota, sumarDias } from './montos';

export type Canal = 'app' | 'asistente' | 'whatsapp' | 'cuaderno';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * El cuaderno del tendero, digital (RF-04): ventas del día y fiados. Lo usan la app, el asistente
 * de IA y WhatsApp. Las ventas del día alimentan el puntaje como "lo que tú nos cuentas".
 */
@Injectable()
export class RegistrosService {
  constructor(private readonly prisma: PrismaService) {}

  async negocioId(tenderoId: string): Promise<string> {
    const n = await this.prisma.negocio.findUnique({
      where: { tenderoId },
      select: { id: true },
    });
    if (!n) throw new NotFoundException('No encontramos tu negocio');
    return n.id;
  }

  private validarFecha(fecha: string | undefined): string {
    const hoy = hoyBogota();
    const f = fecha ?? hoy;
    if (!FECHA.test(f)) throw new BadRequestException('La fecha debe tener formato AAAA-MM-DD');
    if (f > hoy) throw new BadRequestException('No se pueden registrar ventas de días futuros');
    if (f < sumarDias(hoy, -400)) throw new BadRequestException('La fecha es muy antigua');
    return f;
  }

  /** Registra (o corrige) la venta de un día. */
  async registrarVenta(tenderoId: string, monto: number, canal: Canal, fecha?: string) {
    if (!Number.isInteger(monto) || monto <= 0 || monto > 500_000_000) {
      throw new BadRequestException('El monto de la venta no es válido');
    }
    const negocioId = await this.negocioId(tenderoId);
    const f = this.validarFecha(fecha);
    return this.prisma.ventaDiaria.upsert({
      where: { negocioId_fecha: { negocioId, fecha: f } },
      create: { negocioId, fecha: f, monto, canal },
      update: { monto, canal },
    });
  }

  async registrarFiado(
    tenderoId: string,
    cliente: string,
    monto: number,
    canal: Canal,
    fecha?: string,
  ) {
    const nombre = cliente.trim().slice(0, 60);
    if (!nombre) throw new BadRequestException('Falta el nombre del cliente');
    if (!Number.isInteger(monto) || monto <= 0 || monto > 50_000_000) {
      throw new BadRequestException('El monto del fiado no es válido');
    }
    const negocioId = await this.negocioId(tenderoId);
    return this.prisma.fiado.create({
      data: { negocioId, cliente: nombre, monto, fecha: this.validarFecha(fecha), canal },
    });
  }

  /** Marca como pagados los fiados pendientes de un cliente (o uno puntual por id). */
  async pagarFiado(tenderoId: string, opciones: { id?: string; cliente?: string }) {
    const negocioId = await this.negocioId(tenderoId);
    const pendientes = await this.prisma.fiado.findMany({
      where: {
        negocioId,
        pagadoEn: null,
        ...(opciones.id ? { id: opciones.id } : {}),
        ...(opciones.cliente
          ? { cliente: { contains: opciones.cliente.trim(), mode: 'insensitive' as const } }
          : {}),
      },
    });
    if (!pendientes.length) throw new NotFoundException('No hay fiados pendientes con ese nombre');
    await this.prisma.fiado.updateMany({
      where: { id: { in: pendientes.map((f) => f.id) } },
      data: { pagadoEn: new Date() },
    });
    return { pagados: pendientes.length, total: pendientes.reduce((a, f) => a + f.monto, 0) };
  }

  async resumen(tenderoId: string) {
    const negocioId = await this.negocioId(tenderoId);
    const hoy = hoyBogota();
    const desde = sumarDias(hoy, -59);
    const [ventas, fiados] = await Promise.all([
      this.prisma.ventaDiaria.findMany({
        where: { negocioId, fecha: { gte: desde } },
        orderBy: { fecha: 'desc' },
      }),
      this.prisma.fiado.findMany({
        where: { negocioId, pagadoEn: null },
        orderBy: { fecha: 'desc' },
      }),
    ]);
    const suma = (desdeFecha: string) =>
      ventas.filter((v) => v.fecha >= desdeFecha).reduce((a, v) => a + v.monto, 0);
    const porCliente = new Map<string, number>();
    for (const f of fiados) porCliente.set(f.cliente, (porCliente.get(f.cliente) ?? 0) + f.monto);
    return {
      hoy,
      ventaHoy: ventas.find((v) => v.fecha === hoy)?.monto ?? null,
      ventasSemana: suma(sumarDias(hoy, -6)),
      ventasMes: suma(`${hoy.slice(0, 7)}-01`),
      diasRegistradosMes: ventas.filter((v) => v.fecha.startsWith(hoy.slice(0, 7))).length,
      ventasRecientes: ventas
        .slice(0, 31)
        .map((v) => ({ fecha: v.fecha, monto: v.monto, canal: v.canal })),
      fiadosPendientes: fiados.map((f) => ({
        id: f.id,
        cliente: f.cliente,
        monto: f.monto,
        fecha: f.fecha,
      })),
      totalFiado: fiados.reduce((a, f) => a + f.monto, 0),
      fiadoPorCliente: [...porCliente.entries()]
        .map(([cliente, monto]) => ({ cliente, monto }))
        .sort((a, b) => b.monto - a.monto),
      mesesParaPuntaje: ventasMensualesDesdeDiarias(ventas),
    };
  }

  /** Texto corto del resumen, para el asistente y WhatsApp. */
  async resumenTexto(tenderoId: string): Promise<string> {
    const r = await this.resumen(tenderoId);
    const partes = [
      r.ventaHoy
        ? `Hoy llevas ${formatoPesos(r.ventaHoy)} en ventas.`
        : 'Hoy aún no registras ventas.',
      `Esta semana: ${formatoPesos(r.ventasSemana)}. Este mes: ${formatoPesos(r.ventasMes)} (${r.diasRegistradosMes} días anotados).`,
      r.totalFiado
        ? `Te deben ${formatoPesos(r.totalFiado)} en fiados (${r.fiadoPorCliente.length} clientes).`
        : 'No tienes fiados pendientes.',
    ];
    return partes.join(' ');
  }

  /** T5: estima las ventas del mes con un día normal y uno flojo, y las guarda como declaradas. */
  async estimarYGuardar(
    tenderoId: string,
    diaNormal: number,
    diaFlojo: number,
    diasFlojos: number,
  ) {
    const est = estimarVentasMes(diaNormal, diaFlojo, diasFlojos);
    await this.prisma.negocio.update({
      where: { tenderoId },
      data: { ventasMensualesDeclaradas: est.mes },
    });
    return est;
  }
}
