/**
 * Base seed: what every environment (production included) needs. Idempotent and conservative:
 * existing rows are never overwritten, so operator edits made in the admin survive re-runs
 * (deploy.sh runs this after every migration).
 */
import { hash } from '@node-rs/argon2';
import {
  ACCOUNT_TERMS_TYPES,
  BANNER_SLOT_SPECS,
  HomeSectionKey,
  DEFAULT_MAP_CENTER,
  canonicalRegionCode,
  DEFAULT_REGION_NAME,
  DEFAULT_SIDO_CODE,
  DEFAULT_SIDO_NAME,
  REGION_CODE_LENGTH,
  SiteSettingKey,
  siteSettingSchemas,
  type BannerSlot,
} from '@house/shared';
import { AdminRole, type PrismaClient, RegionLevel, TermsType } from '@prisma/client';
import { SEED_SGG_CODE, SUNCHEON_REGIONS } from './regions';

/**
 * 시도 + 시군구 rows for the configured REGION_SGG_CODE, plus the bundled 순천시 읍면동/리 list
 * when that code is 순천시. The code is canonicalized first, so a legacy 46150 (전라남도 순천시,
 * before 2026-07-01) seeds the current 12150 rows instead of silently skipping the 읍면동.
 */
export async function seedRegions(
  prisma: PrismaClient,
  configuredSggCode: string,
): Promise<number> {
  const sggCode = canonicalRegionCode(configuredSggCode);
  const isSuncheon = sggCode === SEED_SGG_CODE;
  const sidoCode = sggCode.slice(0, REGION_CODE_LENGTH.SIDO);
  // Names of another 시군구 are unknown here; the operator corrects them in the admin.
  const sidoName = sidoCode === DEFAULT_SIDO_CODE ? DEFAULT_SIDO_NAME : sidoCode;
  await prisma.region.upsert({
    where: { code: sidoCode },
    update: {},
    create: { code: sidoCode, name: sidoName, fullName: sidoName, level: RegionLevel.SIDO },
  });
  await prisma.region.upsert({
    where: { code: sggCode },
    update: {},
    create: {
      code: sggCode,
      name: isSuncheon ? '순천시' : sggCode,
      fullName: isSuncheon ? DEFAULT_REGION_NAME : `${sidoName} ${sggCode}`,
      level: RegionLevel.SGG,
      parentCode: sidoCode,
      ...(isSuncheon ? { lat: DEFAULT_MAP_CENTER.lat, lng: DEFAULT_MAP_CENTER.lng } : {}),
    },
  });
  // The 읍면동/리 list below is 순천시's. With another REGION_SGG_CODE the operator loads that
  // 시군구's 법정동 list instead (admin regions API).
  if (!isSuncheon) return 2;
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
      hostingProvider: '(호스팅서비스 제공자 입력)',
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
    // Every section in its default order; the app band stays hidden until APP_LINKS is filled in.
    HOME_LAYOUT: {
      sections: Object.values(HomeSectionKey).map((key) => ({
        key,
        visible: key !== HomeSectionKey.APP_BAND,
      })),
    },
    APP_LINKS: {},
  };
  for (const key of Object.values(SiteSettingKey)) {
    const value = siteSettingSchemas[key].parse(values[key]) as object;
    await prisma.siteSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
}

/**
 * 내놓기·구하기 notices. Every statement matches the deal-requests module (keep them in sync —
 * `test/e2e/deal-requests/compliance.e2e-spec.ts` checks the numbers against the code):
 * retention = DEAL_REQUEST_LIMITS.CONTACT_RETENTION_DAYS after the request ended (scrub job
 * `DealRequestMaintenanceService.scrubDue`, withdrawal `scrubUser`); pre-grant 제공 항목 =
 * `DealRequestMapper.agency` (grid DEAL_REQUEST_LOCATION_GRID_DEG ≈ 200 m, area bands, form flags).
 */
