import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

/** Tablero de la pregunta de satisfacción (TND-081): promedio, distribución y comentarios. */
export async function resumenSatisfaccion(
  prisma: PrismaService,
  where: Prisma.SolicitudWhereInput,
) {
  const filas = await prisma.solicitud.findMany({
    where: { ...where, satisfaccion: { not: null } },
    select: {
      satisfaccion: true,
      comentarioSatisfaccion: true,
      decididaEn: true,
      estado: true,
      aliado: { select: { nombre: true } },
    },
    orderBy: { decididaEn: 'desc' },
  });
  const distribucion = [1, 2, 3, 4, 5].map((c) => ({
    calificacion: c,
    respuestas: filas.filter((f) => f.satisfaccion === c).length,
  }));
  const suma = filas.reduce((a, f) => a + (f.satisfaccion ?? 0), 0);
  return {
    respuestas: filas.length,
    promedio: filas.length ? Math.round((suma / filas.length) * 10) / 10 : null,
    distribucion,
    comentarios: filas
      .filter((f) => f.comentarioSatisfaccion)
      .slice(0, 20)
      .map((f) => ({
        calificacion: f.satisfaccion,
        comentario: f.comentarioSatisfaccion,
        estado: f.estado,
        aliado: f.aliado?.nombre ?? null,
        fecha: f.decididaEn,
      })),
  };
}
