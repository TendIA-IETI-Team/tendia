/**
 * Reinicia la verificación en dos pasos de un analista (ADR-001: la recuperación la hace un
 * administrador). El próximo ingreso vuelve a mostrar el QR para enrolar la app autenticadora.
 *
 *   node dist/scripts/reset-mfa.js analista@bancodemo.co
 *   docker compose exec api node dist/scripts/reset-mfa.js analista@bancodemo.co
 */
import { PrismaClient } from '@prisma/client';

export async function resetMfa(prisma: PrismaClient, email: string): Promise<boolean> {
  const user = await prisma.usuario.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return false;
  await prisma.usuario.update({
    where: { id: user.id },
    data: { mfaActivo: false, totpSecreto: null, intentosFallidos: 0, bloqueadoHasta: null },
  });
  await prisma.auditoria.create({
    data: {
      actorTipo: 'SISTEMA',
      actorId: 'reset-mfa',
      aliadoId: user.aliadoId,
      accion: 'reinicio_mfa',
      entidad: 'Usuario',
      entidadId: user.id,
    },
  });
  return true;
}

if (require.main === module) {
  const email = process.argv[2];
  if (!email) {
    process.stderr.write('Uso: node dist/scripts/reset-mfa.js <correo>\n');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  resetMfa(prisma, email)
    .then((ok) => {
      process.stdout.write(
        ok
          ? `MFA reiniciado para ${email}. En el próximo ingreso verá el QR.\n`
          : `No existe un usuario con el correo ${email}.\n`,
      );
      process.exitCode = ok ? 0 : 1;
    })
    .finally(() => prisma.$disconnect());
}
