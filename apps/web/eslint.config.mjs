import { nextConfig } from '@house/config/eslint/next';

export default nextConfig({
  tsconfigRootDir: import.meta.dirname,
  ignores: ['.next-*/**', 'next-env.d.ts'],
});
