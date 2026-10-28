import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { authenticator } from 'otplib';
import request from 'supertest';
import { bearer, createApp, loginAliado } from './helpers';

/**
 * Alta de una entidad nueva: el equipo de TendIA la crea con la invitación de su primer
 * administrador, que crea su contraseña, enrola la verificación en dos pasos e invita a su equipo.
 */
describe('Alta de aliados (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let tendia: string;

  const nueva = {
    entidad: 'Cooperativa Ñapa & Cía.',
    tipo: 'FINTECH',
    nombre: 'Sofía Rincón',
    email: 'Sofia@Napa.co',
  };

  beforeAll(async () => {
    ({ app, prisma } = await createApp());
    http = app.getHttpServer();
    tendia = await loginAliado(app, 'admin@tendia.co');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('solo el equipo de TendIA da de alta entidades', async () => {
    const banco = await loginAliado(app, 'admin@bancodemo.co');
    await request(http).post('/admin/aliados').set(bearer(banco)).send(nueva).expect(403);
    await request(http).get('/admin/aliados').set(bearer(banco)).expect(403);
    await request(http).post('/admin/aliados').send(nueva).expect(401);
  });

  it('valida los datos y no repite correos ni nombres', async () => {
    await request(http)
      .post('/admin/aliados')
      .set(bearer(tendia))
      .send({ ...nueva, tipo: 'CASA_DE_EMPENO' })
      .expect(400);
    await request(http)
      .post('/admin/aliados')
      .set(bearer(tendia))
      .send({ ...nueva, email: 'analista@bancodemo.co' })
      .expect(409);
    await request(http)
      .post('/admin/aliados')
      .set(bearer(tendia))
      .send({ ...nueva, entidad: 'banco demo popular' })
      .expect(409);
    expect(await prisma.aliado.count()).toBe(2);
  });

  it('crea la entidad y su primer administrador entra con contraseña y QR', async () => {
    const r = await request(http)
      .post('/admin/aliados')
      .set(bearer(tendia))
      .send(nueva)
      .expect(201);
    expect(r.body.aliado).toMatchObject({ nombre: 'Cooperativa Ñapa & Cía.', tipo: 'FINTECH' });
    const aliado = await prisma.aliado.findUniqueOrThrow({ where: { id: r.body.aliado.id } });
    expect(aliado.slug).toBe('cooperativa-napa-cia');
    expect(r.body.invitacion.enlace).toMatch(/^http:\/\/localhost:3000\/invitacion\/[\w-]{40,}$/);
    expect(decodeURIComponent(r.body.invitacion.mailto)).toContain('administrar el portal');
    expect(await prisma.auditoria.count({ where: { accion: 'crear_aliado' } })).toBe(1);

    const lista = await request(http).get('/admin/aliados').set(bearer(tendia)).expect(200);
    const fila = lista.body.find((a: { id: string }) => a.id === aliado.id);
    expect(fila).toMatchObject({ usuarios: 0, administradores: 0, solicitudes: 0 });
    expect(fila.invitacionesPendientes[0].email).toBe('sofia@napa.co');

    // La invitación es la misma de siempre: rol administrador, un solo uso.
    const token = r.body.invitacion.enlace.split('/').pop();
    const ver = await request(http).get(`/auth/invitacion/${token}`).expect(200);
    expect(ver.body).toEqual({
      email: 'sofia@napa.co',
      nombre: 'Sofía Rincón',
      rol: 'ADMIN_ALIADO',
      aliado: 'Cooperativa Ñapa & Cía.',
    });
    await request(http)
      .post(`/auth/invitacion/${token}`)
      .send({ password: 'cooperativa-segura-2026' })
      .expect(201);

    const login = await request(http)
      .post('/auth/aliado/login')
      .send({ email: 'sofia@napa.co', password: 'cooperativa-segura-2026' })
      .expect(200);
    expect(login.body.configurarMfa).toBe(true);
    expect(login.body.otpauthUrl).toContain('otpauth://totp/TendIA:sofia%40napa.co');
    const mfa = await request(http)
      .post('/auth/aliado/mfa')
      .send({ mfaToken: login.body.mfaToken, codigo: authenticator.generate(login.body.secreto) })
      .expect(200);
    expect(mfa.body.usuario.rol).toBe('ADMIN_ALIADO');
    const sofia = mfa.body.accessToken;

    // Administra su entidad y no ve nada de las demás.
    const bandeja = await request(http).get('/aliado/solicitudes').set(bearer(sofia)).expect(200);
    expect(bandeja.body.solicitudes).toEqual([]);
    const politica = await request(http).get('/aliado/politica').set(bearer(sofia)).expect(200);
    expect(politica.body.scoreMinAprobar).toBe(650);
    await request(http)
      .post('/aliado/equipo/invitaciones')
      .set(bearer(sofia))
      .send({ email: 'analista@napa.co', nombre: 'Julián Analista' })
      .expect(201);
    await request(http).get('/admin/aliados').set(bearer(sofia)).expect(403);

    const despues = await request(http).get('/admin/aliados').set(bearer(tendia)).expect(200);
    expect(despues.body.find((a: { id: string }) => a.id === aliado.id)).toMatchObject({
      usuarios: 1,
      administradores: 1,
      conMfa: 1,
    });
  });

  it('una segunda entidad con nombre parecido recibe otro slug', async () => {
    const r = await request(http)
      .post('/admin/aliados')
      .set(bearer(tendia))
      .send({ ...nueva, entidad: 'Cooperativa Ñapa Cía', email: 'otra@napa.co' })
      .expect(201);
    const aliado = await prisma.aliado.findUniqueOrThrow({ where: { id: r.body.aliado.id } });
    expect(aliado.slug).toBe('cooperativa-napa-cia-2');
  });

  it('reenvía la invitación de administrador a una entidad existente', async () => {
    const aliado = await prisma.aliado.findUniqueOrThrow({ where: { slug: 'microcredito-demo' } });
    const r = await request(http)
      .post(`/admin/aliados/${aliado.id}/invitaciones`)
      .set(bearer(tendia))
      .send({ nombre: 'Segundo Admin', email: 'segundo@microdemo.co' })
      .expect(201);
    const token = r.body.invitacion.enlace.split('/').pop();
    const ver = await request(http).get(`/auth/invitacion/${token}`).expect(200);
    expect(ver.body).toMatchObject({ rol: 'ADMIN_ALIADO', aliado: 'Microcrédito Demo' });
    await request(http)
      .post('/admin/aliados/00000000-0000-4000-8000-000000000000/invitaciones')
      .set(bearer(tendia))
      .send({ nombre: 'Nadie', email: 'nadie@x.co' })
      .expect(404);
  });
});
