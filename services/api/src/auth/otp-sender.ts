import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { config, isProduction } from '../config';
import { maskPhone } from '../common/crypto';

/** Celulares de demostración: fijan el perfil de los conectores simulados (nunca en producción). */
export const DEMO_PROFILES: Record<string, string> = {
  '3000000001': 'bueno',
  '3000000002': 'estacional',
  '3000000003': 'riesgoso',
  '3000000004': 'nuevo',
};

/**
 * Rango reservado para demos y pruebas automáticas: 300 000 0000 a 300 000 0999. Fuera de
 * producción nunca se les manda SMS (nadie es dueño de esos números); los cuatro primeros de
 * DEMO_PROFILES además fijan el perfil del negocio simulado.
 */
export const esCelularDemo = (phone: string) => /^3000000\d{3}$/.test(phone);

/**
 * Cómo le llega el código al tendero:
 * - `twilio`: Twilio Verify lo genera, lo envía por SMS desde sus propios números y lo valida. Solo
 *   necesita TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN: no hay que comprar un número.
 * - `pantalla`: la API genera el código y lo devuelve en la respuesta (OTP_DEV_MODE, nunca en
 *   producción). Los celulares de demostración (esCelularDemo) usan este canal fuera de producción, aunque
 *   Twilio esté configurado, porque nadie es dueño de esos números.
 */
export type CanalOtp = 'twilio' | 'pantalla';

const VERIFY_API = 'https://verify.twilio.com/v2';
const NOMBRE_SERVICIO = 'TendIA';

@Injectable()
export class OtpSender {
  private readonly logger = new Logger(OtpSender.name);
  private servicio?: Promise<string>;

  get hasProvider(): boolean {
    const c = config();
    return Boolean(c.TWILIO_ACCOUNT_SID && c.TWILIO_AUTH_TOKEN);
  }

  canal(phone: string): CanalOtp {
    const c = config();
    const demo = esCelularDemo(phone) && c.OTP_DEV_MODE && !isProduction();
    if (demo || (!this.hasProvider && c.OTP_DEV_MODE)) return 'pantalla';
    if (this.hasProvider) return 'twilio';
    throw new ServiceUnavailableException(
      'El envío de códigos no está disponible en este momento.',
    );
  }

  /** Envía el código por SMS con Twilio Verify. */
  async enviar(phone: string): Promise<void> {
    const res = await this.verify('Verifications', {
      To: `+57${phone}`,
      Channel: 'sms',
      Locale: 'es',
    });
    if (!res.ok) {
      const error = await this.errorTwilio(res);
      this.logger.warn(`Twilio Verify no envió el OTP a ${maskPhone(phone)}: ${error}`);
      throw new ServiceUnavailableException(
        'No pudimos enviarte el código por SMS. Revisa el número o inténtalo en unos minutos.',
      );
    }
    this.logger.log(`OTP enviado por Twilio Verify a ${maskPhone(phone)}`);
  }

  /** true si Twilio aprueba el código; false si es incorrecto, venció o ya se usó. */
  async verificar(phone: string, code: string): Promise<boolean> {
    const res = await this.verify('VerificationCheck', { To: `+57${phone}`, Code: code });
    if (res.status === 404) return false;
    if (!res.ok) {
      this.logger.warn(`Twilio Verify no validó el OTP: ${await this.errorTwilio(res)}`);
      throw new ServiceUnavailableException('No pudimos validar el código. Inténtalo de nuevo.');
    }
    const body = (await res.json()) as { status?: string };
    return body.status === 'approved';
  }

  private async verify(ruta: string, datos: Record<string, string>): Promise<Response> {
    const sid = await this.servicioVerify();
    return this.twilio(`${VERIFY_API}/Services/${sid}/${ruta}`, datos);
  }

  /** TWILIO_VERIFY_SERVICE_SID, o el servicio "TendIA" de la cuenta (lo crea la primera vez). */
  private servicioVerify(): Promise<string> {
    const configurado = config().TWILIO_VERIFY_SERVICE_SID;
    if (configurado) return Promise.resolve(configurado);
    this.servicio ??= this.buscarOCrearServicio().catch((e: unknown) => {
      this.servicio = undefined;
      throw e;
    });
    return this.servicio;
  }

  private async buscarOCrearServicio(): Promise<string> {
    const lista = await this.twilio(`${VERIFY_API}/Services?PageSize=50`);
    if (lista.ok) {
      const { services } = (await lista.json()) as {
        services: { sid: string; friendly_name: string }[];
      };
      const existente = services.find((s) => s.friendly_name === NOMBRE_SERVICIO);
      if (existente) return existente.sid;
    }
    const creado = await this.twilio(`${VERIFY_API}/Services`, {
      FriendlyName: NOMBRE_SERVICIO,
      CodeLength: '6',
    });
    if (!creado.ok) {
      this.logger.error(
        `No se pudo crear el servicio de Twilio Verify: ${await this.errorTwilio(creado)}`,
      );
      throw new ServiceUnavailableException(
        'El envío de códigos no está disponible en este momento.',
      );
    }
    const { sid } = (await creado.json()) as { sid: string };
    this.logger.log(`Servicio de Twilio Verify "${NOMBRE_SERVICIO}" creado (${sid})`);
    return sid;
  }

  private twilio(url: string, datos?: Record<string, string>): Promise<Response> {
    const c = config();
    const auth = Buffer.from(`${c.TWILIO_ACCOUNT_SID}:${c.TWILIO_AUTH_TOKEN}`).toString('base64');
    return fetch(url, {
      method: datos ? 'POST' : 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
        ...(datos && { 'Content-Type': 'application/x-www-form-urlencoded' }),
      },
      body: datos && new URLSearchParams(datos),
      signal: AbortSignal.timeout(10_000),
    });
  }

  private async errorTwilio(res: Response): Promise<string> {
    const body = (await res.json().catch(() => ({}))) as { code?: number; message?: string };
    return `HTTP ${res.status}${body.code ? `, código ${body.code}` : ''}${body.message ? `: ${body.message}` : ''}`;
  }
}
