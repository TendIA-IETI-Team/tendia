# Política de tratamiento de datos personales

> **Borrador para revisión jurídica** (TND-023). Redactado para cumplir la Ley 1581 de 2012 y su reglamentación (Decreto 1074 de 2015, que compila el Decreto 1377 de 2013). Antes de usar datos reales debe revisarlo un abogado y completarse lo marcado entre corchetes.

## 1. Responsable

TendIA [razón social, NIT, domicilio en Bogotá], correo [definir correo de privacidad].

## 2. Qué datos tratamos y para qué

| Dato                               | Finalidad                                           | Base                            |
| ---------------------------------- | --------------------------------------------------- | ------------------------------- |
| Celular                            | Identificarte y enviarte el código de ingreso       | Autorización al registrarte     |
| Nombre, cédula y datos del negocio | Identificar el negocio y calcular el Puntaje TendIA | Autorización                    |
| Ventas con datáfono o código QR    | Calcular el puntaje                                 | Autorización expresa por fuente |
| Compras y pagos a tu distribuidor  | Calcular el puntaje                                 | Autorización expresa por fuente |
| Ingresos a tus cuentas del banco   | Calcular el puntaje                                 | Autorización expresa por fuente |
| Ventas que escribes a mano         | Calcular el puntaje                                 | Autorización                    |

TendIA **no presta dinero**. Calculamos un puntaje y lo compartimos **solo con la entidad que tú elijas** en la app, junto con su explicación y los datos que autorizaste.

No tratamos datos sensibles (salud, origen étnico, orientación política o sexual, biometría) y el modelo no usa género ni edad.

## 3. Tus derechos

Puedes, en cualquier momento y sin costo:

1. **Conocer** qué datos tenemos de ti.
2. **Actualizar y rectificar** tus datos (pantalla "Completar información").
3. **Revocar** una autorización desde "Mis autorizaciones". Al revocarla, **borramos los datos de esa fuente** y dejamos de consultarla.
4. **Pedir que suprimamos** tus datos, salvo los que la ley nos obligue a conservar.
5. **Pedir prueba** de la autorización que nos diste: guardamos la fecha, la fuente, la finalidad y la versión del texto que aceptaste.
6. **Presentar quejas** ante la Superintendencia de Industria y Comercio.

**Cómo ejercerlos:**

- En la app: "Mis autorizaciones" (ver y revocar cada fuente) y "Completar información" (actualizar).
- Por correo a [definir correo de privacidad], desde el celular registrado o con tu cédula.
- El equipo de TendIA consulta la bitácora de tu cuenta (quién vio tus datos, cuándo y para qué) para responderte.

Respondemos consultas en un máximo de 10 días hábiles y reclamos en un máximo de 15 días hábiles.

## 4. Seguridad

- Celular y cédula cifrados en reposo (AES-256-GCM).
- Acceso de las entidades con contraseña y segundo factor obligatorio.
- Cada entidad ve solo las solicitudes que le enviaste.
- Bitácora de quién consultó qué, cuándo y para qué. Nadie puede editarla ni borrarla.
- Postgres impide que una entidad lea solicitudes de otra (Row Level Security).
- Los registros técnicos no contienen datos personales.
- La explicación con inteligencia artificial recibe solo el puntaje y sus factores, nunca datos que te identifiquen.

## 5. Conservación

Mientras tengas cuenta y hasta [definir plazo] después de tu última solicitud, salvo obligación legal distinta.

## 6. Transferencia y transmisión

Las entidades que eliges reciben tus datos como responsables independientes. Nuestros encargados (alojamiento en la nube, envío de SMS, proveedor de IA) los tratan solo por cuenta de TendIA y bajo contrato. [Listar encargados y países antes de producción.]

## 7. Vigencia

Versión `2026-10-v1`. Si la cambiamos de forma sustancial, te pediremos aceptar el nuevo texto.
