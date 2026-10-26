import { Global, Injectable, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export interface AuditEntry {
  actorTipo: 'TENDERO' | 'USUARIO' | 'API_KEY' | 'SISTEMA';
  actorId: string;
  accion: string;
  entidad: string;
  entidadId?: string;
  aliadoId?: string | null;
  /** Para qué se leyó o cambió el dato (Ley 1581). */
  finalidad?: Finalidad;
  detalle?: Prisma.InputJsonValue;
}

export type Finalidad =
  | 'evaluar_credito'
  | 'decidir_credito'
  | 'revisar_documento'
  | 'consulta_api'
  | 'administrar_cuenta'
  | 'atender_titular';

/**
 * Bitácora de auditoría (TND-022): quién consultó o cambió qué, cuándo y para qué. Sin datos
 * personales. Es de solo inserción: un trigger en Postgres rechaza UPDATE y DELETE.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    await this.prisma.auditoria.create({ data: entry });
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
