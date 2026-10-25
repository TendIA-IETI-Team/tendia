import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../common/audit.service';
import { config } from '../config';
import { crearClienteClaude } from '../ia/claude';
import { PrismaService } from '../prisma.service';
import { hoyBogota } from './montos';
import { Canal, RegistrosService } from './registros.service';

export const LecturaCuadernoSchema = z.object({
  legible: z.boolean(),
  motivo: z.string().nullable(),
  registros: z.array(
    z.object({
      fecha: z.string().nullable(),
      ventas: z.number().nullable(),
      fiados: z.array(z.object({ cliente: z.string(), monto: z.number() })),
    }),
  ),
});
export type LecturaCuaderno = z.infer<typeof LecturaCuadernoSchema>;

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type TipoImagen = (typeof TIPOS)[number];
const MAX_BYTES = 5 * 1024 * 1024;

const SYSTEM = `Lees fotos de cuadernos de tiendas de barrio en Colombia. Extrae, por cada día escrito, el total vendido y los fiados (cliente y monto).
Reglas:
- Montos en pesos colombianos enteros: "35.000" o "35 mil" es 35000.
- Fechas en formato AAAA-MM-DD. Si la hoja no dice el año, usa el año de la fecha de hoy que te doy; nunca pongas fechas futuras.
- Si un dato no se lee con claridad, déjalo en null. No inventes ni completes cifras.
- Si la foto no es de un cuaderno de cuentas o no se puede leer, responde legible=false y explica el motivo en una frase sencilla.`;

/** Lectura de la foto del cuaderno con IA (TND-035). El tendero siempre confirma antes de guardar. */
@Injectable()
export class CuadernoService {
  private readonly logger = new Logger(CuadernoService.name);
  private readonly client = crearClienteClaude(60_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registros: RegistrosService,
    private readonly audit: AuditService,
  ) {}

  get disponible(): boolean {
    return this.client !== null;
  }

  async leer(tenderoId: string, imagenBase64: string, tipo: string, canal: Canal) {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'La lectura del cuaderno con IA no está configurada. Escribe tus ventas en la app o en el asistente.',
      );
    }
    if (!TIPOS.includes(tipo as TipoImagen)) {
      throw new BadRequestException('La foto debe ser JPG, PNG o WEBP');
    }
    const datos = imagenBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
    if (Buffer.byteLength(datos, 'base64') > MAX_BYTES) {
      throw new BadRequestException('La foto es muy pesada (máximo 5 MB)');
    }
    let lectura: LecturaCuaderno;
    try {
      const res = await this.client.messages.parse({
        model: config().ANTHROPIC_MODEL,
        max_tokens: 4000,
        system: SYSTEM,
        output_config: { effort: 'low', format: zodOutputFormat(LecturaCuadernoSchema) },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: tipo as TipoImagen, data: datos },
              },
              { type: 'text', text: `Hoy es ${hoyBogota()}. Lee este cuaderno.` },
            ],
          },
        ],
      });
      if (res.stop_reason === 'refusal' || !res.parsed_output) {
        throw new Error('sin lectura');
      }
      lectura = limpiar(res.parsed_output);
    } catch (err) {
      const detalle =
        err instanceof Anthropic.APIError ? `Claude API ${err.status}` : (err as Error).message;
      this.logger.warn(`No se pudo leer el cuaderno: ${detalle}`);
      throw new ServiceUnavailableException(
        'No pudimos leer la foto. Inténtalo de nuevo o escribe tus ventas.',
      );
    }
    const extraccion = await this.prisma.extraccionCuaderno.create({
      data: { tenderoId, datos: lectura as unknown as Prisma.InputJsonValue, canal },
    });
    return { id: extraccion.id, ...lectura };
  }

  async pendiente(tenderoId: string) {
    return this.prisma.extraccionCuaderno.findFirst({
      where: { tenderoId, estado: 'pendiente' },
      orderBy: { creadoEn: 'desc' },
    });
  }

  /** Guarda lo leído (con las correcciones del tendero, si las hizo). */
  async confirmar(tenderoId: string, id: string, corregido?: LecturaCuaderno['registros']) {
    const e = await this.prisma.extraccionCuaderno.findFirst({
      where: { id, tenderoId, estado: 'pendiente' },
    });
    if (!e) throw new NotFoundException('No encontramos esa lectura del cuaderno');
    const registros = corregido ?? (e.datos as unknown as LecturaCuaderno).registros;
    let ventas = 0;
    let fiados = 0;
    for (const r of registros) {
      if (r.fecha && r.ventas && r.ventas > 0) {
        await this.registros.registrarVenta(tenderoId, Math.round(r.ventas), 'cuaderno', r.fecha);
        ventas++;
      }
      for (const f of r.fiados) {
        if (f.cliente && f.monto > 0) {
          await this.registros.registrarFiado(
            tenderoId,
            f.cliente,
            Math.round(f.monto),
            'cuaderno',
            r.fecha ?? undefined,
          );
          fiados++;
        }
      }
    }
    await this.prisma.extraccionCuaderno.update({ where: { id }, data: { estado: 'confirmada' } });
    await this.audit.log({
      actorTipo: 'TENDERO',
      actorId: tenderoId,
      accion: 'confirmar_cuaderno',
      entidad: 'ExtraccionCuaderno',
      entidadId: id,
      detalle: { ventas, fiados },
    });
    return { ventasGuardadas: ventas, fiadosGuardados: fiados };
  }

  async descartar(tenderoId: string, id: string) {
    const r = await this.prisma.extraccionCuaderno.updateMany({
      where: { id, tenderoId, estado: 'pendiente' },
      data: { estado: 'descartada' },
    });
    if (!r.count) throw new NotFoundException('No encontramos esa lectura del cuaderno');
    return { descartada: true };
  }
}

/** Quita registros vacíos y fechas futuras: lo que no se pueda guardar no se muestra. */
export function limpiar(l: LecturaCuaderno): LecturaCuaderno {
  const hoy = hoyBogota();
  return {
    ...l,
    registros: l.registros
      .map((r) => ({
        fecha: r.fecha && /^\d{4}-\d{2}-\d{2}$/.test(r.fecha) && r.fecha <= hoy ? r.fecha : null,
        ventas: r.ventas && r.ventas > 0 ? Math.round(r.ventas) : null,
        fiados: r.fiados.filter((f) => f.cliente.trim() && f.monto > 0),
      }))
      .filter((r) => r.ventas || r.fiados.length),
  };
}
