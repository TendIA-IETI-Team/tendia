import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

/**
 * Nest atrapa los errores antes que Sentry, así que sin este filtro un 500 nunca llegaría.
 * Reporta solo los errores del servidor (5xx); los 4xx son respuestas esperadas.
 * Sin SENTRY_DSN, captureException no hace nada.
 */
@Catch()
export class ReportarErroresFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    if (status >= 500) Sentry.captureException(exception);
    super.catch(exception, host);
  }
}
