import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';

/**
 * Cliente de Claude compartido por la explicación del puntaje, el asistente y la lectura del
 * cuaderno. Sin ANTHROPIC_API_KEY devuelve null y cada función usa su alternativa sin IA.
 */
export function crearClienteClaude(timeoutMs: number): Anthropic | null {
  const key = config().ANTHROPIC_API_KEY;
  return key ? new Anthropic({ apiKey: key, timeout: timeoutMs, maxRetries: 1 }) : null;
}
