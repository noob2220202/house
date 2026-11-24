/**
 * Idempotent seed (safe to re-run; deploy.sh runs it after every migration).
 *
 *   pnpm db:seed                    base data only: 순천시 regions, banner slot limits, site-setting
 *                                   placeholders, terms v1, and the first SUPER_ADMIN when
 *                                   ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD are set
 *   SEED_DEMO=true pnpm db:seed     + FICTIONAL demo data (단지, 중개사무소, ~200 매물, 실거래가,
 *                                   banners, popup, notices, FAQ, videos) — local/staging only;
 *                                   refused when NODE_ENV=production unless SEED_DEMO_FORCE=true
 *   pnpm db:seed:demo               shortcut for the line above
 *
 * TOTP for the SUPER_ADMIN is enrolled on the first login (mandatory before any admin route).
 */
import 'dotenv/config';
import { canonicalRegionCode, DEFAULT_SGG_CODE } from '@house/shared';
import { PrismaClient } from '@prisma/client';
import {
  seedBannerSlots,
  seedRegions,
  seedSiteSettings,
  seedSuperAdmin,
  seedTerms,
} from './seed/base';
import { seedDemo } from './seed/demo';

const prisma = new PrismaClient();
const truthy = (v: string | undefined) => v === 'true' || v === '1' || v === 'yes';

async function main(): Promise<void> {
  const env = process.env;
  const now = new Date();
  // Same rule as the API env schema: a legacy 46150 (전라남도 순천시) means 12150.
  const sggCode = canonicalRegionCode(env.REGION_SGG_CODE?.trim() || DEFAULT_SGG_CODE);
  if (!/^\d{5}$/.test(sggCode)) throw new Error('REGION_SGG_CODE must be 5 digits');

  const regions = await seedRegions(prisma, sggCode);
  await seedBannerSlots(prisma);
  await seedSiteSettings(prisma);
  await seedTerms(prisma, now);
  const admin = await seedSuperAdmin(prisma, env);
  console.warn(
    `seed: base ok (regions ${regions}${admin ? `, created SUPER_ADMIN ${admin}` : ''})`,
  );
  if (sggCode === DEFAULT_SGG_CODE) {
    console.warn(
      'seed: 읍면동 codes are SAMPLE values — load the official 법정동코드 list before launch',
    );
  }

  if (!truthy(env.SEED_DEMO)) return;
  if (env.NODE_ENV === 'production' && !truthy(env.SEED_DEMO_FORCE)) {
    throw new Error(
      'SEED_DEMO refused in production (fictional data); set SEED_DEMO_FORCE=true to override',
    );
  }
  const counts = await seedDemo(prisma, {
    sggCode,
    uploadDir: env.UPLOAD_DIR || './.data/uploads',
    now,
  });
  console.warn(
    `seed: demo ok (complexes ${counts.complexes}, agencies ${counts.agencies}, listings ${counts.listings}, trades ${counts.trades}, banners ${counts.banners})`,
  );
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
