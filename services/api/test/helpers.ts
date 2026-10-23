import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { authenticator } from 'otplib';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { decrypt } from '../src/common/crypto';
import { PrismaService } from '../src/prisma.service';
import { DEMO_PASSWORD, seed } from '../src/seed';

export async function createApp(): Promise<{ app: INestApplication; prisma: PrismaClient }> {
  const prisma = new PrismaClient();
  await resetDb(prisma);
  await seed(prisma);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return { app, prisma };
}

export async function resetDb(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
    );
  }
}

export async function loginTendero(app: INestApplication, celular: string): Promise<string> {
  const otp = await request(app.getHttpServer())
    .post('/auth/tendero/otp')
    .send({ celular })
    .expect(200);
  const res = await request(app.getHttpServer())
    .post('/auth/tendero/verificar')
    .send({ celular, codigo: otp.body.codigoDev })
    .expect(200);
  return res.body.accessToken;
}

/** Ingreso de analista: enrola MFA en el primer acceso; después usa el secreto ya guardado. */
export async function loginAliado(app: INestApplication, email: string): Promise<string> {
  const login = await request(app.getHttpServer())
    .post('/auth/aliado/login')
    .send({ email, password: DEMO_PASSWORD })
    .expect(200);
  let secret: string | undefined = login.body.secreto;
  if (!secret) {
    const prisma = app.get(PrismaService);
    const user = await prisma.usuario.findUniqueOrThrow({ where: { email } });
    secret = decrypt(user.totpSecreto!);
  }
  const res = await request(app.getHttpServer())
    .post('/auth/aliado/mfa')
    .send({ mfaToken: login.body.mfaToken, codigo: authenticator.generate(secret) })
    .expect(200);
  return res.body.accessToken;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
