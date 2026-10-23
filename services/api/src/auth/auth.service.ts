import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { authenticator } from 'otplib';
import { config, isProduction } from '../config';
import { AuditService } from '../common/audit.service';
import type { Actor } from '../common/auth';
import { decrypt, encrypt, lookupHash, normalizePhone, sha256 } from '../common/crypto';
import { PrismaService } from '../prisma.service';
import { OtpSender } from './otp-sender';

const OTP_TTL_MS = 5 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_PER_WINDOW = 3;
const OTP_WINDOW_MS = 10 * 60_000;
// Hash señuelo para que un correo inexistente tarde lo mismo que una contraseña errada.
const DUMMY_HASH = bcrypt.hashSync('tendia-hash-senuelo', 10);

/** Celulares de demostración: fijan el perfil de los conectores simulados (nunca en producción). */
export const DEMO_PROFILES: Record<string, string> = {
  '3000000001': 'bueno',
  '3000000002': 'estacional',
  '3000000003': 'riesgoso',
  '3000000004': 'nuevo',
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly otp: OtpSender,
    private readonly audit: AuditService,
  ) {}

  // --- Tendero: celular + OTP (TND-010) ------------------------------------
  async requestOtp(rawPhone: string): Promise<{ enviado: true; codigoDev?: string }> {
    const phone = this.phoneOrFail(rawPhone);
    const celularHash = lookupHash(phone);
    const recent = await this.prisma.otpCodigo.count({
      where: { celularHash, creadoEn: { gt: new Date(Date.now() - OTP_WINDOW_MS) } },
    });
    if (recent >= OTP_MAX_PER_WINDOW) {
      throw new HttpException(
        'Pediste muchos códigos. Espera unos minutos e inténtalo de nuevo.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.otpCodigo.create({
      data: {
        celularHash,
        codigoHash: sha256(`${code}:${celularHash}`),
        expiraEn: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    await this.otp.send(phone, code);
    const devMode = config().OTP_DEV_MODE && !this.otp.hasProvider;
    return devMode ? { enviado: true, codigoDev: code } : { enviado: true };
  }

  async verifyOtp(rawPhone: string, code: string) {
    const phone = this.phoneOrFail(rawPhone);
    const celularHash = lookupHash(phone);
    const otp = await this.prisma.otpCodigo.findFirst({
      where: { celularHash, usadoEn: null, expiraEn: { gt: new Date() } },
      orderBy: { creadoEn: 'desc' },
    });
    if (!otp || otp.intentos >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException('El código venció. Pide uno nuevo.');
    }
    if (otp.codigoHash !== sha256(`${code}:${celularHash}`)) {
      await this.prisma.otpCodigo.update({
        where: { id: otp.id },
        data: { intentos: { increment: 1 } },
      });
      throw new UnauthorizedException('El código no es correcto.');
    }
    await this.prisma.otpCodigo.update({ where: { id: otp.id }, data: { usadoEn: new Date() } });

    let tendero = await this.prisma.tendero.findUnique({ where: { celularHash } });
    const nuevo = !tendero;
    if (!tendero) {
      tendero = await this.prisma.tendero.create({
        data: {
          celularHash,
          celularCifrado: encrypt(phone),
          negocio: {
            create: { perfilSimulado: isProduction() ? null : (DEMO_PROFILES[phone] ?? null) },
          },
        },
      });
    }
    await this.audit.log({
      actorTipo: 'TENDERO',
      actorId: tendero.id,
      accion: nuevo ? 'registro' : 'ingreso',
      entidad: 'Tendero',
      entidadId: tendero.id,
    });
    const actor: Actor = { sub: tendero.id, rol: 'TENDERO' };
    return { accessToken: this.jwt.sign(actor, { expiresIn: '12h' }), nuevo };
  }

  // --- Analista del aliado: correo + contraseña + TOTP obligatorio (TND-011) -
  async loginAliado(email: string, password: string) {
    const user = await this.prisma.usuario.findUnique({ where: { email: email.toLowerCase() } });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException('Correo o contraseña incorrectos');

    const mfaToken = this.jwt.sign({ sub: user.id, purpose: 'mfa' }, { expiresIn: '5m' });
    if (user.mfaActivo && user.totpSecreto) return { mfaRequerido: true, mfaToken };

    // Primer ingreso: se genera el secreto y el usuario debe enrolarlo antes de entrar.
    const secret = authenticator.generateSecret();
    await this.prisma.usuario.update({
      where: { id: user.id },
      data: { totpSecreto: encrypt(secret) },
    });
    return {
      mfaRequerido: true,
      configurarMfa: true,
      mfaToken,
      secreto: secret,
      otpauthUrl: authenticator.keyuri(user.email, 'TendIA', secret),
    };
  }

  async verifyMfa(mfaToken: string, code: string) {
    let payload: { sub: string; purpose?: string };
    try {
      payload = this.jwt.verify(mfaToken);
    } catch {
      throw new UnauthorizedException('La sesión de verificación venció. Ingresa de nuevo.');
    }
    if (payload.purpose !== 'mfa') throw new UnauthorizedException('Token inválido');
    const user = await this.prisma.usuario.findUnique({ where: { id: payload.sub } });
    if (!user?.totpSecreto) throw new UnauthorizedException('Token inválido');
    if (!authenticator.check(code, decrypt(user.totpSecreto))) {
      throw new UnauthorizedException('El código de verificación no es correcto');
    }
    if (!user.mfaActivo) {
      await this.prisma.usuario.update({ where: { id: user.id }, data: { mfaActivo: true } });
    }
    await this.audit.log({
      actorTipo: 'USUARIO',
      actorId: user.id,
      aliadoId: user.aliadoId,
      accion: 'ingreso',
      entidad: 'Usuario',
      entidadId: user.id,
    });
    const actor: Actor = { sub: user.id, rol: user.rol, aliadoId: user.aliadoId };
    return {
      accessToken: this.jwt.sign(actor, { expiresIn: '8h' }),
      usuario: { nombre: user.nombre, email: user.email, rol: user.rol },
    };
  }

  private phoneOrFail(raw: string): string {
    const phone = normalizePhone(raw);
    if (!phone) throw new BadRequestException('Escribe un celular de 10 dígitos que empiece por 3');
    return phone;
  }
}
