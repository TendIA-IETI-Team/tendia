import Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { comoMejorar, estadoTexto, scoreView, scoreVigente } from '../common/vistas';
import { config } from '../config';
import { crearClienteClaude } from '../ia/claude';
import { PrismaService } from '../prisma.service';
import { formatoPesos, hoyBogota, sumarDias } from '../registros/montos';
import { Canal, RegistrosService } from '../registros/registros.service';
import { AYUDA, interpretar } from './interprete';

export interface Accion {
  tipo: 'venta' | 'fiado' | 'pago_fiado' | 'consulta';
  detalle: string;
}

export interface RespuestaAsistente {
  respuesta: string;
  acciones: Accion[];
  fuente: 'ia' | 'reglas';
}

const SYSTEM = `Eres "Tendi", el asistente de TendIA para tenderos de barrio en Colombia. Hablas en español colombiano sencillo, de "tú", con frases cortas (máximo 3 frases, porque muchos te leen por WhatsApp).
Lo que haces:
- Anotar las ventas del día y los fiados (lo que los clientes quedan debiendo) con tus herramientas. Si el tendero dice "hoy vendí 350 mil", anota la venta; "le fié 20 mil a don Pedro", anota el fiado; "don Pedro me pagó", marca su fiado como pagado. Confirma lo que anotaste con el monto en pesos.
- Contarle cómo va su solicitud de crédito y su Puntaje TendIA (escala 0 a 1000, franjas bajo, medio y bueno), y qué puede hacer para mejorarlo, usando la herramienta de consulta.
- Explicar palabras como "fiador", "Fondo Nacional de Garantías" o "tasa efectiva anual" en lenguaje del día a día.
Reglas:
- TendIA no presta dinero: el crédito lo decide la entidad que el tendero eligió. Nunca prometas que le van a prestar ni digas que algo está aprobado si la herramienta no lo dice.
- El Puntaje TendIA no es el de DataCrédito.
- Si un monto o un nombre no es claro, pregunta antes de anotar. No inventes cifras.
- No des asesoría de inversión, impuestos ni legal; sugiere hablar con la entidad o un asesor.
- Nunca le pidas contraseñas, códigos ni datos de tarjetas.`;

@Injectable()
export class AsistenteService {
  private readonly logger = new Logger(AsistenteService.name);
  private readonly client = crearClienteClaude(45_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registros: RegistrosService,
  ) {}

  async historial(tenderoId: string, limite = 50) {
    const msgs = await this.prisma.mensajeAsistente.findMany({
      where: { tenderoId },
      orderBy: { creadoEn: 'desc' },
      take: limite,
    });
    return msgs
      .reverse()
      .map((m) => ({ rol: m.rol, contenido: m.contenido, canal: m.canal, creadoEn: m.creadoEn }));
  }

  /** Atiende un mensaje del tendero desde la app o WhatsApp. */
  async responder(
    tenderoId: string,
    mensaje: string,
    canal: 'app' | 'whatsapp',
  ): Promise<RespuestaAsistente> {
    const texto = mensaje.trim().slice(0, 1000);
    const previos = await this.historial(tenderoId, 12);
    await this.prisma.mensajeAsistente.create({
      data: { tenderoId, rol: 'user', contenido: texto, canal },
    });

    const canalRegistro: Canal = canal === 'whatsapp' ? 'whatsapp' : 'asistente';
    let resultado: RespuestaAsistente | null = null;
    if (this.client) resultado = await this.conIA(tenderoId, texto, previos, canalRegistro);
    resultado ??= await this.conReglas(tenderoId, texto, canalRegistro);

    await this.prisma.mensajeAsistente.create({
      data: { tenderoId, rol: 'assistant', contenido: resultado.respuesta, canal },
    });
    return resultado;
  }

