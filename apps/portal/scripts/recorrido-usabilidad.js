// Recorrido de las 9 tareas de docs/usabilidad.md sobre la app real (Expo web, 390x844).
// Mide pasos y tiempo estimado con el modelo KLM (perfil de usuario novato), corre axe-core y
// revisa el tamaño de los objetivos táctiles y de la letra en cada pantalla.
//
// Requisitos: `docker compose up` y `cd apps/mobile && npx expo start --web --port 8081`.
// El MFA del analista debe estar sin enrolar (reset-mfa analista@bancodemo.co).
// Uso, desde apps/portal: node scripts/recorrido-usabilidad.js <carpeta-salida> 3000000123
// Usa siempre un celular del rango de pruebas (300 000 0000 a 0999): nunca envía SMS reales.
const { chromium } = require('@playwright/test');
const { authenticator } = require('otplib');
const { writeFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');

const [OUT, CELULAR] = [process.argv[2], process.argv[3]];
const APP = 'http://localhost:8081';
const API = 'http://127.0.0.1:4000';
mkdirSync(OUT, { recursive: true });

// KLM (Card, Moran y Newell) ajustado a un usuario novato en celular: más tiempo para decidir y
// escribir que el valor de referencia de un experto.
const KLM = {
  M: 2.0,
  P: 1.1,
  tap: 0.2,
  char: 0.6,
  leer: 0.25 /* s por palabra nueva en pantalla */,
};

const tareas = [];
let t = null;
const pantallas = new Map();

function empezar(id, nombre, exito) {
  t = { id, nombre, exito, pasos: [], segundos: 0, completada: false, notas: [] };
  tareas.push(t);
}
const sumar = (s) => (t.segundos += s);

async function leer(page) {
  // Tiempo de lectura de lo que cambió en pantalla (aprox. palabras visibles / 4: solo se escanea).
  const palabras = await page.evaluate(() => document.body.innerText.split(/\s+/).length);
  sumar((palabras / 4) * KLM.leer);
}

async function tocar(page, locOriginal, que) {
  // La navegación web deja montadas pantallas anteriores ocultas: solo cuentan las visibles.
  const loc = locOriginal.locator('visible=true');
  await loc
    .first()
    .waitFor({ timeout: 60_000 })
    .catch(async (e) => {
      await page.screenshot({ path: path.join(OUT, 'fallo.png') });
      throw new Error(`No apareció «${que}»: ${e.message.split(String.fromCharCode(10))[0]}`);
    });
  await loc.first().scrollIntoViewIfNeeded();
  await loc.first().click();
  t.pasos.push(`Toca «${que}»`);
  sumar(KLM.M + KLM.P + KLM.tap);
  await page.waitForTimeout(700);
}

async function escribir(page, locOriginal, texto, que) {
  const loc = locOriginal.locator('visible=true');
  await loc.first().waitFor({ timeout: 60_000 });
  await loc.first().click();
  await loc.first().fill(texto);
  t.pasos.push(`Escribe «${texto}» en ${que}`);
  sumar(KLM.M + KLM.P + KLM.tap + texto.length * KLM.char);
  await page.waitForTimeout(300);
}

async function revisarPantalla(page, nombre) {
  await page.waitForTimeout(800);
  const file = `${String(tareas.length).padStart(2, '0')}-${nombre}.png`;
  await page.screenshot({ path: path.join(OUT, file) });
  if (pantallas.has(nombre)) return;
  await page
    .addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js' })
    .catch(() => {});
  const axe = await page
    .evaluate(async () =>
      window.axe
        ? (await window.axe.run(document, { resultTypes: ['violations'] })).violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            ayuda: v.help,
            nodos: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
            total: v.nodes.length,
          }))
        : null,
    )
    .catch(() => null);
  // Objetivos táctiles menores de 44x44 (WCAG 2.5.5 / guía de Apple y Material).
  const pequenos = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        '[role=button],[role=link],[role=checkbox],[role=radio],a,button,input,textarea',
      ),
    ]
      .filter((e) => e.offsetParent !== null)
      .map((e) => {
        const r = e.getBoundingClientRect();
        return {
          texto: (e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 40),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      })
      .filter((r) => r.w > 0 && (r.w < 44 || r.h < 44)),
  );
  // Texto por debajo de 14 px.
  const letraPequena = await page.evaluate(() => {
    const out = new Set();
    for (const e of document.querySelectorAll('div,span')) {
      if (
        !e.childNodes.length ||
        [...e.childNodes].every((n) => n.nodeType !== 3 || !n.textContent.trim())
      )
        continue;
      const fs = parseFloat(getComputedStyle(e).fontSize);
      if (fs < 14 && e.offsetParent !== null)
        out.add(`${fs}px: ${e.textContent.trim().slice(0, 50)}`);
    }
    return [...out].slice(0, 8);
  });
  pantallas.set(nombre, { archivo: file, axe, pequenos, letraPequena });
}

