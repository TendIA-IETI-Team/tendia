import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { lastClosedMonth } from '../src/conectores/simulacion';
import { PrismaService } from '../src/prisma.service';
import { DEMO_PASSWORD } from '../src/seed';
import { bearer, createApp, loginAliado, loginTendero } from './helpers';

// Archivos mínimos con la firma correcta de cada tipo.
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]).toString('base64');
const PDF = Buffer.from('%PDF-1.4\n% documento de prueba\n%%EOF').toString('base64');

/**
 * Cierre del MVP: evidencias y documentos (T8, T10), aviso de cambio de estado (T11-T13),
 * invitaciones con MFA, RLS, bitácora inmutable, ADMIN_TENDIA, satisfacción e indicadores.
 */
describe('Cierre del MVP (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let solicitudId: string;
  let tendero: string;
  let analista: string;

  beforeAll(async () => {
    ({ app, prisma } = await createApp());
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function aliadoId(slug: string) {
    return (await prisma.aliado.findUniqueOrThrow({ where: { slug } })).id;
  }

  it('el tendero adjunta evidencia en T8 y el documento de la garantía en T10', async () => {
    tendero = await loginTendero(app, '3000000002');
    await request(http)
      .put('/me/negocio')
      .set(bearer(tendero))
      .send({ nombre: 'Tienda Doña Gloria', antiguedadMeses: 60, barrio: 'Bosa' })
      .expect(200);
    const consentimiento = await request(http)
      .post('/consentimientos')
      .set(bearer(tendero))
      .send({ fuente: 'DATAFONO', proveedor: 'Bold' })
      .expect(201);
    // TND-020: el registro guarda versión, fecha, fuente y finalidad; el conector devuelve su referencia.
    expect(consentimiento.body.finalidad).toContain('Puntaje TendIA');
    expect(consentimiento.body.referencia).toMatch(/^sim-datafono-bold-/);
    await request(http)
      .post('/consentimientos')
      .set(bearer(tendero))
      .send({ fuente: 'DISTRIBUIDOR', proveedor: 'Distribuidor mayorista (simulado)' })
      .expect(201);
    const sol = await request(http)
      .post('/solicitudes')
      .set(bearer(tendero))
      .send({ monto: 2_500_000, destino: 'Nevera nueva', plazoMeses: 10 })
      .expect(201);
    solicitudId = sol.body.id;
    const evaluada = await request(http)
      .post(`/solicitudes/${solicitudId}/evaluar`)
      .set(bearer(tendero))
      .expect(200);
    // TND-042: indicadores del negocio (ticket promedio desde el datáfono, recompra, rotación).
    const ind = evaluada.body.score.indicadores;
    expect(ind.avg_ticket).toBeGreaterThanOrEqual(6_000);
    expect(ind.avg_ticket).toBeLessThanOrEqual(18_000);
    expect(ind.repurchase_regularity).toBeGreaterThan(0);
    expect(ind.sales_per_peso_purchased).toBeGreaterThan(0);

    const mes = lastClosedMonth();
    await request(http)
      .post(`/solicitudes/${solicitudId}/variaciones`)
      .set(bearer(tendero))
      .send({
        mes,
        motivo: 'Obras en la calle',
        evidencia: { nombre: 'obra.jpg', tipo: 'application/pdf', base64: JPG },
      })
      .expect(400); // el contenido no coincide con el tipo
    const conEvidencia = await request(http)
      .post(`/solicitudes/${solicitudId}/variaciones`)
      .set(bearer(tendero))
      .send({
        mes,
        motivo: 'Obras en la calle',
        evidencia: { nombre: 'obra<script>.jpg', tipo: 'image/jpeg', base64: JPG },
      })
      .expect(200);
    expect(conEvidencia.body.variaciones[0].evidencia).toMatchObject({
      nombre: 'obra_script_.jpg',
      tipo: 'image/jpeg',
    });

    const banco = await aliadoId('banco-demo');
    await request(http)
      .post(`/solicitudes/${solicitudId}/enviar`)
      .set(bearer(tendero))
      .send({ aliadoId: banco })
      .expect(200);
    analista = await loginAliado(app, 'analista@bancodemo.co');
    await request(http)
      .post(`/aliado/solicitudes/${solicitudId}/decision`)
      .set(bearer(analista))
      .send({ decision: 'PEDIR_GARANTIA', tipoGarantia: 'CODEUDOR' })
      .expect(200);

    // T11-T13: la app avisa la decisión hasta que el tendero la ve.
    const conAviso = await request(http)
      .get(`/solicitudes/${solicitudId}`)
      .set(bearer(tendero))
      .expect(200);
    expect(conAviso.body.novedad).toBe(true);
    await request(http).post(`/solicitudes/${solicitudId}/visto`).set(bearer(tendero)).expect(200);
    const visto = await request(http)
      .get(`/solicitudes/${solicitudId}`)
      .set(bearer(tendero))
      .expect(200);
    expect(visto.body.novedad).toBe(false);

    const respondida = await request(http)
      .post(`/solicitudes/${solicitudId}/garantia`)
      .set(bearer(tendero))
      .send({
        respuesta: 'Mi hermano será el codeudor; adjunto su certificado laboral',
        documento: { nombre: 'certificado.pdf', tipo: 'application/pdf', base64: PDF },
      })
      .expect(200);
    expect(respondida.body.documentoGarantia).toMatchObject({ nombre: 'certificado.pdf' });

    // Lo que el tendero adjunta queda en su bitácora.
    const eventos = await prisma.auditoria.findMany({
      where: {
        entidadId: solicitudId,
        accion: { in: ['justificar_variacion', 'responder_garantia'] },
      },
    });
    expect(eventos.map((e) => [e.accion, e.detalle]).sort()).toEqual([
      ['justificar_variacion', { mes: expect.any(String), conEvidencia: true }],
      ['responder_garantia', { conDocumento: true }],
    ]);
  });

  it('el analista ve y descarga los adjuntos, y la lectura queda en la bitácora con su finalidad', async () => {
    const d = await request(http)
      .get(`/aliado/solicitudes/${solicitudId}`)
      .set(bearer(analista))
      .expect(200);
    expect(d.body.variaciones[0].evidencia.tipo).toBe('image/jpeg');
    const doc = d.body.documentoGarantia;
    const archivo = await request(http)
      .get(`/aliado/solicitudes/${solicitudId}/adjuntos/${doc.id}`)
      .set(bearer(analista))
      .buffer(true)
      .parse((res, cb) => {
        const partes: Buffer[] = [];
        res.on('data', (c: Buffer) => partes.push(c));
        res.on('end', () => cb(null, Buffer.concat(partes)));
      })
      .expect(200);
    expect(archivo.headers['content-type']).toContain('application/pdf');
    expect((archivo.body as Buffer).toString('latin1')).toContain('%PDF-1.4');

    // Otro aliado no puede descargarlo (404, sin revelar que existe).
    const micro = await loginAliado(app, 'admin@microdemo.co');
    await request(http)
      .get(`/aliado/solicitudes/${solicitudId}/adjuntos/${doc.id}`)
      .set(bearer(micro))
      .expect(404);

    const lecturas = await prisma.auditoria.findMany({
      where: { entidadId: solicitudId, accion: { in: ['ver_solicitud', 'ver_adjunto'] } },
    });
    expect(lecturas.map((l) => l.finalidad)).toEqual(
      expect.arrayContaining(['evaluar_credito', 'revisar_documento']),
    );
  });

  it('cierra con aprobación, el tendero califica y el aliado ve la satisfacción', async () => {
    await request(http)
      .post(`/aliado/solicitudes/${solicitudId}/garantia`)
      .set(bearer(analista))
      .send({ aceptar: true, plazoAprobado: 12, tasaAprobada: 48.8 })
      .expect(200);
    const fin = await request(http)
      .get(`/solicitudes/${solicitudId}`)
      .set(bearer(tendero))
      .expect(200);
    expect(fin.body.novedad).toBe(true);
    expect(fin.body.aprobado).toEqual({
      monto: 2_500_000,
      plazoMeses: 12,
      tasaEfectivaAnual: 48.8,
    });
    await request(http)
      .post(`/solicitudes/${solicitudId}/satisfaccion`)
      .set(bearer(tendero))
      .send({ calificacion: 4, comentario: 'Fácil, pero quería saber antes lo de la garantía' })
      .expect(200);
    const tablero = await request(http)
      .get('/aliado/satisfaccion')
      .set(bearer(analista))
      .expect(200);
    expect(tablero.body.respuestas).toBe(1);
    expect(tablero.body.promedio).toBe(4);
    expect(tablero.body.distribucion[3]).toEqual({ calificacion: 4, respuestas: 1 });
    expect(tablero.body.comentarios[0].comentario).toContain('garantía');
  });

  it('RLS en Postgres: con el rol del portal, un aliado no ve filas de otro aunque no filtre', async () => {
    const db = app.get(PrismaService);
    const banco = await aliadoId('banco-demo');
    const micro = await aliadoId('microcredito-demo');
    const delBanco = await db.comoAliado(banco, (tx) => tx.solicitud.findMany());
    const delMicro = await db.comoAliado(micro, (tx) => tx.solicitud.findMany());
    expect(delBanco.map((s) => s.id)).toContain(solicitudId);
    expect(delMicro).toHaveLength(0);
    // Tampoco los datos del negocio ni los adjuntos de ese tendero.
    expect(await db.comoAliado(micro, (tx) => tx.datoMensual.count())).toBe(0);
    expect(await db.comoAliado(micro, (tx) => tx.adjunto.count())).toBe(0);
    expect(await db.comoAliado(banco, (tx) => tx.adjunto.count())).toBe(2);
    // El rol del portal es de solo lectura.
    await expect(
      db.comoAliado(banco, (tx) =>
        tx.solicitud.update({ where: { id: solicitudId }, data: { monto: 1 } }),
      ),
    ).rejects.toThrow();
  });

  it('la bitácora no se puede editar ni borrar', async () => {
    await expect(prisma.auditoria.updateMany({ data: { accion: 'otra' } })).rejects.toThrow(
      /no se puede modificar/,
    );
    await expect(prisma.auditoria.deleteMany({})).rejects.toThrow(/no se puede modificar/);
  });

  it('ADMIN_TENDIA consulta la bitácora de un tendero; un aliado no puede', async () => {
    const admin = await loginAliado(app, 'admin@tendia.co');
    const r = await request(http)
      .get('/admin/bitacora')
      .query({ celular: '300 000 0002' })
      .set(bearer(admin))
      .expect(200);
    const acciones = r.body.eventos.map((e: { accion: string }) => e.accion);
    expect(acciones).toEqual(
      expect.arrayContaining(['registro', 'autorizar_fuente', 'compartir_score', 'ver_solicitud']),
    );
    const lectura = r.body.eventos.find((e: { accion: string }) => e.accion === 'ver_solicitud');
    expect(lectura).toMatchObject({ aliado: 'Banco Demo Popular', finalidad: 'evaluar_credito' });
    // La consulta del admin también queda registrada.
    expect(await prisma.auditoria.count({ where: { accion: 'consultar_bitacora' } })).toBe(1);

    await request(http)
      .get('/admin/bitacora')
      .query({ celular: '3000000002' })
      .set(bearer(analista))
      .expect(403);
    await request(http).get('/aliado/solicitudes').set(bearer(admin)).expect(403);
    const global = await request(http).get('/admin/satisfaccion').set(bearer(admin)).expect(200);
    expect(global.body.comentarios[0].aliado).toBe('Banco Demo Popular');
  });

  it('el admin del aliado invita a un analista, que crea su contraseña y enrola MFA', async () => {
    await request(http)
      .post('/aliado/equipo/invitaciones')
      .set(bearer(analista))
      .send({ email: 'nueva@bancodemo.co', nombre: 'Laura Gómez' })
      .expect(403); // solo ADMIN_ALIADO
    const admin = await loginAliado(app, 'admin@bancodemo.co');
    await request(http)
      .post('/aliado/equipo/invitaciones')
      .set(bearer(admin))
      .send({ email: 'analista@bancodemo.co', nombre: 'Repetida' })
      .expect(409);
    const inv = await request(http)
      .post('/aliado/equipo/invitaciones')
      .set(bearer(admin))
      .send({ email: 'Nueva@BancoDemo.co', nombre: 'Laura Gómez' })
      .expect(201);
    expect(inv.body.enlace).toMatch(/^http:\/\/localhost:3000\/invitacion\/[\w-]{40,}$/);
    expect(decodeURIComponent(inv.body.mailto)).toContain(inv.body.enlace);
    const token = inv.body.enlace.split('/').pop();

    const equipo = await request(http).get('/aliado/equipo').set(bearer(admin)).expect(200);
    expect(equipo.body.invitaciones[0].email).toBe('nueva@bancodemo.co');

    const ver = await request(http).get(`/auth/invitacion/${token}`).expect(200);
    expect(ver.body).toMatchObject({ email: 'nueva@bancodemo.co', aliado: 'Banco Demo Popular' });
    await request(http).post(`/auth/invitacion/${token}`).send({ password: 'corta1' }).expect(400);
    await request(http)
      .post(`/auth/invitacion/${token}`)
      .send({ password: 'una-clave-larga-2026' })
      .expect(201);
    await request(http)
      .post(`/auth/invitacion/${token}`)
      .send({ password: 'una-clave-larga-2026' })
      .expect(400); // el enlace se usa una sola vez

    const login = await request(http)
      .post('/auth/aliado/login')
      .send({ email: 'nueva@bancodemo.co', password: 'una-clave-larga-2026' })
      .expect(200);
    expect(login.body.configurarMfa).toBe(true);
    // La contraseña de demostración no sirve para la cuenta nueva.
    await request(http)
      .post('/auth/aliado/login')
      .send({ email: 'nueva@bancodemo.co', password: DEMO_PASSWORD })
      .expect(401);

    const otra = await request(http)
      .post('/aliado/equipo/invitaciones')
      .set(bearer(admin))
      .send({ email: 'temporal@bancodemo.co', nombre: 'Temporal' })
      .expect(201);
    await request(http)
      .delete(`/aliado/equipo/invitaciones/${otra.body.id}`)
      .set(bearer(admin))
      .expect(200);
    await request(http)
      .get(`/auth/invitacion/${otra.body.enlace.split('/').pop()}`)
      .expect(400);
  });

  it('el consumo de la API se ve por mes', async () => {
    const admin = await loginAliado(app, 'admin@bancodemo.co');
    const c = await request(http).get('/aliado/consumo').set(bearer(admin)).expect(200);
    expect(Array.isArray(c.body.porMes)).toBe(true);
  });
});