  // --- Con IA: Claude elige las herramientas ------------------------------
  private async conIA(
    tenderoId: string,
    texto: string,
    previos: { rol: string; contenido: string }[],
    canal: Canal,
  ): Promise<RespuestaAsistente | null> {
    const acciones: Accion[] = [];
    const tools = this.herramientas(tenderoId, canal, acciones);
    const contexto = await this.contexto(tenderoId);
    const messages: Anthropic.Beta.BetaMessageParam[] = [];
    for (const m of previos) {
      const role = m.rol === 'assistant' ? 'assistant' : 'user';
      if (!messages.length && role === 'assistant') continue; // el historial debe empezar por el tendero
      messages.push({ role, content: m.contenido });
    }
    messages.push({ role: 'user', content: texto });
    try {
      const final = await this.client!.beta.messages.toolRunner({
        model: config().ANTHROPIC_MODEL,
        max_tokens: 2000,
        max_iterations: 6,
        system: `${SYSTEM}\n\nContexto: ${contexto}`,
        output_config: { effort: 'low' },
        tools,
        messages,
      });
      if (final.stop_reason === 'refusal') return null;
      const respuesta = final.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      return respuesta ? { respuesta, acciones, fuente: 'ia' } : null;
    } catch (err) {
      const detalle =
        err instanceof Anthropic.APIError ? `Claude API ${err.status}` : (err as Error).message;
      this.logger.warn(`Asistente sin IA por error: ${detalle}`);
      // Si alguna herramienta ya anotó algo, lo contamos con el intérprete sin repetirlo.
      return acciones.length
        ? {
            respuesta: `Listo: ${acciones.map((a) => a.detalle).join('; ')}.`,
            acciones,
            fuente: 'reglas',
          }
        : null;
    }
  }

  herramientas(tenderoId: string, canal: Canal, acciones: Accion[]) {
    const fecha = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe('Fecha AAAA-MM-DD; si se omite es hoy');
    const seguro = async (fn: () => Promise<string>) => {
      try {
        return await fn();
      } catch (e) {
        return `No se pudo: ${(e as Error).message}`;
      }
    };
    return [
      betaZodTool({
        name: 'registrar_venta',
        description: 'Anota el total vendido en un día. Reemplaza lo anotado antes para ese día.',
        inputSchema: z.object({ monto: z.number().int().positive().describe('Pesos'), fecha }),
        run: ({ monto, fecha: f }) =>
          seguro(async () => {
            const v = await this.registros.registrarVenta(tenderoId, monto, canal, f);
            const detalle = `venta de ${formatoPesos(v.monto)} el ${v.fecha}`;
            acciones.push({ tipo: 'venta', detalle });
            return `Anotada ${detalle}.`;
          }),
      }),
      betaZodTool({
        name: 'registrar_fiado',
        description: 'Anota un fiado: lo que un cliente quedó debiendo.',
        inputSchema: z.object({
          cliente: z.string().min(1).describe('Nombre como lo dice el tendero, ej. "Don Pedro"'),
          monto: z.number().int().positive().describe('Pesos'),
          fecha,
        }),
        run: ({ cliente, monto, fecha: f }) =>
          seguro(async () => {
            const r = await this.registros.registrarFiado(tenderoId, cliente, monto, canal, f);
            const detalle = `fiado de ${formatoPesos(r.monto)} a ${r.cliente}`;
            acciones.push({ tipo: 'fiado', detalle });
            return `Anotado ${detalle}.`;
          }),
      }),
      betaZodTool({
        name: 'marcar_fiado_pagado',
        description: 'Marca como pagados los fiados pendientes de un cliente.',
        inputSchema: z.object({ cliente: z.string().min(1) }),
        run: ({ cliente }) =>
          seguro(async () => {
            const r = await this.registros.pagarFiado(tenderoId, { cliente });
            const detalle = `${cliente} pagó ${formatoPesos(r.total)}`;
            acciones.push({ tipo: 'pago_fiado', detalle });
            return `Listo: ${detalle} (${r.pagados} fiados).`;
          }),
      }),
      betaZodTool({
        name: 'consultar_resumen',
        description: 'Ventas de hoy, la semana y el mes, y fiados pendientes.',
        inputSchema: z.object({}),
        run: () =>
          seguro(async () => {
            acciones.push({ tipo: 'consulta', detalle: 'resumen de ventas y fiados' });
            return this.registros.resumenTexto(tenderoId);
          }),
      }),
      betaZodTool({
        name: 'consultar_solicitud',
        description: 'Estado de la solicitud de crédito, Puntaje TendIA y cómo mejorarlo.',
        inputSchema: z.object({}),
        run: () =>
          seguro(async () => {
            acciones.push({ tipo: 'consulta', detalle: 'estado de la solicitud' });
            return this.solicitudTexto(tenderoId);
          }),
      }),
    ];
  }

