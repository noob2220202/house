import { nextConfig } from '@house/config/eslint/next';

export default nextConfig({
  tsconfigRootDir: import.meta.dirname,
  // csp.mjs is loaded by next.config.mjs (plain JS outside the TS project, like the config itself).
  ignores: ['.next-*/**', 'next-env.d.ts', 'csp.mjs', 'csp.d.mts'],
});
