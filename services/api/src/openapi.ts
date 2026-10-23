/** Exporta el contrato OpenAPI a docs/api/openapi.json sin levantar la base de datos. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { openApiDocument } from './bootstrap';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  const out = join(__dirname, '..', '..', '..', 'docs', 'api');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'openapi.json'), JSON.stringify(openApiDocument(app), null, 2));
  await app.close();
}

void main();
