import { existsSync } from 'node:fs';
import { z } from 'zod';

// En desarrollo local se carga services/api/.env (en Docker y Render llegan como variables de entorno).
if (existsSync('.env') && process.env.APP_ENV !== 'test') process.loadEnvFile('.env');

const schema = z.object({
  APP_ENV: z.enum(['local', 'test', 'dev', 'staging', 'production']).default('local'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  // Render entrega los servicios privados como host:puerto, sin esquema.
  SCORING_URL: z
    .string()
    .default('http://127.0.0.1:8000')
    .transform((v) => (/^https?:\/\//.test(v) ? v : `http://${v}`))
    .pipe(z.string().url()),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  // 32 bytes en base64 para AES-256-GCM (cédula y celular cifrados en reposo).
  DATA_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'DATA_ENCRYPTION_KEY: 32 bytes base64'),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:8081'),
  OTP_DEV_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  // Servicio de Twilio Verify para el OTP. Si falta, la API busca o crea uno llamado "TendIA"
  // con la misma cuenta: no hace falta comprar un número.
  TWILIO_VERIFY_SERVICE_SID: z.string().optional(),
  // Remitente de los avisos por WhatsApp. Por defecto, el número del sandbox de Twilio.
  TWILIO_WHATSAPP_FROM: z.string().default('whatsapp:+14155238886'),
  // URL del portal: los enlaces de invitación a analistas apuntan aquí.
  PORTAL_URL: z.string().url().default('http://localhost:3000'),
  // URL pública de la API (la configurada en Twilio): valida la firma del webhook de WhatsApp.
  PUBLIC_API_URL: z.string().url().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-opus-5-5'),
  SENTRY_DSN: z.string().optional(),
  // Versión desplegada: RELEASE explícito, o el commit que Render despliega (RENDER_GIT_COMMIT).
  RELEASE: z
    .string()
    .optional()
    .transform((v) => v || process.env.RENDER_GIT_COMMIT || 'dev'),
  SEED_ON_START: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type AppConfig = z.infer<typeof schema>;

let cached: AppConfig | undefined;

export function config(): AppConfig {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      throw new Error(`Configuración inválida:\n${issues.join('\n')}`);
    }
    if (parsed.data.APP_ENV === 'production' && parsed.data.OTP_DEV_MODE) {
      throw new Error('OTP_DEV_MODE no puede estar activo en producción');
    }
    cached = parsed.data;
  }
  return cached;
}

/** Solo para pruebas. */
export function resetConfig(): void {
  cached = undefined;
}

export const isProduction = () => config().APP_ENV === 'production';
