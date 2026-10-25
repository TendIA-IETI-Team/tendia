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
import { isProduction } from '../config';
import { AuditService } from '../common/audit.service';
import type { Actor } from '../common/auth';
import { decrypt, encrypt, lookupHash, normalizePhone, sha256 } from '../common/crypto';
import { PrismaService } from '../prisma.service';
import { DEMO_PROFILES, OtpSender } from './otp-sender';

export { DEMO_PROFILES };

const OTP_TTL_MS = 5 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_PER_WINDOW = 3;
const OTP_WINDOW_MS = 10 * 60_000;
const MAX_INTENTOS_ALIADO = 5;
const BLOQUEO_MS = 15 * 60_000;
// Hash señuelo para que un correo inexistente tarde lo mismo que una contraseña errada.
const DUMMY_HASH = bcrypt.hashSync('tendia-hash-senuelo', 10);

// Marca del OTP que genera y valida Twilio Verify: no es un sha256, así que no choca con un código.
const OTP_EN_TWILIO = 'twilio-verify';

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
    const canal = this.otp.canal(phone);
    let code: string | undefined;
    if (canal === 'twilio') {
      await this.otp.enviar(phone);
    } else {
      code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    }
    await this.prisma.otpCodigo.create({
      data: {
        celularHash,
        codigoHash: code ? sha256(`${code}:${celularHash}`) : OTP_EN_TWILIO,
        expiraEn: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    return code ? { enviado: true, codigoDev: code } : { enviado: true };
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
    const correcto =
      otp.codigoHash === OTP_EN_TWILIO
        ? await this.otp.verificar(phone, code)
        : otp.codigoHash === sha256(`${code}:${celularHash}`);
    if (!correcto) {
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
    // La sesión del tendero se mantiene en el celular hasta que cierre sesión (TND-010).
    return { accessToken: this.jwt.sign(actor, { expiresIn: '90d' }), nuevo };
  }

  // --- Invitación de un analista (TND-011) ---------------------------------
  private async invitacionVigente(token: string) {
    const inv = await this.prisma.invitacion.findUnique({
      where: { tokenHash: sha256(token) },
      include: { aliado: { select: { nombre: true } } },
    });
    if (!inv || inv.usadaEn || inv.expiraEn <= new Date()) {
      throw new BadRequestException('La invitación venció o ya se usó. Pide una nueva.');
    }
    return inv;
  }

  async verInvitacion(token: string) {
    const inv = await this.invitacionVigente(token);
    return { email: inv.email, nombre: inv.nombre, rol: inv.rol, aliado: inv.aliado.nombre };
  }

  /** Crea la cuenta del analista. El primer ingreso le pide activar la verificación en dos pasos. */
  async aceptarInvitacion(token: string, password: string) {
    const inv = await this.invitacionVigente(token);
    if (await this.prisma.usuario.findUnique({ where: { email: inv.email } })) {
      throw new BadRequestException('Ya existe una cuenta con ese correo. Ingresa con ella.');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await this.prisma.$transaction([
      this.prisma.usuario.create({
        data: {
          aliadoId: inv.aliadoId,
          email: inv.email,
          nombre: inv.nombre,
          rol: inv.rol,
          passwordHash,
        },
      }),
      this.prisma.invitacion.update({ where: { id: inv.id }, data: { usadaEn: new Date() } }),
    ]);
    await this.audit.log({
      actorTipo: 'USUARIO',
      actorId: user.id,
      aliadoId: inv.aliadoId,
      accion: 'aceptar_invitacion',
      entidad: 'Usuario',
      entidadId: user.id,
      finalidad: 'administrar_cuenta',
    });
    return { creado: true, email: user.email };
  }

  // --- Analista del aliado: correo + contraseña + TOTP obligatorio (TND-011) -
  async loginAliado(email: string, password: string) {
    const user = await this.prisma.usuario.findUnique({ where: { email: email.toLowerCase() } });
    if (user) this.exigirNoBloqueado(user.bloqueadoHasta);
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      if (user) await this.registrarFallo(user.id, user.intentosFallidos);
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

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
    this.exigirNoBloqueado(user.bloqueadoHasta);
    if (!authenticator.check(code, decrypt(user.totpSecreto))) {
      await this.registrarFallo(user.id, user.intentosFallidos);
      throw new UnauthorizedException('El código de verificación no es correcto');
    }
    await this.prisma.usuario.update({
      where: { id: user.id },
      data: { mfaActivo: true, intentosFallidos: 0, bloqueadoHasta: null },
    });
    await this.audit.log({
      actorTipo: 'USUARIO',
      actorId: user.id,
      aliadoId: user.aliadoId,
      accion: 'ingreso',
      entidad: 'Usuario',
      entidadId: user.id,
    });
    const actor: Actor = { sub: user.id, rol: user.rol, aliadoId: user.aliadoId ?? undefined };
    return {
      accessToken: this.jwt.sign(actor, { expiresIn: '8h' }),
      usuario: { nombre: user.nombre, email: user.email, rol: user.rol },
    };
  }

  private exigirNoBloqueado(bloqueadoHasta: Date | null) {
    if (bloqueadoHasta && bloqueadoHasta > new Date()) {
      const minutos = Math.ceil((bloqueadoHasta.getTime() - Date.now()) / 60_000);
      throw new HttpException(
        `Cuenta bloqueada por intentos fallidos. Intenta de nuevo en ${minutos} minutos.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Tras 5 intentos fallidos (contraseña o código) la cuenta se bloquea 15 minutos. */
  private async registrarFallo(userId: string, previos: number) {
    const intentos = previos + 1;
    const bloquear = intentos >= MAX_INTENTOS_ALIADO;
    await this.prisma.usuario.update({
      where: { id: userId },
      data: bloquear
        ? { intentosFallidos: 0, bloqueadoHasta: new Date(Date.now() + BLOQUEO_MS) }
        : { intentosFallidos: intentos },
    });
    if (bloquear) {
      await this.audit.log({
        actorTipo: 'SISTEMA',
        actorId: 'auth',
        accion: 'bloqueo_por_intentos',
        entidad: 'Usuario',
        entidadId: userId,
      });
    }
  }

  private phoneOrFail(raw: string): string {
    const phone = normalizePhone(raw);
    if (!phone) throw new BadRequestException('Escribe un celular de 10 dígitos que empiece por 3');
    return phone;
  }
}
