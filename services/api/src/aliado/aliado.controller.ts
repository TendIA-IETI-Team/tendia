import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor, CurrentActor, Roles } from '../common/auth';
import { ScoringClient } from '../scoring/scoring.client';
import { AliadoService } from './aliado.service';
import {
  CrearApiKeyDto,
  DecisionDto,
  EvaluarGarantiaDto,
  FiltroBandejaDto,
  InvitacionDto,
  PoliticaDto,
} from './dto';

@ApiTags('aliado')
@ApiBearerAuth()
@Roles('ANALISTA', 'ADMIN_ALIADO')
@Controller('aliado')
export class AliadoController {
  constructor(private readonly aliado: AliadoService) {}

  @Get('solicitudes')
  bandeja(@CurrentActor() a: Actor, @Query() q: FiltroBandejaDto) {
    return this.aliado.bandeja(a, q.estado);
  }

  @Get('solicitudes/:id')
  detalle(@CurrentActor() a: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.aliado.detalle(a, id);
  }

  @Post('solicitudes/:id/decision')
  @HttpCode(200)
  decidir(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.aliado.decidir(a, id, dto);
  }

  @Post('solicitudes/:id/garantia')
  @HttpCode(200)
  garantia(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EvaluarGarantiaDto,
  ) {
    return this.aliado.evaluarGarantia(a, id, dto);
  }

  /** Evidencia de una variación (T8) o documento de la garantía (T10). */
  @Get('solicitudes/:id/adjuntos/:adjuntoId')
  async adjunto(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('adjuntoId', ParseUUIDPipe) adjuntoId: string,
    @Res() res: Response,
  ) {
    const archivo = await this.aliado.adjunto(a, id, adjuntoId);
    res
      .type(archivo.tipo)
      .set('Content-Disposition', `inline; filename="${encodeURIComponent(archivo.nombre)}"`)
      .set('Cache-Control', 'private, no-store')
      .send(Buffer.from(archivo.datos));
  }

  @Get('politica')
  politica(@CurrentActor() a: Actor) {
    return this.aliado.politica(a.aliadoId!);
  }

  @Put('politica')
  @Roles('ADMIN_ALIADO')
  guardarPolitica(@CurrentActor() a: Actor, @Body() dto: PoliticaDto) {
    return this.aliado.guardarPolitica(a, dto);
  }

  @Get('api-keys')
  @Roles('ADMIN_ALIADO')
  apiKeys(@CurrentActor() a: Actor) {
    return this.aliado.apiKeys(a);
  }

  @Post('api-keys')
  @Roles('ADMIN_ALIADO')
  crearApiKey(@CurrentActor() a: Actor, @Body() dto: CrearApiKeyDto) {
    return this.aliado.crearApiKey(a, dto);
  }

  @Delete('api-keys/:id')
  @Roles('ADMIN_ALIADO')
  revocarApiKey(@CurrentActor() a: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.aliado.revocarApiKey(a, id);
  }

  @Get('consumo')
  consumo(@CurrentActor() a: Actor) {
    return this.aliado.consumo(a);
  }

  @Get('satisfaccion')
  satisfaccion(@CurrentActor() a: Actor) {
    return this.aliado.satisfaccion(a);
  }

  @Get('equipo')
  @Roles('ADMIN_ALIADO')
  equipo(@CurrentActor() a: Actor) {
    return this.aliado.equipo(a);
  }

  @Post('equipo/invitaciones')
  @Roles('ADMIN_ALIADO')
  invitar(@CurrentActor() a: Actor, @Body() dto: InvitacionDto) {
    return this.aliado.invitar(a, dto);
  }

  @Delete('equipo/invitaciones/:id')
  @Roles('ADMIN_ALIADO')
  revocarInvitacion(@CurrentActor() a: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.aliado.revocarInvitacion(a, id);
  }

  @Get('auditoria')
  @Roles('ADMIN_ALIADO')
  auditoria(@CurrentActor() a: Actor) {
    return this.aliado.auditoria(a);
  }
}

@Module({ controllers: [AliadoController], providers: [AliadoService, ScoringClient] })
export class AliadoModule {}
