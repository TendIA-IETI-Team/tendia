import { defineConfig } from '@playwright/test';

// E2E del flujo feliz del portal (TND-070). Requiere API + scoring + DB corriendo
// (docker compose up) y el portal en PORTAL_URL.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.PORTAL_URL ?? 'http://localhost:3000',
    locale: 'es-CO',
    trace: 'retain-on-failure',
  },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
});
