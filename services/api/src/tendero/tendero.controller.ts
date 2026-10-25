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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor, CurrentActor, Roles } from '../common/auth';
import { ConectoresService } from '../conectores/conectores.service';
import { ExplicacionService } from '../explicacion/explicacion.service';
import { ScoringClient } from '../scoring/scoring.client';
import {
  ConsentimientoDto,
  CrearSolicitudDto,
  EnviarDto,
  NegocioDto,
  RespuestaGarantiaDto,
  SatisfaccionDto,
  VariacionDto,
  VentasManualesDto,
} from './dto';
import { EvaluacionService } from './evaluacion.service';
import { SolicitudesService } from './solicitudes.service';
import { TenderoService, VERSION_TEXTO_CONSENTIMIENTO } from './tendero.service';

@ApiTags('tendero')
@ApiBearerAuth()
@Roles('TENDERO')
@Controller()
export class TenderoController {
  constructor(private readonly tendero: TenderoService) {}

  @Get('me')
  perfil(@CurrentActor() a: Actor) {
    return this.tendero.perfil(a.sub);
  }

  @Put('me/negocio')
  negocio(@CurrentActor() a: Actor, @Body() dto: NegocioDto) {
    return this.tendero.actualizarNegocio(a.sub, dto);
  }

  @Get('me/datos')
  datos(@CurrentActor() a: Actor) {
    return this.tendero.datosNegocio(a.sub);
  }

  @Post('me/ventas-manuales')
  @HttpCode(200)
  ventas(@CurrentActor() a: Actor, @Body() dto: VentasManualesDto) {
    return this.tendero.ventasManuales(a.sub, dto.meses);
  }

  @Get('fuentes')
  fuentes() {
    return {
      versionTexto: VERSION_TEXTO_CONSENTIMIENTO,
      fuentes: this.tendero.fuentesDisponibles(),
    };
  }

  @Get('consentimientos')
  consentimientos(@CurrentActor() a: Actor) {
    return this.tendero.consentimientos(a.sub);
  }

  @Post('consentimientos')
  autorizar(@CurrentActor() a: Actor, @Body() dto: ConsentimientoDto) {
    return this.tendero.autorizar(a.sub, dto);
  }

  @Delete('consentimientos/:id')
  revocar(@CurrentActor() a: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.tendero.revocar(a.sub, id);
  }

  @Get('aliados')
  aliados() {
    return this.tendero.aliados();
  }
}

@ApiTags('solicitudes')
@ApiBearerAuth()
@Roles('TENDERO')
@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudes: SolicitudesService) {}

  @Post()
  crear(@CurrentActor() a: Actor, @Body() dto: CrearSolicitudDto) {
    return this.solicitudes.crear(a.sub, dto);
  }

  @Get()
  listar(@CurrentActor() a: Actor) {
    return this.solicitudes.listar(a.sub);
  }

  @Get(':id')
  detalle(@CurrentActor() a: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.solicitudes.detalle(a.sub, id);
  }

  @Delete(':id')
  cancelar(@CurrentActor() a: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.solicitudes.cancelar(a.sub, id);
  }

  @Post(':id/evaluar')
  @HttpCode(200)
  evaluar(@CurrentActor() a: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.solicitudes.evaluar(a.sub, id);
  }

  @Post(':id/variaciones')
  @HttpCode(200)
  justificar(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VariacionDto,
  ) {
    return this.solicitudes.justificar(a.sub, id, dto);
  }

  @Delete(':id/variaciones/:mes')
  quitarVariacion(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mes') mes: string,
  ) {
    return this.solicitudes.quitarVariacion(a.sub, id, mes);
  }

  @Post(':id/enviar')
  @HttpCode(200)
  enviar(@CurrentActor() a: Actor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EnviarDto) {
    return this.solicitudes.enviar(a.sub, id, dto.aliadoId);
  }

  @Post(':id/garantia')
  @HttpCode(200)
  garantia(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespuestaGarantiaDto,
  ) {
    return this.solicitudes.responderGarantia(a.sub, id, dto);
  }

  @Post(':id/satisfaccion')
  @HttpCode(200)
  satisfaccion(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SatisfaccionDto,
  ) {
    return this.solicitudes.satisfaccion(a.sub, id, dto);
  }
}

/**
 * Datos reales de mercado para cualquier usuario autenticado: tasas de crédito productivo para
 * tiendas en Bogotá (Superfinanciera) y el perfil de los micronegocios de comercio (EMICRON, DANE).
 */
@ApiTags('referencias')
@ApiBearerAuth()
@Controller('referencias')
export class ReferenciasController {
  constructor(private readonly scoring: ScoringClient) {}

  @Get()
  referencias() {
    return this.scoring.referencias();
  }
}

@Module({
  controllers: [TenderoController, SolicitudesController, ReferenciasController],
  providers: [
    TenderoService,
    SolicitudesService,
    EvaluacionService,
    ConectoresService,
    ScoringClient,
    ExplicacionService,
  ],
  exports: [ScoringClient, ExplicacionService],
})
export class TenderoModule {}
