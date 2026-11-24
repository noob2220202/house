import globals from 'globals';
import { baseConfig } from '@house/config/eslint/base';

export default [
  ...baseConfig({ tsconfigRootDir: import.meta.dirname, ignores: ['scripts/**'] }),
  { languageOptions: { globals: { ...globals.browser } } },
];
