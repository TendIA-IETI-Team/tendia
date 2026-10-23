# apps/mobile

App del tendero (Expo SDK 58 + Expo Router). Usa **npm**, no pnpm: Metro funciona mejor sin el enlazado aislado de pnpm. Lee [AGENTS.md](AGENTS.md) antes de tocar APIs de Expo.

```bash
npm install
npx expo start            # Expo Go (escanea el QR) o "a" para el emulador Android
npm run lint && npm run typecheck
```

En un celular físico crea `.env` con `EXPO_PUBLIC_API_URL=http://<IP de tu computador>:4000`. En el emulador Android se usa `http://10.0.2.2:4000` por defecto.

| Pantalla                     | Archivo                                       | Historia                  |
| ---------------------------- | --------------------------------------------- | ------------------------- |
| Ingreso con celular y OTP    | `src/app/ingreso.tsx`                         | TND-010                   |
| T1 Solicitar                 | `src/app/(app)/solicitar.tsx`                 | TND-050                   |
| T2 Autorizar fuentes         | `src/app/(app)/autorizar.tsx`                 | TND-020                   |
| T4/T6 Espera automática      | `src/app/(app)/evaluando.tsx`                 | TND-051                   |
| T5 Completar información     | `src/app/(app)/completar.tsx`                 | TND-034                   |
| T7 Puntaje con escala        | `src/app/(app)/puntaje.tsx`                   | TND-052, TND-053          |
| T8 Justificar variación      | `src/app/(app)/justificar.tsx`                | TND-054                   |
| T9 Enviar y quién revisa     | `src/app/(app)/enviar.tsx`, `seguimiento.tsx` | TND-055                   |
| T10-T13 Garantía y resultado | `src/app/(app)/seguimiento.tsx`               | TND-056, TND-057, TND-081 |
| Mis autorizaciones           | `src/app/(app)/autorizaciones.tsx`            | TND-021                   |

E2E con Maestro: `maestro test .maestro/flujo-feliz.yaml`.
