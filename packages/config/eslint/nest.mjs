// NestJS preset. Decorator metadata needs runtime (value) imports of injected classes,
// so consistent-type-imports must not rewrite them into `import type`.
import { baseConfig } from './base.mjs';

/**
 * @param {{ tsconfigRootDir: string, ignores?: string[] }} options
 */
export function nestConfig(options) {
  return [
    ...baseConfig(options),
    {
      rules: {
        '@typescript-eslint/consistent-type-imports': 'off',
        '@typescript-eslint/no-extraneous-class': 'off',
      },
    },
    {
      files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts'],
      rules: {
        '@typescript-eslint/unbound-method': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        'no-console': 'off',
      },
    },
  ];
}
