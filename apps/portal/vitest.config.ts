import { defineConfig } from 'vitest/config';

// Las pruebas unitarias viven en src/; e2e/ es de Playwright.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
