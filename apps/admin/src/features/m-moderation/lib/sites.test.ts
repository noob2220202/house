import {
  AGENCY_SITE_STATUS_LABEL,
  AGENCY_SUBSCRIPTION_STATE_LABEL,
  AgencySiteStatus,
  AgencySubscriptionState,
} from '@house/shared';
import { describe, expect, it } from 'vitest';
import {
  AGENCY_SITE_STATUS_META,
  SUBSCRIPTION_STATE_META,
  formatWon,
  siteHost,
  siteSlugOf,
  siteVisibility,
  subscriptionEndFor,
  subscriptionPeriod,
  subscriptionPeriodLine,
} from './labels';

describe('사무소 홈페이지 labels', () => {
  it('labels every site status and subscription state with the shared Korean labels', () => {
    for (const status of Object.values(AgencySiteStatus))
      expect(AGENCY_SITE_STATUS_META[status].label).toBe(AGENCY_SITE_STATUS_LABEL[status]);
    for (const state of Object.values(AgencySubscriptionState))
      expect(SUBSCRIPTION_STATE_META[state].label).toBe(AGENCY_SUBSCRIPTION_STATE_LABEL[state]);
    expect(AGENCY_SITE_STATUS_META.REQUESTED.tone).toBe('review');
    expect(AGENCY_SITE_STATUS_META.ACTIVE.tone).toBe('live');
    expect(SUBSCRIPTION_STATE_META.CANCELED.tone).toBe('rejected');
  });

  it('names the address: the approved slug first, else the request', () => {
    expect(siteHost('sindae', 'suncheonmap.kr')).toBe('sindae.suncheonmap.kr');
    expect(siteSlugOf({ slug: 'sindae', requestedSlug: 'other' })).toBe('sindae');
    expect(siteSlugOf({ slug: null, requestedSlug: 'hosupark' })).toBe('hosupark');
    expect(siteSlugOf({ slug: null, requestedSlug: null })).toBeNull();
  });

  it('explains why an approved site is not visible yet', () => {
    const active = { status: AgencySiteStatus.ACTIVE, httpsReady: true, live: true } as const;
    expect(siteVisibility(active, 'APPROVED')).toMatchObject({ tone: 'success', label: '공개 중' });
    expect(siteVisibility({ ...active, live: false }, 'SUSPENDED')?.detail).toContain(
      '승인 상태가 아니라',
    );
    expect(siteVisibility({ ...active, live: false, httpsReady: false }, 'APPROVED')).toMatchObject(
      { label: '주소 준비 중' },
    );
    expect(siteVisibility({ ...active, live: false }, 'APPROVED')?.detail).toContain('이용 기간');
    expect(
      siteVisibility({ ...active, status: AgencySiteStatus.REQUESTED }, 'APPROVED'),
    ).toBeNull();
  });
});

describe('구독 helpers', () => {
  it('formats amounts in 원 (0 = 무료, null = not recorded)', () => {
    expect(formatWon(330_000)).toBe('330,000원');
    expect(formatWon(0)).toBe('무료');
    expect(formatWon(null)).toBe('–');
  });

  it('leaves the amount out of a row when none was recorded', () => {
    const period = { startsOn: '2026-10-24', endsOn: null };
    expect(subscriptionPeriodLine({ ...period, amountWon: null })).toBe('2026.10.24 ~ 종료일 없음');
    expect(subscriptionPeriodLine({ ...period, amountWon: 0 })).toBe(
      '2026.10.24 ~ 종료일 없음 · 무료',
    );
  });

  it('writes the period with an open end', () => {
    expect(subscriptionPeriod({ startsOn: '2026-11-01', endsOn: '2027-10-31' })).toBe(
      '2026.11.01 ~ 2027.10.31',
    );
    expect(subscriptionPeriod({ startsOn: '2026-11-01', endsOn: null })).toBe(
      '2026.11.01 ~ 종료일 없음',
    );
  });

  it('computes the inclusive last day of an n-month period', () => {
    expect(subscriptionEndFor('2026-11-01', 1)).toBe('2026-11-30');
    expect(subscriptionEndFor('2026-11-15', 12)).toBe('2027-11-14');
    expect(subscriptionEndFor('2026-12-10', 3)).toBe('2027-03-09');
    // The end month has no 31st: the period ends on its last day.
    expect(subscriptionEndFor('2026-01-31', 1)).toBe('2026-02-28');
    expect(subscriptionEndFor('2028-01-30', 1)).toBe('2028-02-29');
    expect(subscriptionEndFor('2026-01-28', 1)).toBe('2026-02-27');
    expect(subscriptionEndFor('', 1)).toBe('');
    expect(subscriptionEndFor('2026-11-01', 0)).toBe('');
  });
});
