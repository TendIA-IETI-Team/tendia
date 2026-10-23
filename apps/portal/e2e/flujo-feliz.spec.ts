import { expect, test } from '@playwright/test';
import { authenticator } from 'otplib';

const API = process.env.API_URL ?? 'http://127.0.0.1:4000';
const PASSWORD = 'TendIA-demo-2026!';

/** Crea por API una solicitud enviada al Banco Demo, como lo haría la app del tendero. */
async function solicitudEnviada(request: import('@playwright/test').APIRequestContext) {
  const celular = `310${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  const otp = await (await request.post(`${API}/auth/tendero/otp`, { data: { celular } })).json();
  const { accessToken } = await (
    await request.post(`${API}/auth/tendero/verificar`, {
      data: { celular, codigo: otp.codigoDev },
    })
  ).json();
  const h = { Authorization: `Bearer ${accessToken}` };
  await request.put(`${API}/me/negocio`, {
    headers: h,
    data: { nombre: 'Tienda E2E', antiguedadMeses: 60, barrio: 'Suba' },
  });
  await request.post(`${API}/consentimientos`, {
    headers: h,
    data: { fuente: 'DATAFONO', proveedor: 'Bold' },
  });
  await request.post(`${API}/consentimientos`, {
    headers: h,
    data: { fuente: 'DISTRIBUIDOR', proveedor: 'Distribuidor mayorista (simulado)' },
  });
  const s = await (
    await request.post(`${API}/solicitudes`, {
      headers: h,
      data: { monto: 2_000_000, destino: 'Surtido', plazoMeses: 6 },
    })
  ).json();
  await request.post(`${API}/solicitudes/${s.id}/evaluar`, { headers: h });
  const aliados = await (await request.get(`${API}/aliados`, { headers: h })).json();
  const banco = aliados.find((a: { nombre: string }) => a.nombre === 'Banco Demo Popular');
  await request.post(`${API}/solicitudes/${s.id}/enviar`, {
    headers: h,
    data: { aliadoId: banco.id },
  });
}

test('el analista ingresa con MFA, revisa una solicitud y la aprueba', async ({
  page,
  request,
}) => {
  await solicitudEnviada(request);

  await page.goto('/login');
  await page.getByLabel('Correo').fill('admin@bancodemo.co');
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Primer ingreso: enrolar MFA leyendo la clave mostrada; si ya estaba enrolado, no hay clave visible.
  await expect(page.getByLabel('Código de 6 dígitos')).toBeVisible();
  const clave = page.locator('code');
  const secreto = (await clave.count()) ? await clave.innerText() : process.env.E2E_TOTP_SECRET;
  test.skip(!secreto, 'MFA ya enrolado: define E2E_TOTP_SECRET para repetir la prueba');
  await page.getByLabel('Código de 6 dígitos').fill(authenticator.generate(secreto!));
  await page.getByRole('button', { name: 'Ingresar' }).click();

  await expect(page.getByRole('heading', { name: 'Solicitudes' })).toBeVisible();
  await page.getByRole('link', { name: 'Tienda E2E' }).first().click();
  await expect(page.getByText('Qué pesó en el puntaje')).toBeVisible();
  await expect(page.getByText('de 100', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Aprobar crédito' }).click();
  await expect(page.getByText('Crédito aprobado.')).toBeVisible();
});
