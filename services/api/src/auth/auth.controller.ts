import { Body, Controller, Get, HttpCode, Module, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/auth';
import { config } from '../config';
import { AuthService } from './auth.service';
import {
  AceptarInvitacionDto,
  LoginAliadoDto,
  MfaDto,
  SolicitarOtpDto,
  VerificarOtpDto,
} from './dto';
import { OtpSender } from './otp-sender';

@ApiTags('auth')
@Public()
// 10 intentos por minuto por IP; en pruebas automáticas el límite no aplica.
@Throttle({ default: { limit: () => (config().APP_ENV === 'test' ? 10_000 : 10), ttl: 60_000 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('tendero/otp')
  @HttpCode(200)
  requestOtp(@Body() dto: SolicitarOtpDto) {
    return this.auth.requestOtp(dto.celular);
  }

  @Post('tendero/verificar')
  @HttpCode(200)
  verifyOtp(@Body() dto: VerificarOtpDto) {
    return this.auth.verifyOtp(dto.celular, dto.codigo);
  }

  @Post('aliado/login')
  @HttpCode(200)
  login(@Body() dto: LoginAliadoDto) {
    return this.auth.loginAliado(dto.email, dto.password);
  }

  @Post('aliado/mfa')
  @HttpCode(200)
  mfa(@Body() dto: MfaDto) {
    return this.auth.verifyMfa(dto.mfaToken, dto.codigo);
  }

  @Get('invitacion/:token')
  verInvitacion(@Param('token') token: string) {
    return this.auth.verInvitacion(token);
  }

  @Post('invitacion/:token')
  @HttpCode(201)
  aceptarInvitacion(@Param('token') token: string, @Body() dto: AceptarInvitacionDto) {
    return this.auth.aceptarInvitacion(token, dto.password);
  }
}

@Module({ controllers: [AuthController], providers: [AuthService, OtpSender] })
export class AuthModule {}