export const DEAL_REQUEST_PRIVACY_BODY = [
  '- 수집 항목: 이름, 휴대폰 번호, (내놓기) 매물 주소(도로명·동·호수)·위치·층·면적·희망 가격 등 매물 정보·사진·설명, (구하기) 희망 지역·단지·예산·면적 등 찾는 조건과 설명',
  '- 수집·이용 목적: 내놓기·구하기 요청 등록, 중개사무소 제안 전달, 요청 관리와 알림',
  '- 보유·이용 기간: 요청이 끝난 날(거래 완료·취소·기간 만료)부터 30일. 30일이 지나면 이름·휴대폰 번호·동·호수·도로명 주소·위치·층·면적·사진·설명을 파기하고, 요청 기록(요청 유형·매물 유형·거래 유형·희망 가격·읍면동·단지·찾는 조건·등록일)만 내 요청 내역에 남깁니다. 회원 탈퇴 시에는 탈퇴와 함께 같은 항목을 파기합니다.',
  '- 동의를 거부할 권리와 불이익: 동의하지 않을 수 있으며, 동의하지 않으면 요청을 등록할 수 없습니다.',
].join('\n');

export const DEAL_REQUEST_PROVIDE_BODY = [
  '- 제공받는 자: 요청의 공개 범위에 해당하는 이 서비스의 중개사무소(전체 공개: 순천시에서 승인된 모든 중개사무소, 선택 공개: 회원이 고른 중개사무소)와 이미 제안을 보낸 중개사무소',
  '- 제공 목적: 중개 제안과 상담 연락',
  '- 요청을 받은 모든 중개사무소에 제공하는 항목: (내놓기) 매물 유형·거래 유형·희망 가격·입주 가능일, 읍면동·단지명, 전용면적 구간, 약 200m 단위로 낮춘 대략적인 위치, 사진 장수, 체크한 조건(가격 협의 가능·즉시 입주 가능·입주일 협의 가능)과 단지 매물의 저/중/고층 구분, (구하기) 희망 지역·단지·예산·면적·방 수·입주 희망일과 설명',
  '- 연락처를 공개한 중개사무소에만 제공하는 항목: 이름·휴대폰 번호와 (내놓기) 도로명 주소·동·호수·정확한 위치·층·전용면적·사진·설명. 제안을 수락하면서 공개를 선택하거나 요청 상세에서 직접 공개한 중개사무소만 해당하며, 공개는 언제든 취소할 수 있습니다.',
  '- 보유·이용 기간: 요청이 끝난 날부터 30일까지. 거래 완료된 요청은 30일이 지나면, 공개를 취소하거나 요청이 취소·기간 만료·운영자 종료되면 그때부터 중개사무소에서도 연락처와 상세 정보를 볼 수 없습니다.',
  '- 동의를 거부할 권리와 불이익: 동의하지 않을 수 있으며, 동의하지 않으면 요청을 등록할 수 없습니다.',
].join('\n');

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
    // Must say what the web "내 위치" does (features/w-auth/components/location/useMyLocation.tsx).
    body: [
      '- 이용 목적: 지도 검색과 중개사무소 찾기에서 "내 위치" 버튼을 눌러 지도를 현재 위치 근처로 옮깁니다. 이 약관에 동의한 경우에만 기기의 현재 위치를 확인합니다.',
      '- 처리 방식: 현재 위치는 기기(브라우저) 안에서만 사용하며 서버로 보내거나 저장하지 않습니다. 지도는 약 500m 단위로 어림한 위치로 옮기며, 매물·중개사무소를 불러올 때 서버와 주소창에는 그 어림한 지도 범위만 전달됩니다.',
      '- 동의 기록: 회원의 동의 여부와 일시는 약관 동의 내역으로 보관합니다. 로그인하지 않은 방문자의 동의는 기록하지 않으며, 화면을 새로 열면 다시 묻습니다.',
      '- 동의를 거부할 권리: 동의하지 않을 수 있으며, 동의하지 않아도 지도를 직접 움직여 모든 기능을 이용할 수 있습니다.',
    ].join('\n'),
  },
  {
    type: TermsType.MARKETING,
    title: '마케팅 정보 수신 동의 (선택)',
    isRequired: false,
    body: '새 매물·단지 소식 등 광고성 정보를 앱 알림과 이메일로 받습니다. 동의하지 않아도 서비스를 이용할 수 있습니다.',
  },
  // Purpose consents (D8): agreed with one submission, shown inline in its form (개인정보 보호법
  // 제15조②·제17조② notice items).
  {
    type: TermsType.PRIVACY_AGENCY_APPLICATION,
    title: '[필수] 중개사무소 등록 신청 개인정보 수집·이용 동의',
    isRequired: true,
    body: [
      '- 수집 항목: 대표 공인중개사 성명, 연락처(대표·휴대폰), 이메일, 사무소 주소, 중개사무소 등록번호, 사업자등록번호, 제출 서류(등록증 등)',
      '- 수집·이용 목적: 중개사무소 등록 심사, 심사 결과 안내, 중개사 회원 관리',
      '- 보유·이용 기간: 회원 탈퇴 또는 등록 해지 후 5년 (반려된 신청은 반려 후 1년)',
      '- 동의를 거부할 권리와 불이익: 동의하지 않을 수 있으며, 동의하지 않으면 등록 신청을 할 수 없습니다.',
    ].join('\n'),
  },
  {
    type: TermsType.PRIVACY_AGENCY_JOIN,
    title: '[필수] 소속 중개사 합류 개인정보 수집·이용 동의',
    isRequired: true,
    body: [
      '- 수집 항목: 이름, 휴대폰 번호, 직함, 공인중개사 자격 정보(대표가 확인해 입력하는 경우)',
      '- 수집·이용 목적: 소속공인중개사·중개보조원 등록, 매물 표시·광고의 명시사항 표시, 고용 신고 안내',
      '- 보유·이용 기간: 소속 해지 후 5년',
      '- 동의를 거부할 권리와 불이익: 동의하지 않을 수 있으며, 동의하지 않으면 중개사무소에 합류할 수 없습니다.',
    ].join('\n'),
  },
  {
    type: TermsType.DEAL_REQUEST_PRIVACY,
    title: '[필수] 내놓기·구하기 개인정보 수집·이용 동의',
    isRequired: true,
    body: DEAL_REQUEST_PRIVACY_BODY,
  },
  {
    type: TermsType.DEAL_REQUEST_PROVIDE,
    title: '[필수] 내놓기·구하기 개인정보 제3자(중개사무소) 제공 동의',
    isRequired: true,
    body: DEAL_REQUEST_PROVIDE_BODY,
  },
];

