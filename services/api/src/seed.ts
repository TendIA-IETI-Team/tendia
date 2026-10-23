/**
 * Datos de demostración: dos aliados ficticios con sus usuarios y políticas.
 * Idempotente. Nunca se ejecuta en producción.
 */
import { PrismaClient, RolUsuario, TipoAliado } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export const DEMO_PASSWORD = 'TendIA-demo-2026!';

const ALIADOS = [
  {
    slug: 'banco-demo',
    nombre: 'Banco Demo Popular',
    tipo: TipoAliado.BANCO,
    politica: { scoreMinAprobar: 60, scoreMinConGarantia: 45, montoMaximo: 8_000_000 },
    usuarios: [
      { email: 'admin@bancodemo.co', nombre: 'Laura Admin', rol: RolUsuario.ADMIN_ALIADO },
      { email: 'analista@bancodemo.co', nombre: 'Andrés Analista', rol: RolUsuario.ANALISTA },
    ],
  },
  {
    slug: 'microcredito-demo',
    nombre: 'Microcrédito Demo',
    tipo: TipoAliado.MICROFINANCIERA,
    politica: { scoreMinAprobar: 55, scoreMinConGarantia: 40, montoMaximo: 5_000_000 },
    usuarios: [
      { email: 'admin@microdemo.co', nombre: 'Camila Admin', rol: RolUsuario.ADMIN_ALIADO },
    ],
  },
];

export async function seed(client?: PrismaClient): Promise<void> {
  const prisma = client ?? new PrismaClient();
  try {
    await seedWith(prisma);
  } finally {
    if (!client) await prisma.$disconnect();
  }
}

async function seedWith(prisma: PrismaClient): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const a of ALIADOS) {
    const aliado = await prisma.aliado.upsert({
      where: { slug: a.slug },
      create: { slug: a.slug, nombre: a.nombre, tipo: a.tipo },
      update: { nombre: a.nombre, tipo: a.tipo },
    });
    await prisma.politica.upsert({
      where: { aliadoId: aliado.id },
      create: { aliadoId: aliado.id, ...a.politica },
      update: {},
    });
    for (const u of a.usuarios) {
      await prisma.usuario.upsert({
        where: { email: u.email },
        create: { ...u, aliadoId: aliado.id, passwordHash },
        update: {},
      });
    }
  }
}

if (require.main === module) {
  if (process.env.APP_ENV === 'production') {
    console.error('El seed de demostración no se ejecuta en producción');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  seed(prisma)
    .then(() => process.stdout.write('Seed listo\n'))
    .finally(() => prisma.$disconnect());
}
