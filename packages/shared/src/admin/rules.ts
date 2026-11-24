// Owned by the admin module team. Pure rules shared by the API and the admin frontend.
import { ReportAction, ReportStatus, ReportTargetType, SiteSettingKey } from '../enums/admin';
import { TermsType } from '../enums/user';
import { ADMIN_ERROR_MESSAGES } from '../errors/admin';
import { parseYoutubeVideoId } from '../utils/url';

/** Keys served by GET /site-settings/public (everything else is back-office only). */
export const PUBLIC_SITE_SETTING_KEYS: readonly SiteSettingKey[] = [
  SiteSettingKey.BUSINESS_INFO,
  SiteSettingKey.CONTACT,
  SiteSettingKey.SEO,
  SiteSettingKey.FEATURES,
  SiteSettingKey.FOOTER,
  SiteSettingKey.HOME_LAYOUT,
  SiteSettingKey.APP_LINKS,
];

/**
 * 신고자 연락처·IP 보유기간: erased this many days after the report is closed (admin-maintenance
 * job). The report dialog's collection notice states the same number.
 */
export const REPORT_CONTACT_RETENTION_DAYS = 180;

/** Reports in these states still wait for a decision. */
export const OPEN_REPORT_STATUSES: readonly ReportStatus[] = [
  ReportStatus.RECEIVED,
  ReportStatus.IN_REVIEW,
];

export function isReportOpen(status: ReportStatus): boolean {
  return OPEN_REPORT_STATUSES.includes(status);
}

export function reportActionHidesListing(action: ReportAction): boolean {
  return (
    action === ReportAction.LISTING_HIDDEN || action === ReportAction.LISTING_HIDDEN_AGENCY_WARNED
  );
}

export function reportActionWarnsAgency(action: ReportAction): boolean {
  return (
    action === ReportAction.AGENCY_WARNED || action === ReportAction.LISTING_HIDDEN_AGENCY_WARNED
  );
}

/** Actions that make sense for a target: an agency report cannot hide a listing. */
export function isReportActionAllowed(
  targetType: ReportTargetType,
  status: ReportStatus,
  action: ReportAction,
): boolean {
  if (status === ReportStatus.REJECTED) return action === ReportAction.NONE;
  if (targetType === ReportTargetType.AGENCY) return !reportActionHidesListing(action);
  return true;
}

/** Thumbnail (hqdefault, 480×360) of a YouTube URL, or null when the URL is not a video. */
export function youtubeThumbnailUrl(url: string): string | null {
  const id = parseYoutubeVideoId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

function isIpv6(value: string): boolean {
  if (!/^[0-9a-fA-F:.]+$/.test(value) || !value.includes(':')) return false;
  const doubleColon = value.split('::').length - 1;
  if (doubleColon > 1) return false;
  let groups = value.split(':').filter((g, i, all) => g !== '' || (i > 0 && i < all.length - 1));
  // An embedded IPv4 tail (::ffff:10.0.0.1) counts as two groups.
  const last = groups[groups.length - 1];
  if (last !== undefined && last.includes('.')) {
    if (!IPV4.test(last)) return false;
    groups = [...groups.slice(0, -1), '0', '0'];
  }
  const parts = groups.filter((g) => g !== '');
  if (parts.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))) return false;
  return doubleColon === 1 ? parts.length < 8 : parts.length === 8;
}

/** "203.0.113.7", "10.0.0.0/8", "2001:db8::/32" — the formats the admin IP allowlist accepts. */
export function isValidIpOrCidr(entry: string): boolean {
  const [addr = '', prefix, extra] = entry.trim().split('/');
  if (extra !== undefined) return false;
  const v4 = IPV4.test(addr);
  const v6 = !v4 && isIpv6(addr);
  if (!v4 && !v6) return false;
  if (prefix === undefined) return true;
  if (!/^\d{1,3}$/.test(prefix)) return false;
  return Number(prefix) <= (v4 ? 32 : 128);
}

/** "hong@example.com" → "ho***@example.com". */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`;
}

/** Dashboard "광고 종료 임박" window. */
export const ADS_ENDING_SOON_DAYS = 7;

/**
 * 약관 변경 사전 공지 (약관규제법·전자상거래법 practice): a new version of an already published
 * terms type is published at least this many days before its effectiveAt. Changes unfavourable to
 * users need 30 days; the admin UI should suggest that (the API enforces the 7-day floor).
 */
export const TERMS_NOTICE_DAYS = 7;
export const TERMS_NOTICE_DAYS_UNFAVORABLE = 30;

/**
 * Terms types that can never be a condition of using the service:
 *  - MARKETING: 정보통신망법 제50조 requires separate, voluntary consent for 광고성 정보, and
 *    개인정보보호법 제22조⑤ forbids refusing service because an optional consent was declined.
 *  - LOCATION: "내 위치" reads the device position only after the user agreed to this document
 *    (members: recorded consent; visitors: asked each page session); the position stays on the
 *    device (only a coarse map view reaches the server), so it is an optional feature.
 * A document of these types must have isRequired=false (checked on create, update and publish).
 */
export const OPTIONAL_ONLY_TERMS_TYPES: readonly TermsType[] = [
  TermsType.MARKETING,
  TermsType.LOCATION,
];

export function canTermsTypeBeRequired(type: TermsType): boolean {
  return !OPTIONAL_ONLY_TERMS_TYPES.includes(type);
}

export const TERMS_OPTIONAL_ONLY_MESSAGE = ADMIN_ERROR_MESSAGES.TERMS_OPTIONAL_ONLY;
