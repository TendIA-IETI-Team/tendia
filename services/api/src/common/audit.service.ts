import { Global, Injectable, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export interface AuditEntry {
  actorTipo: 'TENDERO' | 'USUARIO' | 'API_KEY' | 'SISTEMA';
  actorId: string;
  accion: string;
  entidad: string;
  entidadId?: string;
  aliadoId?: string;
  detalle?: Prisma.InputJsonValue;
}

/** Bitácora de auditoría (TND-022): quién consultó o cambió qué y cuándo. Sin datos personales. */
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
