/**
 * Base seed: what every environment (production included) needs. Idempotent and conservative:
 * existing rows are never overwritten, so operator edits made in the admin survive re-runs
 * (deploy.sh runs this after every migration).
 */
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
import { AdminRole, type PrismaClient, RegionLevel, TermsType } from '@prisma/client';
import { SUNCHEON_REGIONS } from './regions';

export async function seedRegions(prisma: PrismaClient, sggCode: string): Promise<number> {
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
  // The 읍면동/리 list below is keyed to 46150 (순천시). With another REGION_SGG_CODE the operator
  // loads that 시군구's 법정동 list instead (admin regions API).
  if (sggCode !== DEFAULT_SGG_CODE) return 2;
  let order = 0;
  for (const r of SUNCHEON_REGIONS) {
    const parentCode = r.level === 'RI' ? `${r.code.slice(0, 8)}00` : sggCode;
    const parentName = SUNCHEON_REGIONS.find((p) => p.code === parentCode)?.name;
    await prisma.region.upsert({
      where: { code: r.code },
      update: {},
      create: {
        code: r.code,
        name: r.name,
        fullName: [DEFAULT_REGION_NAME, parentName, r.name].filter(Boolean).join(' '),
        level: r.level === 'RI' ? RegionLevel.RI : RegionLevel.EMD,
        parentCode,
        lat: r.lat,
        lng: r.lng,
        sortOrder: order++,
      },
    });
  }
  return SUNCHEON_REGIONS.length + 2;
}

export async function seedBannerSlots(prisma: PrismaClient): Promise<void> {
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

/** Placeholders the operator must replace in the admin (validated by the same zod schemas). */
export async function seedSiteSettings(prisma: PrismaClient): Promise<void> {
  const values: { [K in SiteSettingKey]: unknown } = {
    BUSINESS_INFO: {
      companyName: '(상호 입력)',
      ceoName: '(대표자 입력)',
      businessNumber: '000-00-00000',
      mailOrderNumber: '(통신판매업 신고번호 입력)',
      address: DEFAULT_REGION_NAME,
      privacyOfficer: '(개인정보보호책임자 입력)',
      phone: '061-000-0000',
      email: 'contact@example.com',
    },
    CONTACT: {
      phone: '061-000-0000',
      email: 'help@example.com',
      hours: '평일 09:00~18:00 (점심 12:00~13:00, 주말·공휴일 휴무)',
    },
    SEO: {
      title: '순천 부동산 — 순천 아파트·원룸·상가·토지 매물',
      description: '순천시 중개사무소들이 함께 올리는 확인 매물, 단지 실거래가, 내놓기·구하기.',
    },
    FEATURES: { dealRequests: true, localVideos: true, complexTrades: true },
    FOOTER: {
      links: [
        { label: '이용약관', url: '/terms/SERVICE' },
        { label: '개인정보처리방침', url: '/terms/PRIVACY' },
        { label: '위치기반서비스 이용약관', url: '/terms/LOCATION' },
        { label: '공지사항', url: '/notices' },
      ],
      copyright: '© 순천 부동산',
      disclaimer:
        '매물 정보는 각 중개사무소가 등록하며, 실제 거래 조건과 다를 수 있습니다. 계약 전 반드시 현장과 서류를 확인하세요.',
    },
  };
  for (const key of Object.values(SiteSettingKey)) {
    const value = siteSettingSchemas[key].parse(values[key]) as object;
    await prisma.siteSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
}

const TERMS_V1: { type: TermsType; title: string; isRequired: boolean; body: string }[] = [
  {
    type: TermsType.SERVICE,
    title: '서비스 이용약관',
    isRequired: true,
    body: '이 약관은 순천 부동산 서비스(이하 "서비스")의 이용 조건과 절차, 회원과 운영자의 권리·의무를 정합니다.',
  },
  {
    type: TermsType.PRIVACY,
    title: '개인정보 수집·이용 동의 및 개인정보처리방침',
    isRequired: true,
    body: '서비스는 소셜 로그인(카카오·네이버·Google)으로 받은 식별자와 회원이 직접 입력한 연락처만 처리합니다. 문자(SMS)는 발송하지 않습니다.',
  },
  {
    type: TermsType.LOCATION,
    title: '위치기반서비스 이용약관 (선택)',
    isRequired: false,
    body: '지도 검색에서 회원이 허용한 경우에만 현재 위치를 사용하며, 위치정보는 저장하지 않습니다.',
  },
  {
    type: TermsType.MARKETING,
    title: '마케팅 정보 수신 동의 (선택)',
    isRequired: false,
    body: '새 매물·단지 소식 등 광고성 정보를 앱 알림과 이메일로 받습니다. 동의하지 않아도 서비스를 이용할 수 있습니다.',
  },
];

/** Version 1.0 of every terms type, effective immediately. Text is a placeholder for legal review. */
export async function seedTerms(prisma: PrismaClient, now: Date): Promise<void> {
  for (const t of TERMS_V1) {
    const existing = await prisma.termsDocument.findFirst({ where: { type: t.type } });
    if (existing) continue;
    await prisma.termsDocument.create({
      data: {
        type: t.type,
        version: '1.0',
        title: t.title,
        content: `# ${t.title}\n\n> 초안입니다. 운영 전 법률 검토를 거쳐 관리자 화면에서 새 버전으로 교체하세요.\n\n${t.body}\n`,
        isRequired: t.isRequired,
        effectiveAt: now,
        publishedAt: now,
      },
    });
  }
}

/**
 * Initial SUPER_ADMIN from ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD (SEED_ADMIN_* are
 * accepted as aliases). Created only if that email does not exist yet; TOTP is enrolled on the
 * first login, before any admin route works.
 */
export async function seedSuperAdmin(
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv,
): Promise<string | null> {
  const email = (env.ADMIN_BOOTSTRAP_EMAIL || env.SEED_ADMIN_EMAIL)?.trim().toLowerCase();
  const password = env.ADMIN_BOOTSTRAP_PASSWORD || env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    throw new Error('ADMIN_BOOTSTRAP_EMAIL is not an email');
  if (password.length < 12)
    throw new Error('ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters');
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) return null;
  await prisma.adminUser.create({
    data: {
      email,
      name: '최고관리자',
      role: AdminRole.SUPER_ADMIN,
      passwordHash: await hash(password),
      passwordChangedAt: new Date(),
    },
  });
  return email;
}
