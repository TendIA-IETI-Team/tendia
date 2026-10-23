import * as Sentry from '@sentry/node';
import { config } from './config';

const cfg = config();
if (cfg.SENTRY_DSN) {
  Sentry.init({
    dsn: cfg.SENTRY_DSN,
    release: cfg.RELEASE,
    environment: cfg.APP_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
}

import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp, openApiDocument } from './bootstrap';
import { seed } from './seed';

async function main() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app);
  SwaggerModule.setup('docs', app, openApiDocument(app));
  app.enableShutdownHooks();
  if (cfg.SEED_ON_START && cfg.APP_ENV !== 'production') await seed();
  await app.listen(cfg.PORT, '0.0.0.0');
}

main().catch((err) => {
  Sentry.captureException(err);
  console.error(err);
  process.exit(1);
});
