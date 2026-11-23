// Next.js preset (App Router).
import nextPlugin from '@next/eslint-plugin-next';
import globals from 'globals';
import { baseConfig } from './base.mjs';

/**
 * @param {{ tsconfigRootDir: string, ignores?: string[] }} options
 */
export function nextConfig(options) {
  return [
    ...baseConfig(options),
    {
      plugins: { '@next/next': nextPlugin },
      languageOptions: { globals: { ...globals.browser } },
      rules: {
        ...nextPlugin.configs.recommended.rules,
        ...nextPlugin.configs['core-web-vitals'].rules,
      },
    },
  ];
}
