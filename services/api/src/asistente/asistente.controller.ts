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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Actor, CurrentActor, Roles } from '../common/auth';
import { CuadernoService } from '../registros/cuaderno.service';
import { RegistrosService } from '../registros/registros.service';
import { AsistenteService } from './asistente.service';
import {
  ConfirmarCuadernoDto,
  CuadernoDto,
  EstimacionVentasDto,
  FiadoDto,
  MensajeDto,
  VentaDiariaDto,
} from './dto';
import { WhatsappController } from './whatsapp.controller';

/** Asistente de IA del tendero (app). El mismo motor atiende WhatsApp. */
@ApiTags('asistente')
@ApiBearerAuth()
@Roles('TENDERO')
@Controller('asistente')
export class AsistenteController {
  constructor(private readonly asistente: AsistenteService) {}

  @Get('mensajes')
  historial(@CurrentActor() a: Actor) {
    return this.asistente.historial(a.sub);
  }

  @Post('mensajes')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  responder(@CurrentActor() a: Actor, @Body() dto: MensajeDto) {
    return this.asistente.responder(a.sub, dto.mensaje, 'app');
  }
}

/** El cuaderno digital: ventas del día, fiados y lectura de fotos del cuaderno (RF-04, TND-034/035). */
@ApiTags('registros')
@ApiBearerAuth()
@Roles('TENDERO')
@Controller('me')
export class RegistrosController {
  constructor(
    private readonly registros: RegistrosService,
    private readonly cuaderno: CuadernoService,
  ) {}

  @Get('registros')
  resumen(@CurrentActor() a: Actor) {
    return this.registros.resumen(a.sub);
  }

  @Post('ventas-diarias')
  @HttpCode(200)
  venta(@CurrentActor() a: Actor, @Body() dto: VentaDiariaDto) {
    return this.registros.registrarVenta(a.sub, dto.monto, 'app', dto.fecha);
  }

  @Post('fiados')
  fiado(@CurrentActor() a: Actor, @Body() dto: FiadoDto) {
    return this.registros.registrarFiado(a.sub, dto.cliente, dto.monto, 'app', dto.fecha);
  }

  @Post('fiados/:id/pago')
  @HttpCode(200)
  pagar(@CurrentActor() a: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.registros.pagarFiado(a.sub, { id });
  }

  @Post('estimacion-ventas')
  @HttpCode(200)
  estimar(@CurrentActor() a: Actor, @Body() dto: EstimacionVentasDto) {
    return this.registros.estimarYGuardar(
      a.sub,
      dto.diaNormal,
      dto.diaFlojo,
      dto.diasFlojosPorSemana,
    );
  }

  @Get('cuaderno/disponible')
  disponible() {
    return { disponible: this.cuaderno.disponible };
  }

  @Post('cuaderno')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  leer(@CurrentActor() a: Actor, @Body() dto: CuadernoDto) {
    return this.cuaderno.leer(a.sub, dto.imagenBase64, dto.tipo, 'app');
  }

  @Post('cuaderno/:id/confirmar')
  @HttpCode(200)
  confirmar(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmarCuadernoDto,
  ) {
    return this.cuaderno.confirmar(a.sub, id, dto.registros);
  }

  @Delete('cuaderno/:id')
  descartar(@CurrentActor() a: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.cuaderno.descartar(a.sub, id);
  }
}

@Module({
  controllers: [AsistenteController, RegistrosController, WhatsappController],
  providers: [AsistenteService, RegistrosService, CuadernoService],
})
export class AsistenteModule {}