const SAMPLE_MARKER = '> 견본';

function sampleContent(t: (typeof TERMS_V1)[number]): string {
  const purpose = !ACCOUNT_TERMS_TYPES.includes(t.type);
  return [
    `# ${t.title}`,
    '',
    purpose
      ? '> 견본입니다. 운영 전 법률 검토를 거쳐 관리자 화면에서 새 버전으로 교체하세요. 이 동의는 해당 신청·요청을 보낼 때마다 따로 받습니다.'
      : '> 견본(초안)입니다. 운영 전 법률 검토를 거쳐 관리자 화면에서 새 버전으로 교체하세요.',
    '',
    t.body,
    '',
  ].join('\n');
}

/** "1.0" → "1.1", "1.9" → "1.10"; anything else gets ".1" appended. */
function nextMinor(version: string): string {
  const m = /^(\d+)\.(\d+)$/.exec(version);
  return m ? `${m[1]}.${Number(m[2]) + 1}` : `${version}.1`;
}

/**
 * Version 1.0 of every terms type, effective immediately. The text is a 견본 (sample) for legal
 * review: the operator replaces it with a reviewed version in the admin before launch.
 *
 * Re-running the seed publishes the current sample as a new minor version when the latest
 * document of a purpose type (D8) is still an older, unreviewed sample (it carries the sample marker) — so a
 * corrected sample (e.g. the 내놓기·구하기 retention notice) reaches databases seeded earlier.
 * A document the operator wrote (no marker) is never touched; consents keep their version.
 */
export async function seedTerms(prisma: PrismaClient, now: Date): Promise<void> {
  for (const t of TERMS_V1) {
    const content = sampleContent(t);
    const latest = await prisma.termsDocument.findFirst({
      where: { type: t.type },
      orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
    });
    if (latest) {
      // Account terms are left alone: a new version would ask every member to agree again.
      const unreviewedOldSample =
        !ACCOUNT_TERMS_TYPES.includes(t.type) &&
        latest.content.split('\n').some((l) => l.startsWith(SAMPLE_MARKER)) &&
        latest.content !== content;
      if (!unreviewedOldSample) continue;
    }
    await prisma.termsDocument.create({
      data: {
        type: t.type,
        version: latest ? nextMinor(latest.version) : '1.0',
        title: t.title,
        content,
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
