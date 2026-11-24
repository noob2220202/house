import 'server-only';
import { z } from 'zod';
import { serverGetOr } from '@/lib/api/server';

/**
 * Public site settings: GET /api/v1/site-settings/public (admin module).
 * ASSUMED SHAPE — an object keyed by SiteSettingKey; every key optional. Lenient on purpose so a
 * half-filled back-office never breaks the footer. See docs/frontend-integration/foundation.md.
 */
const publicSiteSettingsSchema = z.object({
  BUSINESS_INFO: z
    .object({
      companyName: z.string(),
      ceoName: z.string(),
      businessNumber: z.string(),
      mailOrderNumber: z.string(),
      address: z.string(),
      privacyOfficer: z.string(),
      phone: z.string(),
      email: z.string(),
    })
    .partial()
    .optional(),
  CONTACT: z
    .object({
      phone: z.string(),
      email: z.string(),
      hours: z.string(),
      kakaoChannelUrl: z.string(),
    })
    .partial()
    .optional(),
  SEO: z.object({ title: z.string(), description: z.string() }).partial().optional(),
  FEATURES: z.record(z.string(), z.boolean()).optional(),
});
export type PublicSiteSettings = z.infer<typeof publicSiteSettingsSchema>;

export interface BusinessInfo {
  companyName: string;
  ceoName: string;
  businessNumber: string;
  mailOrderNumber: string;
  address: string;
  privacyOfficer: string;
  email: string;
  /** 고객센터 대표번호. */
  phone: string;
  /** "평일 09:00 – 18:00 · 점심 12:00 – 13:00" */
  hours: string;
}

/** Shown until the operator fills in 사이트 설정 (same placeholders as the design). */
export const BUSINESS_INFO_PLACEHOLDER: BusinessInfo = {
  companyName: '[상호]',
  ceoName: '[대표]',
  businessNumber: '[사업자등록번호]',
  mailOrderNumber: '[신고번호]',
  address: '[주소]',
  privacyOfficer: '[개인정보보호책임자]',
  email: '[이메일]',
  phone: '[대표번호]',
  hours: '평일 09:00 – 18:00 · 점심 12:00 – 13:00',
};

/** Cached 5 min; never throws (falls back to `{}` when the API is unreachable, e.g. during build). */
export function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  return serverGetOr<PublicSiteSettings, typeof publicSiteSettingsSchema>(
    '/site-settings/public',
    {},
    { schema: publicSiteSettingsSchema, revalidate: 300, tags: ['site-settings'], timeoutMs: 4000 },
  );
}

/** Footer business info (전자상거래법 표시사항) with placeholders for missing fields. */
export async function getBusinessInfo(): Promise<BusinessInfo> {
  const settings = await getPublicSiteSettings();
  const b = settings.BUSINESS_INFO ?? {};
  const c = settings.CONTACT ?? {};
  const p = BUSINESS_INFO_PLACEHOLDER;
  return {
    companyName: b.companyName || p.companyName,
    ceoName: b.ceoName || p.ceoName,
    businessNumber: b.businessNumber || p.businessNumber,
    mailOrderNumber: b.mailOrderNumber || p.mailOrderNumber,
    address: b.address || p.address,
    privacyOfficer: b.privacyOfficer || p.privacyOfficer,
    email: c.email || b.email || p.email,
    phone: c.phone || b.phone || p.phone,
    hours: c.hours || p.hours,
  };
}

/** Feature flags from settings: `await isFeatureEnabled('appBand')`. Unknown flags are off. */
export async function isFeatureEnabled(flag: string): Promise<boolean> {
  const settings = await getPublicSiteSettings();
  return settings.FEATURES?.[flag] === true;
}
