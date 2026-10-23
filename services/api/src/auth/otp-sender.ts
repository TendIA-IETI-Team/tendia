import { Injectable, Logger } from '@nestjs/common';
import { config } from '../config';
import { maskPhone } from '../common/crypto';

/**
 * Envío del código OTP por SMS.
 * - Con TWILIO_* configurado: usa la API REST de Twilio.
 * - Sin proveedor y OTP_DEV_MODE=true: el código se devuelve en la respuesta (solo local/dev).
 */
@Injectable()
export class OtpSender {
  private readonly logger = new Logger(OtpSender.name);

  get hasProvider(): boolean {
    const c = config();
    return Boolean(c.TWILIO_ACCOUNT_SID && c.TWILIO_AUTH_TOKEN && c.TWILIO_FROM);
  }

  async send(phone: string, code: string): Promise<void> {
    const c = config();
    if (!this.hasProvider) {
      if (!c.OTP_DEV_MODE) throw new Error('No hay proveedor de SMS configurado');
      this.logger.log(`OTP de desarrollo generado para ${maskPhone(phone)}`);
      return;
    }
    const body = new URLSearchParams({
      To: `+57${phone}`,
      From: c.TWILIO_FROM!,
      Body: `Tu código de TendIA es ${code}. Vence en 5 minutos. No lo compartas con nadie.`,
    });
    const auth = Buffer.from(`${c.TWILIO_ACCOUNT_SID}:${c.TWILIO_AUTH_TOKEN}`).toString('base64');
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${c.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) throw new Error(`Twilio respondió ${res.status}`);
  }
}
