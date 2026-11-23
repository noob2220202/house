/**
 * Minimal, idempotent seed skeleton (safe to re-run). The full 순천시 seed (법정동 list, complexes,
 * demo agencies/listings) comes later and should be added as separate functions here.
 *
 *   pnpm db:seed                         # uses apps/api/.env DATABASE_URL
 *   SEED_ADMIN_EMAIL=… SEED_ADMIN_PASSWORD=… pnpm db:seed   # also creates a SUPER_ADMIN
 */
import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import {
  BANNER_SLOT_SPECS,
  DEFAULT_MAP_CENTER,
  DEFAULT_REGION_NAME,
  DEFAULT_SGG_CODE,
  DEFAULT_SIDO_CODE,
  SiteSettingKey,
  siteSettingSchemas,
  type BannerSlot,
} from '@house/shared';
import { AdminRole, PrismaClient, RegionLevel } from '@prisma/client';

const prisma = new PrismaClient();

async function seedRegions(): Promise<void> {
  const sggCode = process.env.REGION_SGG_CODE ?? DEFAULT_SGG_CODE;
  await prisma.region.upsert({
    where: { code: DEFAULT_SIDO_CODE },
    update: {},
    create: {
      code: DEFAULT_SIDO_CODE,
      name: '전라남도',
      fullName: '전라남도',
      level: RegionLevel.SIDO,
    },
  });
  await prisma.region.upsert({
    where: { code: sggCode },
    update: {},
    create: {
      code: sggCode,
      name: '순천시',
      fullName: DEFAULT_REGION_NAME,
      level: RegionLevel.SGG,
      parentCode: DEFAULT_SIDO_CODE,
      lat: DEFAULT_MAP_CENTER.lat,
      lng: DEFAULT_MAP_CENTER.lng,
    },
  });
}

async function seedBannerSlots(): Promise<void> {
  for (const [slot, spec] of Object.entries(BANNER_SLOT_SPECS) as [
    BannerSlot,
    (typeof BANNER_SLOT_SPECS)[BannerSlot],
  ][]) {
    await prisma.bannerSlotConfig.upsert({
      where: { slot },
      update: {},
      create: { slot, maxActive: spec.maxActive },
    });
  }
}

async function seedSiteSettings(): Promise<void> {
  // Placeholders the operator must replace in the admin (validated by the same zod schemas).
  const businessInfo = siteSettingSchemas[SiteSettingKey.BUSINESS_INFO].parse({
    companyName: '(상호 입력)',
    ceoName: '(대표자 입력)',
    businessNumber: '000-00-00000',
    address: DEFAULT_REGION_NAME,
    privacyOfficer: '(개인정보보호책임자 입력)',
    phone: '061-000-0000',
    email: 'contact@example.com',
  });
  await prisma.siteSetting.upsert({
    where: { key: SiteSettingKey.BUSINESS_INFO },
    update: {},
    create: { key: SiteSettingKey.BUSINESS_INFO, value: businessInfo },
  });
  await prisma.siteSetting.upsert({
    where: { key: SiteSettingKey.FEATURES },
    update: {},
    create: { key: SiteSettingKey.FEATURES, value: {} },
  });
}

async function seedSuperAdmin(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return;
  if (password.length < 12) throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters');
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) return;
  // TOTP is enrolled on first login (mandatory before any admin route works).
  await prisma.adminUser.create({
    data: {
      email,
      name: '최고관리자',
      role: AdminRole.SUPER_ADMIN,
      passwordHash: await hash(password),
    },
  });
  console.warn(`seed: created SUPER_ADMIN ${email}`);
}

async function main(): Promise<void> {
  await seedRegions();
  await seedBannerSlots();
  await seedSiteSettings();
  await seedSuperAdmin();
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
