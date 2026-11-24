import { baseConfig } from '@house/config/eslint/base';

export default baseConfig({ tsconfigRootDir: import.meta.dirname, ignores: ['scripts/**'] });