  private async contexto(tenderoId: string): Promise<string> {
    const n = await this.prisma.negocio.findUnique({ where: { tenderoId } });
    const hoy = hoyBogota();
    return `Hoy es ${hoy} (ayer ${sumarDias(hoy, -1)}). Tienda: ${n?.nombre ?? 'sin nombre'}.`;
  }

  async solicitudTexto(tenderoId: string): Promise<string> {
    const s = await this.prisma.solicitud.findFirst({
      where: { tenderoId },
      orderBy: { creadaEn: 'desc' },
      include: { scores: true, aliado: true },
    });
    if (!s) return 'Todavía no tienes una solicitud de crédito. Puedes pedirla desde la app.';
    const partes = [
      `Solicitud de ${formatoPesos(s.monto)}: ${estadoTexto(s.estado, s.aliado?.nombre)}.`,
    ];
    const vigente = scoreVigente(s.scores);
    if (vigente) {
      const v = scoreView(vigente);
      partes.push(
        `Tu Puntaje TendIA es ${v.puntaje} de 1000 (franja ${v.franjaNombre.toLowerCase()}).`,
      );
      const consejos = comoMejorar(vigente).slice(0, 2);
      if (consejos.length) partes.push(`Para mejorarlo: ${consejos.join(' ')}`);
    }
    return partes.join(' ');
  }

  // --- Sin IA: intérprete de frases comunes --------------------------------
  async conReglas(tenderoId: string, texto: string, canal: Canal): Promise<RespuestaAsistente> {
    const i = interpretar(texto);
    try {
      switch (i.tipo) {
        case 'venta': {
          const fecha = i.dia === 'ayer' ? sumarDias(hoyBogota(), -1) : undefined;
          const v = await this.registros.registrarVenta(tenderoId, i.monto, canal, fecha);
          const detalle = `venta de ${formatoPesos(v.monto)} el ${v.fecha}`;
          return {
            respuesta: `Listo, anoté tu ${detalle}. ¡Bien!`,
            acciones: [{ tipo: 'venta', detalle }],
            fuente: 'reglas',
          };
        }
        case 'fiado': {
          const f = await this.registros.registrarFiado(tenderoId, i.cliente, i.monto, canal);
          const detalle = `fiado de ${formatoPesos(f.monto)} a ${f.cliente}`;
          return {
            respuesta: `Anotado: ${detalle}.`,
            acciones: [{ tipo: 'fiado', detalle }],
            fuente: 'reglas',
          };
        }
        case 'pago_fiado': {
          const r = await this.registros.pagarFiado(tenderoId, { cliente: i.cliente });
          const detalle = `${i.cliente} pagó ${formatoPesos(r.total)}`;
          return {
            respuesta: `Listo: ${detalle}.`,
            acciones: [{ tipo: 'pago_fiado', detalle }],
            fuente: 'reglas',
          };
        }
        case 'resumen':
          return {
            respuesta: await this.registros.resumenTexto(tenderoId),
            acciones: [],
            fuente: 'reglas',
          };
        case 'solicitud':
          return {
            respuesta: await this.solicitudTexto(tenderoId),
            acciones: [],
            fuente: 'reglas',
          };
        default:
          return { respuesta: AYUDA, acciones: [], fuente: 'reglas' };
      }
    } catch (e) {
      return {
        respuesta: `No pude hacerlo: ${(e as Error).message}.`,
        acciones: [],
        fuente: 'reglas',
      };
    }
  }
}
