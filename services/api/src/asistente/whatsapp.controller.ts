import {
  Body,
  Controller,
  ForbiddenException,
  Header,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Public } from '../common/auth';
import { lookupHash, normalizePhone } from '../common/crypto';
import { config, isProduction } from '../config';
import { PrismaService } from '../prisma.service';
import { CuadernoService, type LecturaCuaderno } from '../registros/cuaderno.service';
import { formatoPesos } from '../registros/montos';
import { AsistenteService } from './asistente.service';

/** Firma de Twilio: HMAC-SHA1 de la URL + parámetros ordenados, con el Auth Token. */
export function firmaTwilio(url: string, params: Record<string, string>, token: string): string {
  const datos = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  return createHmac('sha1', token).update(datos, 'utf8').digest('base64');
}

export function twiml(mensaje: string): string {
  const esc = mensaje.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${esc}</Message></Response>`;
}

export function resumenLectura(l: LecturaCuaderno): string {
  if (!l.legible || !l.registros.length) {
    return `No pude leer bien la foto${l.motivo ? `: ${l.motivo}` : ''}. Intenta con más luz o escríbeme tus ventas.`;
  }
  const lineas = l.registros.slice(0, 8).map((r) => {
    const v = r.ventas ? `ventas ${formatoPesos(r.ventas)}` : 'sin total';
    const f = r.fiados.length
      ? `, fiados: ${r.fiados.map((x) => `${x.cliente} ${formatoPesos(x.monto)}`).join(', ')}`
      : '';
    return `• ${r.fecha ?? 'sin fecha'}: ${v}${f}`;
  });
  return `Esto leí de tu cuaderno:\n${lineas.join('\n')}\n\nResponde SÍ para guardarlo o NO para descartarlo.`;
}

/**
 * Canal de WhatsApp (Twilio). El tendero escribe sus ventas y fiados, manda fotos del cuaderno o
 * pregunta por su crédito, desde el mismo número con el que se registró en la app.
 */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly asistente: AsistenteService,
    private readonly cuaderno: CuadernoService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  @Header('Content-Type', 'text/xml')
  async webhook(@Req() req: Request, @Body() body: Record<string, string>): Promise<string> {
    this.verificarFirma(req, body);
    const celular = normalizePhone((body.From ?? '').replace(/^whatsapp:/, ''));
    const tendero = celular
      ? await this.prisma.tendero.findUnique({ where: { celularHash: lookupHash(celular) } })
      : null;
    if (!tendero) {
      return twiml(
        'Hola, soy Tendi de TendIA. Primero regístrate en la app TendIA con este mismo número y luego escríbeme aquí.',
      );
    }

    // Foto del cuaderno.
    if (Number(body.NumMedia ?? 0) > 0 && (body.MediaContentType0 ?? '').startsWith('image/')) {
      try {
        const imagen = await this.descargarMedia(body.MediaUrl0);
        const lectura = await this.cuaderno.leer(
          tendero.id,
          imagen.toString('base64'),
          body.MediaContentType0,
          'whatsapp',
        );
        return twiml(resumenLectura(lectura));
      } catch (e) {
        return twiml((e as Error).message);
      }
    }

    // Confirmación de una lectura pendiente.
    const texto = (body.Body ?? '').trim();
    const pendiente = await this.cuaderno.pendiente(tendero.id);
    if (pendiente && /^(s[ií]|si,?|dale|listo)\b/i.test(texto)) {
      const r = await this.cuaderno.confirmar(tendero.id, pendiente.id);
      return twiml(`Guardado: ${r.ventasGuardadas} días de ventas y ${r.fiadosGuardados} fiados.`);
    }
    if (pendiente && /^no\b/i.test(texto)) {
      await this.cuaderno.descartar(tendero.id, pendiente.id);
      return twiml('Listo, no guardé nada de esa foto.');
    }

    if (!texto) return twiml('Escríbeme tus ventas, un fiado o mándame una foto de tu cuaderno.');
    const r = await this.asistente.responder(tendero.id, texto, 'whatsapp');
    return twiml(r.respuesta);
  }

  private verificarFirma(req: Request, body: Record<string, string>) {
    const token = config().TWILIO_AUTH_TOKEN;
    if (!token) {
      // Sin Twilio configurado solo se acepta en local y pruebas.
      if (isProduction() || config().APP_ENV === 'staging') {
        throw new ForbiddenException('WhatsApp no está configurado');
      }
      return;
    }
    const base = config().PUBLIC_API_URL ?? `${req.protocol}://${req.get('host')}`;
    const esperada = firmaTwilio(`${base}${req.originalUrl}`, body, token);
    const recibida = req.header('x-twilio-signature') ?? '';
    const ok =
      recibida.length === esperada.length &&
      timingSafeEqual(Buffer.from(recibida), Buffer.from(esperada));
    if (!ok) {
      this.logger.warn('Firma de Twilio inválida en el webhook de WhatsApp');
      throw new ForbiddenException('Firma inválida');
    }
  }

  private async descargarMedia(url: string): Promise<Buffer> {
    const c = config();
    if (!url?.startsWith('https://api.twilio.com/')) throw new Error('No pude abrir la foto.');
    const auth = Buffer.from(`${c.TWILIO_ACCOUNT_SID}:${c.TWILIO_AUTH_TOKEN}`).toString('base64');
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error('No pude descargar la foto. Inténtalo de nuevo.');
    return Buffer.from(await res.arrayBuffer());
  }
}
