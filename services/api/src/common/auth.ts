import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export type Rol = 'TENDERO' | 'ANALISTA' | 'ADMIN_ALIADO';

export interface Actor {
  sub: string;
  rol: Rol;
  aliadoId?: string;
}

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/** Ruta sin JWT (login, salud, API pública con llave propia). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES, roles);

export const CurrentActor = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Actor => ctx.switchToHttp().getRequest().actor,
);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { actor?: Actor }>();
    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Falta el token de acceso');

    let payload: Actor & { purpose?: string };
    try {
      payload = this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException('Token inválido o vencido');
    }
    // Los tokens intermedios de MFA no sirven como sesión.
    if (payload.purpose) throw new UnauthorizedException('Token inválido');
    req.actor = { sub: payload.sub, rol: payload.rol, aliadoId: payload.aliadoId };

    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES, targets);
    if (roles && !roles.includes(payload.rol)) {
      throw new ForbiddenException('No tienes permiso para esta acción');
    }
    return true;
  }
}
