// Pruebas de la API: unitarias (archivos .spec.ts en src) y de integración (.e2e-spec.ts en test).
// Las de integración necesitan Postgres y el servicio de scoring (ver docs/test-plan.md).
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { isolatedModules: true }] },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup-env.js'],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/openapi.ts'],
  coverageDirectory: 'coverage',
  coverageThreshold: { global: { lines: 70, statements: 70 } },
  testTimeout: 30000,
};
