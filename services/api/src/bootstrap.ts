import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ReportarErroresFilter } from './common/errores.filter';
import { config } from './config';

/** Configuración compartida por main.ts y las pruebas e2e. */
export function configureApp(app: INestApplication): void {
  const express = app as NestExpressApplication;
  // Las fotos del cuaderno llegan en base64 (hasta 5 MB); Twilio envía formularios urlencoded.
  express.useBodyParser('json', { limit: '8mb' });
  express.useBodyParser('urlencoded', { extended: true, limit: '1mb' });
  app.use(helmet());
  app.enableCors({
    origin: config()
      .CORS_ORIGINS.split(',')
      .map((o) => o.trim()),
    credentials: false,
  });
  app.useGlobalFilters(new ReportarErroresFilter(app.getHttpAdapter()));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
}

export function openApiDocument(app: INestApplication) {
  const doc = new DocumentBuilder()
    .setTitle('TendIA API')
    .setDescription(
      'Crédito basado en tu negocio, no en tu pasado bancario. ' +
        'TendIA no presta dinero: calcula un puntaje explicado que el tendero comparte con el aliado que elige.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'api-key')
    .build();
  return SwaggerModule.createDocument(app, doc);
}
