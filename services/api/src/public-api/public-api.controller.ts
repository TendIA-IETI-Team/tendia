import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  HttpCode,
  Injectable,
  Module,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKey } from '@prisma/client';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../common/audit.service';
import { Public } from '../common/auth';
import { sha256 } from '../common/crypto';
import { ExplicacionService } from '../explicacion/explicacion.service';
import { PrismaService } from '../prisma.service';
import { ScoreResponse, ScoringClient } from '../scoring/scoring.client';
import { TenderoModule } from '../tendero/tendero.controller';

type ReqConLlave = Request & { apiKey?: ApiKey };

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<ReqConLlave>();
    const llave = req.header('x-api-key') ?? '';
    const prefijo = /^tnd_([A-Za-z0-9]{8})_/.exec(llave)?.[1];
    const k = prefijo ? await this.prisma.apiKey.findUnique({ where: { prefijo } }) : null;
    if (!k || k.revocadaEn || k.hash !== sha256(llave)) {
      throw new UnauthorizedException('Llave de API inválida o revocada');
    }
    req.apiKey = k;
    return true;
  }
}

const EJEMPLO = {
  business: { business_age_months: 36, declared_monthly_sales: 9000000 },
  sales: [
    { month: '2026-04', amount: 8800000, source: 'datafono' },
    { month: '2026-05', amount: 8600000, source: 'datafono' },
    { month: '2026-06', amount: 9100000, source: 'datafono' },
    { month: '2026-07', amount: 9300000, source: 'datafono' },
    { month: '2026-08', amount: 9050000, source: 'datafono' },
    { month: '2026-09', amount: 9400000, source: 'datafono' },
  ],
  distributor: [
    { month: '2026-07', purchases: 6500000, invoices: 5, paid_on_time: 5, avg_days_late: 0 },
    { month: '2026-08', purchases: 6400000, invoices: 6, paid_on_time: 5, avg_days_late: 3 },
    { month: '2026-09', purchases: 6800000, invoices: 5, paid_on_time: 5, avg_days_late: 0 },
  ],
  adjustments: [],
};

/**
 * API pública de score (TND-064): score-as-a-service para aliados que integran desde su core.
 * Cada consulta queda registrada para facturación por consulta (TND-065).
 */
@ApiTags('api-publica')
@ApiSecurity('api-key')
@Public()
@UseGuards(ApiKeyGuard)
@Controller('v1')
export class PublicApiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringClient,
    private readonly explicacion: ExplicacionService,
    private readonly audit: AuditService,
  ) {}

  @Post('score')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Calcula el Puntaje TendIA de un negocio',
    description:
      'El aliado es responsable de contar con la autorización del tendero (Ley 1581) para los datos que envía. ' +
      'Responde puntaje 0-1000, franja, probabilidad de incumplimiento a 90 días, contribuciones y explicación.',
  })
  @ApiHeader({ name: 'x-api-key', required: true, description: 'Llave creada en el portal' })
  @ApiBody({ schema: { type: 'object', example: EJEMPLO } })
  async score(@Req() req: ReqConLlave, @Body() body: Record<string, unknown>) {
    const k = req.apiKey!;
    const requestId = randomUUID();
    const res = await this.scoring.scoreRaw(body, requestId);
    await this.prisma.$transaction([
      this.prisma.consumoApi.create({
        data: {
          aliadoId: k.aliadoId,
          apiKeyId: k.id,
          endpoint: 'POST /v1/score',
          estado: res.status,
        },
      }),
      this.prisma.apiKey.update({ where: { id: k.id }, data: { ultimoUso: new Date() } }),
    ]);
    await this.audit.log({
      actorTipo: 'API_KEY',
      actorId: k.id,
      aliadoId: k.aliadoId,
      accion: 'consulta_score_api',
      entidad: 'ConsumoApi',
      entidadId: requestId,
      finalidad: 'consulta_api',
    });
    if (res.status === 422) {
      throw new BadRequestException({ message: 'Datos inválidos', detalle: res.body });
    }
    const score = res.body as ScoreResponse;
    const { explicacion } = await this.explicacion.explicar(score);
    return { ...score, explanation: explicacion };
  }
}

@Module({
  imports: [TenderoModule],
  controllers: [PublicApiController],
  providers: [ApiKeyGuard],
})
export class PublicApiModule {}
