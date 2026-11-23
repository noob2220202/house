// e2e: one jest run per module (E2E_MODULE), against that module's own DB + Redis index.
// Start via test/run-e2e.mjs, which migrates the module DB first.
const moduleName = process.env.E2E_MODULE;
if (!moduleName) throw new Error('E2E_MODULE is required (use `pnpm test:e2e [module]`)');

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '..',
  roots: [`<rootDir>/test/e2e/${moduleName}`],
  testRegex: '\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': ['@swc/jest'] },
  setupFiles: ['<rootDir>/test/setup-e2e-env.ts'],
  // Specs of one module share its DB: run them serially.
  maxWorkers: 1,
  testTimeout: 30_000,
};
