import { Global, Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private rls = true;

  async onModuleInit() {
    await this.$connect();
    // Si la base no permite usar el rol del portal, se sigue con el aislamiento de la aplicación.
    try {
      await this.$transaction((tx) => tx.$executeRawUnsafe('SET LOCAL ROLE tendia_aliado'));
    } catch {
      this.rls = false;
      this.logger.warn(
        'RLS del portal no disponible: falta el rol tendia_aliado para este usuario',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Lecturas del portal del aliado con Row Level Security (TND-012): la transacción corre con el
   * rol tendia_aliado y app.aliado_id, así que Postgres solo devuelve filas de ese aliado aunque la
   * consulta no filtre. Ver la migración bitacora_inmutable_y_rls.
   */
  comoAliado<T>(aliadoId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.aliado_id', ${aliadoId}, true)`;
      if (this.rls) await tx.$executeRawUnsafe('SET LOCAL ROLE tendia_aliado');
      return fn(tx);
    });
  }
}

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
