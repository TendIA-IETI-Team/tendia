import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { config } from '../config';

const key = () => Buffer.from(config().DATA_ENCRYPTION_KEY, 'base64');

/** AES-256-GCM. Formato: base64(iv | tag | datos). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
}

/** Hash determinístico para buscar por celular sin guardarlo en claro. */
export function lookupHash(value: string): string {
  return createHmac('sha256', key()).update(value).digest('hex');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

/** Celular colombiano: deja 10 dígitos que empiezan por 3. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '').replace(/^57(?=3\d{9}$)/, '');
  return /^3\d{9}$/.test(digits) ? digits : null;
}

export function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)} ••• ${phone.slice(-2)}`;
}
