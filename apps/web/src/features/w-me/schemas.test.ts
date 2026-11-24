import { nicknameSchema } from '@house/shared';
import { describe, expect, it } from 'vitest';
import {
  COMPLEXES,
  LISTINGS,
  seedFavoriteComplexes,
  seedFavoriteListings,
  seedNotifications,
  seedRecentViews,
} from '@/app/mock-api/v1/me/_fixtures';
import { mockMe } from '@/app/mock-api/v1/auth/_state';
import { dealStore } from '@/app/mock-api/v1/deal-requests/_store';
import { isAgencyNotification, notificationHref } from './lib/notifications';
import {
  favoriteComplexSchema,
  listingSummarySchema,
  notificationPageSchema,
  notificationSchema,
  profileSchema,
} from './schemas';

/** The mock fixtures are the contract examples — they must satisfy the response schemas. */
describe('w-me schemas ↔ mock fixtures', () => {
  const now = Date.parse('2026-11-23T03:00:00Z');

  it('parses every listing and complex fixture', () => {
    for (const l of LISTINGS) expect(listingSummarySchema.safeParse(l).success, l.id).toBe(true);
    for (const c of COMPLEXES)
      expect(
        favoriteComplexSchema.safeParse({ ...c, favoritedAt: new Date(now).toISOString() }).success,
        c.name,
      ).toBe(true);
    expect(new Set(LISTINGS.map((l) => l.id)).size).toBe(LISTINGS.length);
  });

  it('seeds only reference existing fixtures, newest first', () => {
    const listingIds = new Set(LISTINGS.map((l) => l.id));
    const complexIds = new Set(COMPLEXES.map((c) => c.id));
    const sorted = (rows: { at: string }[]) =>
      rows.every((r, i) => i === 0 || Date.parse(rows[i - 1]!.at) >= Date.parse(r.at));
    for (const rows of [seedFavoriteListings(now), seedRecentViews(now)]) {
      expect(rows.every((r) => listingIds.has(r.id))).toBe(true);
      expect(sorted(rows)).toBe(true);
    }
    const complexes = seedFavoriteComplexes(now);
    expect(complexes.every((r) => complexIds.has(r.id))).toBe(true);
    expect(sorted(complexes)).toBe(true);
  });

  it('parses notifications and gives the actionable ones a destination', () => {
    const rows = seedNotifications(now);
    expect(notificationPageSchema.safeParse({ items: rows, nextCursor: null }).success).toBe(true);
    expect(rows.filter((n) => !n.readAt)).toHaveLength(3);
    expect(rows.filter((n) => n.type === 'PROPOSAL_RECEIVED').map(notificationHref)).toEqual(
      rows
        .filter((n) => n.type === 'PROPOSAL_RECEIVED')
        .map((n) => `/me/requests/${String(n.data?.dealRequestId)}`),
    );
  });

  it('seeds only requester-side notifications (agency events belong to the console mock)', () => {
    const rows = seedNotifications(now);
    // DEAL_REQUEST_RECEIVED / PROPOSAL_ACCEPTED / CONTACT_GRANTED are sent to agency members: a
    // requester's feed must not use them for "요청이 전달됐어요" style confirmations.
    expect(rows.filter(isAgencyNotification)).toEqual([]);
    for (const n of rows) {
      const href = notificationHref(n);
      expect(href?.startsWith('/agent') ?? false, n.title).toBe(false);
      const dealRequestId = n.data?.dealRequestId;
      if (typeof dealRequestId === 'string')
        expect(href, n.title).toBe(`/me/requests/${dealRequestId}`);
    }
    // Copy must not promise alerts the backend does not have (price change, favourite sold).
    expect(rows.some((n) => /가격이 바뀔|거래완료됐어요/.test(`${n.title} ${n.body ?? ''}`))).toBe(
      false,
    );
  });

  it('points request notifications at requests that exist in the w-deal mock', () => {
    const known = new Set(dealStore().requests.map((r) => r.id));
    for (const n of seedNotifications(now)) {
      const id = n.data?.dealRequestId;
      if (typeof id === 'string') expect(known.has(id), n.title).toBe(true);
    }
  });

  it('falls back to SYSTEM for notification types this build does not know yet', () => {
    const parsed = notificationSchema.parse({
      id: 'n1',
      type: 'SOMETHING_NEW',
      title: '새 알림',
      createdAt: new Date(now).toISOString(),
    });
    expect(parsed.type).toBe('SYSTEM');
  });

  it('reads the profile from the MeResponse of GET /auth/me (agencyId ← agency.agencyId)', () => {
    const agent = profileSchema.parse(mockMe('AGENCY_OWNER'));
    expect(agent.agencyId).toBe(mockMe('AGENCY_OWNER').agency?.agencyId);
    expect(agent.agencyId).toBeTruthy();
    expect(profileSchema.parse(mockMe('USER')).agencyId ?? null).toBeNull();
    // The backend may send a null nickname (PII scrub) — the profile still parses.
    const scrubbed = profileSchema.parse({ ...mockMe('USER'), nickname: null });
    expect(scrubbed.nickname).toBeNull();
  });

  it('mock members have nicknames the backend accepts (the profile form re-validates them)', () => {
    for (const role of ['USER', 'AGENT', 'AGENCY_OWNER'] as const)
      expect(nicknameSchema.safeParse(mockMe(role).nickname).success, role).toBe(true);
  });
});
