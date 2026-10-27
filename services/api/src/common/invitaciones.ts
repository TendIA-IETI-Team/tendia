import type { RolUsuario } from '@prisma/client';
import { config } from '../config';
import type { PrismaService } from '../prisma.service';
import { randomToken, sha256 } from './crypto';

export const INVITACION_DIAS = 7;

/**
 * Crea una invitación de un solo uso (TND-011). Solo se guarda el hash del token: el enlace se
 * devuelve una vez, junto con un mailto listo para que quien invita lo envíe desde su correo.
 */
export async function crearInvitacion(
  prisma: PrismaService,
  datos: { aliadoId: string; email: string; nombre: string; rol: RolUsuario; creadaPor: string },
) {
  const token = randomToken(32);
  const inv = await prisma.invitacion.create({
    data: {
      ...datos,
      tokenHash: sha256(token),
      expiraEn: new Date(Date.now() + INVITACION_DIAS * 86_400_000),
    },
    include: { aliado: { select: { nombre: true } } },
  });
  const enlace = `${config().PORTAL_URL}/invitacion/${token}`;
  const asunto = `Te invitaron al portal de TendIA de ${inv.aliado.nombre}`;
  const tarea =
    inv.rol === 'ADMIN_ALIADO'
      ? `Te invitaron a administrar el portal de TendIA de ${inv.aliado.nombre}: política de riesgo, equipo y solicitudes de crédito.`
      : 'Te invitaron a revisar solicitudes de crédito en TendIA.';
  const cuerpo = [
    `Hola ${inv.nombre}:`,
    '',
    `${tarea} Crea tu contraseña aquí (vence en ${INVITACION_DIAS} días):`,
    enlace,
    '',
    'Al entrar te pediremos activar la verificación en dos pasos.',
  ].join('\n');
  return {
    inv,
    enlace,
    mailto: `mailto:${encodeURIComponent(inv.email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`,
  };
}