async function api(method, url, body, token) {
  const r = await fetch(`${API}${url}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${method} ${url} ${r.status} ${await r.text()}`);
  return r.json();
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'es-CO',
  });
  const page = await ctx.newPage();
  const texto = (s) => page.getByText(s, { exact: false });

  // T1
  empezar(1, 'Entrar con el celular', 'Llega al inicio');
  await page.goto(`${APP}/ingreso`);
  await page.getByTestId('celular').waitFor({ timeout: 120_000 });
  await leer(page);
  await revisarPantalla(page, 'ingreso');
  await escribir(page, page.getByTestId('celular'), CELULAR, 'el celular');
  await tocar(page, page.getByTestId('pedir-codigo'), 'Recibir código por mensaje');
  await texto('tu código es').first().waitFor();
  const codigo = (await texto('tu código es').first().innerText()).match(/\d{6}/)[0];
  await revisarPantalla(page, 'codigo');
  await escribir(page, page.getByTestId('codigo'), codigo, 'el código');
  await tocar(page, page.getByTestId('entrar'), 'Entrar');
  await page.getByTestId('solicitar').waitFor({ timeout: 60_000 });
  t.completada = true;
  await leer(page);
  await revisarPantalla(page, 'inicio');

  // T2
  empezar(2, 'Pedir 3 millones para surtir, a 6 meses', 'Solicitud creada');
  await tocar(page, page.getByTestId('solicitar'), 'Solicitar un crédito');
  await leer(page);
  await revisarPantalla(page, 'solicitar');
  await escribir(page, page.getByTestId('monto'), '3000000', 'el monto');
  await tocar(page, page.getByText('Surtir la tienda', { exact: true }), 'Surtir la tienda');
  await tocar(page, page.getByText('6 meses', { exact: true }), '6 meses');
  if (await page.getByTestId('siguiente').isDisabled()) {
    const falta = await texto('Falta:')
      .first()
      .isVisible()
      .catch(() => false);
    t.notas.push(
      falta
        ? `La app dice qué falta: «${(await texto('Falta:').first().innerText()).trim()}»`
        : '«Siguiente» deshabilitado sin decir qué falta',
    );
    await tocar(page, page.getByText('Más de 5 años', { exact: true }), 'Más de 5 años');
  }
  await tocar(page, page.getByTestId('siguiente'), 'Siguiente');
  await page.getByTestId('autorizar').waitFor({ timeout: 60_000 });
  t.completada = true;

  // T3
  empezar(3, 'Autorizar datáfono y proveedor, no el banco', 'Autoriza solo esas dos fuentes');
  await leer(page);
  await revisarPantalla(page, 'autorizar');
  await tocar(page, page.getByTestId('fuente-DATAFONO'), 'Ventas con datáfono');
  await tocar(page, page.getByTestId('fuente-DISTRIBUIDOR'), 'Tu distribuidor');
  await tocar(page, page.getByTestId('autorizar'), 'Autorizar y calcular mi puntaje');
  await page
    .getByTestId('puntaje')
    .or(page.getByTestId('guardar'))
    .first()
    .waitFor({ timeout: 90_000 });
  t.completada = await page.getByTestId('puntaje').isVisible();
  if (!t.completada) t.notas.push('Terminó en T5 (datos incompletos)');

  // T4
  empezar(4, '¿Es bueno o malo tu puntaje? ¿Por qué?', 'Ve la franja y un factor sin desplazarse');
  await leer(page);
  await revisarPantalla(page, 'puntaje');
  const arriba = await page.evaluate(() => {
    const vis = (re) =>
      [...document.querySelectorAll('div')].some((e) => {
        const r = e.getBoundingClientRect();
        return (
          re.test(e.textContent) &&
          r.top >= 0 &&
          r.bottom <= window.innerHeight &&
          e.children.length === 0
        );
      });
    return {
      franja: vis(/Franja (bajo|medio|bueno)/i),
      porque: vis(/(te está|te ayuda|bajando|suma|resta)/i),
    };
  });
  t.completada = arriba.franja && arriba.porque;
  t.notas.push(
    `Franja visible sin desplazarse: ${arriba.franja ? 'sí' : 'no'}; motivo visible: ${arriba.porque ? 'sí' : 'no'}`,
  );

  // T5
  empezar(5, 'Contar que un mes vendió poco por obras', 'Justifica y ve el recálculo');
  await tocar(page, page.getByTestId('justificar'), 'Justificar un mes malo');
  await leer(page);
  await revisarPantalla(page, 'justificar');
  await tocar(page, page.locator('[role=radio]').first(), 'el primer mes sugerido');
  await tocar(page, page.getByText('Obras en la calle', { exact: true }), 'Obras en la calle');
  await tocar(page, page.getByTestId('recalcular'), 'Recalcular mi puntaje');
  await page.getByTestId('puntaje').waitFor({ timeout: 60_000 });
  t.completada = await texto('Con tu justificación')
    .first()
    .isVisible()
    .catch(() => false);
  if (!t.completada) t.notas.push('No apareció el mensaje de recálculo');
  await revisarPantalla(page, 'puntaje-justificado');

  // T6
  empezar(6, 'Anotar con Tendi una venta y un fiado', 'Ambas quedan en Mi cuaderno');
  const pasosAntes = t.pasos.length;
  // Desde el puntaje, ¿cómo vuelve al inicio?
  const volver = page.getByText('Ir al inicio', { exact: true });
  if (
    await volver
      .first()
      .isVisible()
      .catch(() => false)
  )
    await tocar(page, volver, 'Ir al inicio');
  else {
    await page.goto(`${APP}/inicio`);
    t.pasos.push('Sin botón visible para volver al inicio: usa el gesto o botón atrás del celular');
    sumar(KLM.M * 2 + KLM.P + KLM.tap);
    t.notas.push('Desde el puntaje no hay un botón de inicio visible');
  }
  await tocar(page, page.getByTestId('tendi'), 'Hablar con Tendi');
  await leer(page);
  await revisarPantalla(page, 'tendi');
  await escribir(
    page,
    page.getByTestId('mensaje'),
    'hoy vendí 200 mil y le fié 15 mil a doña Rosa',
    'el chat',
  );
  await tocar(page, page.getByTestId('enviar-mensaje'), 'Enviar');
  await texto('Rosa').nth(1).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  await revisarPantalla(page, 'tendi-respuesta');
  await page.goto(`${APP}/cuaderno`);
  t.pasos.push('Vuelve y toca «Mi cuaderno»');
  sumar(2 * (KLM.M + KLM.P + KLM.tap));
  await texto('Tus ventas').first().waitFor({ timeout: 60_000 });
  await texto('Rosa')
    .first()
    .waitFor({ timeout: 20_000 })
    .catch(() => {});
  const cuaderno = await page.evaluate(() => document.body.innerText);
  t.completada = /200\.000/.test(cuaderno) && /Rosa/i.test(cuaderno);
  await revisarPantalla(page, 'cuaderno');
  t.notas.push(`${t.pasos.length - pasosAntes} pasos`);

  // T7
  empezar(7, 'Mandar la solicitud al Banco Demo Popular', 'Sabe quién la revisa');
  await page.goto(`${APP}/inicio`);
  sumar(KLM.M + KLM.P + KLM.tap);
  t.pasos.push('Vuelve al inicio');
  await tocar(
    page,
    page.getByText('Continuar mi solicitud', { exact: true }),
    'Continuar mi solicitud',
  );
  await tocar(page, page.getByTestId('compartir'), 'Compartir con una entidad');
  await leer(page);
  await revisarPantalla(page, 'enviar');
  await tocar(page, page.getByTestId('aliado-Banco Demo Popular'), 'Banco Demo Popular');
  await tocar(page, page.getByTestId('enviar'), 'Enviar a Banco Demo Popular');
  await page.getByTestId('aliado').waitFor({ timeout: 60_000 });
  t.completada = /Banco Demo Popular/.test(await page.getByTestId('aliado').innerText());
  await revisarPantalla(page, 'seguimiento');

  // T8: el banco pide garantía FNG desde el portal (por API).
  empezar(8, 'Entender la garantía que piden', 'Explica el FNG como un respaldo');
  const tok = await page.evaluate(() => localStorage.getItem('tendia.token'));
  const sol = (await api('GET', '/solicitudes', null, tok))[0];
  const l = await api('POST', '/auth/aliado/login', {
    email: 'analista@bancodemo.co',
    password: 'TendIA-demo-2026!',
  });
  const m = await api('POST', '/auth/aliado/mfa', {
    mfaToken: l.mfaToken,
    codigo: authenticator.generate(l.secreto),
  });
  await api(
    'POST',
    `/aliado/solicitudes/${sol.id}/decision`,
    { decision: 'PEDIR_GARANTIA', tipoGarantia: 'FNG' },
    m.accessToken,
  );
  await page.goto(`${APP}/inicio`);
  await page.getByTestId('novedad').waitFor({ timeout: 60_000 });
  await leer(page);
  await revisarPantalla(page, 'aviso');
  await tocar(page, page.getByText('Ver la respuesta', { exact: true }), 'Ver la respuesta');
  await leer(page);
  await revisarPantalla(page, 'garantia');
  const g = await page.evaluate(() => document.body.innerText);
  t.completada = /Fondo Nacional de Garantías/.test(g) && /(fiador|respalda)/i.test(g);
  t.notas.push(
    /fiador/i.test(g)
      ? 'La explicación usa la palabra «fiador»'
      : 'La explicación no compara con un fiador (el criterio de TND-056 lo pide)',
  );

  // T9
  empezar(9, 'Quitar el permiso del datáfono', 'Revoca y entiende que se borran esos datos');
  await page.goto(`${APP}/inicio`);
  t.pasos.push('Vuelve al inicio');
  sumar(KLM.M + KLM.P + KLM.tap);
  await tocar(page, page.getByText('Mis autorizaciones', { exact: true }), 'Mis autorizaciones');
  await leer(page);
  await revisarPantalla(page, 'autorizaciones');
  await tocar(page, page.getByTestId('revocar-DATAFONO'), 'Quitar autorización');
  await leer(page);
  await revisarPantalla(page, 'confirmar-revocar');
  const aviso = await page.evaluate(() => document.body.innerText);
  t.notas.push(
    /borra|borramos/i.test(aviso)
      ? 'Antes de confirmar dice que se borran los datos'
      : 'No dice que se borran los datos antes de confirmar',
  );
  await tocar(
    page,
    page.getByText('Sí, quitar autorización', { exact: true }),
    'Sí, quitar autorización',
  );
  await page.waitForTimeout(1000);
  t.completada = true;
  await revisarPantalla(page, 'revocada');

  await browser.close();
  const resultado = {
    celular: CELULAR,
    klm: KLM,
    tareas: tareas.map((x) => ({ ...x, segundos: Math.round(x.segundos), nPasos: x.pasos.length })),
    pantallas: Object.fromEntries(pantallas),
  };
  writeFileSync(path.join(OUT, 'resultado.json'), JSON.stringify(resultado, null, 2));
  for (const x of resultado.tareas)
    console.log(
      `T${x.id} ${x.completada ? '✓' : '✗'} ${x.nPasos} pasos ~${x.segundos}s  ${x.notas.join(' | ')}`,
    );
})().catch((e) => {
  console.error('ERROR en tarea', t?.id, e.message.split('\n')[0]);
  process.exit(1);
});
