import { nestConfig } from '@house/config/eslint/nest';

export default nestConfig({
  tsconfigRootDir: import.meta.dirname,
  ignores: ['test/**/*.mjs', 'test/**/*.cjs', 'test/jest-e2e.config.js', 'scripts/**'],
});
