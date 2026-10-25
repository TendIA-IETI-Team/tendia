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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor, CurrentActor, Roles } from '../common/auth';
import { ScoringClient } from '../scoring/scoring.client';
import { AliadoService } from './aliado.service';
import {
  CrearApiKeyDto,
  DecisionDto,
  EvaluarGarantiaDto,
  FiltroBandejaDto,
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

  @Get('auditoria')
  @Roles('ADMIN_ALIADO')
  auditoria(@CurrentActor() a: Actor) {
    return this.aliado.auditoria(a);
  }
}

@Module({ controllers: [AliadoController], providers: [AliadoService, ScoringClient] })
export class AliadoModule {}
