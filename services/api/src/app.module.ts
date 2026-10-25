import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AliadoModule } from './aliado/aliado.controller';
import { AsistenteModule } from './asistente/asistente.controller';
import { AuthModule } from './auth/auth.controller';
import { AuditModule } from './common/audit.service';
import { AuthGuard } from './common/auth';
import { config } from './config';
import { AdminModule } from './admin/admin.controller';
import { HealthModule } from './health.controller';
import { NotificacionesModule } from './notificaciones/notificador.service';
import { PrismaModule } from './prisma.service';
import { PublicApiModule } from './public-api/public-api.controller';
import { TenderoModule } from './tendero/tendero.controller';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: config().APP_ENV === 'test' ? 'silent' : 'info',
        // Logs JSON sin datos personales (TND-073): se ocultan tokens, celulares, cédulas y códigos.
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers["x-api-key"]',
            'req.headers.cookie',
            'req.body',
            'res.headers["set-cookie"]',
          ],
          censor: '[oculto]',
        },
        serializers: {
          req: (req: { id: string; method: string; url: string }) => ({
            id: req.id,
            method: req.method,
            url: req.url,
          }),
        },
        customProps: () => ({ release: config().RELEASE, env: config().APP_ENV }),
        autoLogging: { ignore: (req) => req.url === '/health' },
      },
    }),
    JwtModule.register({ global: true, secret: config().JWT_SECRET }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuditModule,
    NotificacionesModule,
    AdminModule,
    AuthModule,
    TenderoModule,
    AliadoModule,
    PublicApiModule,
    AsistenteModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
