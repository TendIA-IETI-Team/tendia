import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { esCelularDemo } from '../auth/otp-sender';
import { decrypt, maskPhone } from '../common/crypto';
import { config } from '../config';
import { PrismaService } from '../prisma.service';
import { formatoPesos } from '../registros/montos';

/**
 * Aviso al tendero cuando la entidad decide (TND-057). La app lo muestra al abrirla (campo
 * `novedad`) y, si Twilio está configurado, también llega por WhatsApp desde el número del sandbox
 * o el de TWILIO_WHATSAPP_FROM. Un fallo al avisar nunca tumba la decisión del analista.
 */
@Injectable()
export class NotificadorService {
  private readonly logger = new Logger(NotificadorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async cambioDeEstado(solicitudId: string): Promise<void> {
    try {
      const s = await this.prisma.solicitud.findUnique({
        where: { id: solicitudId },
        include: { aliado: true, tendero: true },
      });
      if (!s) return;
      const mensaje = mensajeDeEstado(s);
      if (!mensaje) return;
      const celular = decrypt(s.tendero.celularCifrado);
      await this.whatsapp(celular, mensaje);
    } catch (e) {
      this.logger.warn(`No se pudo avisar el cambio de estado: ${(e as Error).message}`);
    }
  }

  private async whatsapp(celular: string, mensaje: string) {
    const c = config();
    // Sin Twilio, o con un celular de demostración (nadie es su dueño), el aviso queda en la app.
    if (!c.TWILIO_ACCOUNT_SID || !c.TWILIO_AUTH_TOKEN || esCelularDemo(celular)) return;
    const auth = Buffer.from(`${c.TWILIO_ACCOUNT_SID}:${c.TWILIO_AUTH_TOKEN}`).toString('base64');
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${c.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: c.TWILIO_WHATSAPP_FROM,
          To: `whatsapp:+57${celular}`,
          Body: mensaje,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { code?: number };
      throw new Error(`Twilio respondió ${res.status}${body.code ? ` (código ${body.code})` : ''}`);
    }
    this.logger.log(`Aviso de estado enviado por WhatsApp a ${maskPhone(celular)}`);
  }
}

export function mensajeDeEstado(s: {
  estado: string;
  monto: number;
  plazoMeses: number;
  montoAprobado: number | null;
  plazoAprobado: number | null;
  tasaAprobada: number | null;
  aliado: { nombre: string } | null;
}): string | null {
  const entidad = s.aliado?.nombre ?? 'La entidad';
  switch (s.estado) {
    case 'APROBADA': {
      const tasa = s.tasaAprobada ? `, tasa ${String(s.tasaAprobada).replace('.', ',')} % E.A` : '';
      return `TendIA: ¡${entidad} aprobó tu crédito! ${formatoPesos(s.montoAprobado ?? s.monto)} a ${s.plazoAprobado ?? s.plazoMeses} meses${tasa}. Abre la app TendIA para ver el detalle.`;
    }
    case 'RECHAZADA':
      return `TendIA: ${entidad} no aprobó tu solicitud esta vez. En la app TendIA te contamos cómo mejorar tu puntaje.`;
    case 'GARANTIA_SOLICITADA':
      return `TendIA: ${entidad} necesita una garantía para seguir con tu crédito. Abre la app TendIA para responder.`;
    default:
      return null;
  }
}

@Global()
@Module({ providers: [NotificadorService], exports: [NotificadorService] })
export class NotificacionesModule {}
