import {
  AGENCY_SITE_STATUS_LABEL,
  AgencySiteStatus,
  normalizeSiteSlug,
  siteSlugMessage,
  type AgencySiteColor,
  type AgencySiteRequestInput,
} from '@house/shared';
import type { StatusTone } from '@house/ui';
import type { MyAgencySite, SiteSlugAvailability } from './schemas';

/** Status pill of the site (labels: 신청 중 · 운영 중 · 반려 · 정지). */
export const SITE_STATUS_PILL: Record<AgencySiteStatus, { tone: StatusTone; label: string }> = {
  REQUESTED: { tone: 'review', label: AGENCY_SITE_STATUS_LABEL.REQUESTED },
  ACTIVE: { tone: 'live', label: AGENCY_SITE_STATUS_LABEL.ACTIVE },
  REJECTED: { tone: 'rejected', label: AGENCY_SITE_STATUS_LABEL.REJECTED },
  SUSPENDED: { tone: 'ended', label: AGENCY_SITE_STATUS_LABEL.SUSPENDED },
};

/** Approved, but the address does not open yet (no certificate): not "운영 중" until then. */
export const SITE_PREPARING_PILL: { tone: StatusTone; label: string } = {
  tone: 'scheduled',
  label: '준비 중',
};

/** "sindae.suncheonmap.kr" — the host as an office would type or say it. */
export function siteHost(slug: string, rootDomain: string): string {
  return `${normalizeSiteSlug(slug)}.${rootDomain}`;
}

/** "https://sindae.suncheonmap.kr" → "sindae.suncheonmap.kr". */
export function hostOfUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

export type SlugCheck =
  | { state: 'idle' }
  | { state: 'invalid'; message: string }
  | { state: 'checking' }
  | { state: 'own'; message: string }
  | { state: 'available'; message: string }
  | { state: 'unavailable'; message: string }
  | { state: 'error'; message: string };

/**
 * What the form says about a typed slug: the shared format rules first (no request), then the
 * server's answer for the debounced value (`availability` of exactly that slug, or undefined while
 * it is loading). `own` = the slug this office already asked for (always fine to keep).
 */
export function slugCheck(
  typed: string,
  {
    availability,
    failed = false,
    own = null,
  }: { availability?: SiteSlugAvailability; failed?: boolean; own?: string | null },
): SlugCheck {
  const slug = normalizeSiteSlug(typed);
  if (!slug) return { state: 'idle' };
  const local = siteSlugMessage(slug);
  if (local) return { state: 'invalid', message: local };
  if (own && slug === own) return { state: 'own', message: '지금 신청한 주소예요.' };
  if (failed)
    return { state: 'error', message: '주소를 확인하지 못했어요. 신청할 때 다시 확인해요.' };
  if (!availability || availability.slug !== slug) return { state: 'checking' };
  if (availability.available) return { state: 'available', message: '쓸 수 있는 주소예요.' };
  switch (availability.reason) {
    case 'TAKEN':
      return { state: 'unavailable', message: '이미 다른 사무소가 쓰고 있거나 신청한 주소예요.' };
    case 'RESERVED':
      return {
        state: 'unavailable',
        message: '사용할 수 없는 주소예요. 다른 주소를 입력해 주세요.',
      };
    default:
      return { state: 'unavailable', message: siteSlugMessage(slug) ?? '쓸 수 없는 주소예요.' };
  }
}

/** The 이용권 line of the page (both products are free while enforcement is off). */
export function subscriptionNotice(sub: MyAgencySite['subscription']): {
  tone: 'muted' | 'success' | 'warn';
  text: string;
} {
  if (!sub.required) return { tone: 'muted', text: '현재 무료로 제공 중이에요.' };
  if (sub.active) {
    return {
      tone: 'success',
      text: sub.endsOn
        ? `이용 기간: ${sub.endsOn.replaceAll('-', '.')}까지`
        : '이용 중인 이용권이 있어요.',
    };
  }
  return {
    tone: 'warn',
    text: '이용 기간이 아니라서 홈페이지가 열리지 않아요. 이용 신청은 고객센터로 문의해 주세요.',
  };
}

export interface SiteDraft {
  slug: string;
  color: AgencySiteColor;
  tagline: string;
}

/** Request form values → the POST body (`agencySiteRequestSchema`); empty tagline = none. */
export function requestBody(draft: SiteDraft): AgencySiteRequestInput {
  return {
    slug: normalizeSiteSlug(draft.slug),
    color: draft.color,
    tagline: draft.tagline.trim() || null,
  };
}

export const SITE_STATUSES_WITH_URL: readonly AgencySiteStatus[] = [
  AgencySiteStatus.ACTIVE,
  AgencySiteStatus.SUSPENDED,
];
