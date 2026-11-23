import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Prisma config disables automatic .env loading; dotenv/config loads apps/api/.env (if present).
export default defineConfig({
  schema: path.join('prisma', 'schema'),
  migrations: {
    path: path.join('prisma', 'schema', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
