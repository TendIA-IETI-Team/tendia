import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';
import { ReportarErroresFilter } from './errores.filter';

jest.mock('@sentry/node', () => ({ captureException: jest.fn() }));

describe('ReportarErroresFilter', () => {
  const host = {} as never;
  let filtro: ReportarErroresFilter;

  beforeEach(() => {
    jest.mocked(Sentry.captureException).mockClear();
    jest.spyOn(BaseExceptionFilter.prototype, 'catch').mockImplementation(() => undefined);
    filtro = new ReportarErroresFilter();
  });

  it('reporta a Sentry los errores inesperados y los 5xx', () => {
    const error = new Error('falló la base de datos');
    filtro.catch(error, host);
    filtro.catch(new ServiceUnavailableException('Twilio caído'), host);
    expect(Sentry.captureException).toHaveBeenCalledTimes(2);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('no reporta los 4xx, que son respuestas esperadas', () => {
    filtro.catch(new BadRequestException('celular inválido'), host);
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(BaseExceptionFilter.prototype.catch).toHaveBeenCalled();
  });
});
