import { DealType, ListingStatus, listingDraftSchema } from '@house/shared';
import { describe, expect, it } from 'vitest';
import { seedListings } from '@/app/mock-api/v1/agency/listings/_fixtures';
import {
  applyDraft,
  isMine,
  isPrimaryMine,
  listingsState,
  publishRequirementsError,
  summarize,
  toCandidate,
  toItem,
  toView,
} from '@/app/mock-api/v1/agency/listings/_store';
import {
  agencyListingItemSchema,
  agencyListingSchema,
  agencyListingSummarySchema,
  coBrokerCandidateSchema,
} from './api/schemas';
import { draftOfListing } from './lib/form';
import { missingRequirements } from './lib/requirements';

const seeds = seedListings();
const seed = (code: string) => {
  const found = seeds.find((s) => s.code === code);
  if (!found) throw new Error(`missing seed ${code}`);
  return found;
};

/** The mock fixtures are the contract examples — they must satisfy the response schemas. */
describe('a-listings schemas ↔ mock fixtures', () => {
  it('parses every seeded listing as editor payload, table row and co-broker candidate', () => {
    for (const s of seeds) {
      expect(agencyListingSchema.safeParse(toView(s)).success, s.code).toBe(true);
      expect(agencyListingItemSchema.safeParse(toItem(s)).success, s.code).toBe(true);
      expect(coBrokerCandidateSchema.safeParse(toCandidate(s)).success, s.code).toBe(true);
    }
  });

  it('covers every status, deal type and both ownership kinds', () => {
    const mine = seeds.filter(isMine);
    for (const status of Object.values(ListingStatus)) {
      expect(
        mine.some((s) => s.status === status),
        status,
      ).toBe(true);
    }
    for (const deal of Object.values(DealType)) {
      expect(
        mine.some((s) => s.dealType === deal),
        deal,
      ).toBe(true);
    }
    expect(mine.some((s) => !isPrimaryMine(s))).toBe(true);
    // Other offices' listings that can be joined as a co-broker.
    expect(seeds.some((s) => !isMine(s))).toBe(true);
  });

  it('never exposes the private 호수 of another office’s listing to a co-broker candidate', () => {
    for (const s of seeds.filter((x) => !isMine(x))) {
      const candidate = toCandidate(s);
      expect(candidate).not.toHaveProperty('ho');
      if (s.property.ho) expect(JSON.stringify(candidate), s.code).not.toContain(s.property.ho);
    }
  });

  it('resolves exactly one primary office per listing', () => {
    for (const s of seeds) {
      const agencies = toView(s).agencies;
      expect(agencies.length, s.code).toBe(s.offices.length);
      expect(agencies.filter((a) => a.isPrimary).length, s.code).toBe(1);
    }
  });

  it('summary counters add up', () => {
    const state = listingsState();
    const summary = agencyListingSummarySchema.parse(summarize(state));
    const mine = state.listings.filter(isMine);
    expect(summary.total).toBe(mine.length);
    expect(Object.values(summary.byStatus).reduce((a, b) => a + b, 0)).toBe(summary.total);
    expect(summary.coBrokered).toBe(mine.filter((l) => !isPrimaryMine(l)).length);
    expect(summary.verificationDue).toBeGreaterThan(0);
  });
});

describe('mock publish validator', () => {
  it('published listings satisfy every 명시사항', () => {
    for (const s of seeds.filter(
      (x) => x.status === ListingStatus.ACTIVE || x.status === ListingStatus.RESERVED,
    )) {
      expect(missingRequirements(draftOfListing(s)), s.code).toEqual([]);
      expect(publishRequirementsError(s), s.code).toBeNull();
    }
  });

  it('answers 422 LISTING_PUBLISH_REQUIREMENTS with details: [{ field, label }] for a holey draft', async () => {
    const draft = seed('D01');
    const row = toItem(draft);
    expect(row.missingCount).toBeGreaterThan(0);
    const res = publishRequirementsError(draft);
    expect(res?.status).toBe(422);
    const body = (await res!.json()) as {
      code: string;
      message: string;
      details: { field: string; label: string }[];
    };
    expect(body.code).toBe('LISTING_PUBLISH_REQUIREMENTS');
    expect(body.details).toHaveLength(row.missingCount as number);
    for (const d of body.details) {
      expect(d.field).toBeTruthy();
      expect(d.label).toBeTruthy();
    }
  });
});

describe('mock applyDraft (PATCH semantics)', () => {
  it('replaces the draft fields and clears the omitted ones', () => {
    const listing = structuredClone(seed('L01'));
    const input = listingDraftSchema.parse({
      ...draftOfListing(listing),
      dealType: DealType.JEONSE,
      salePrice: undefined,
      deposit: 27500,
      title: undefined,
    });
    applyDraft(listing, input);
    expect(listing.dealType).toBe(DealType.JEONSE);
    expect(listing.deposit).toBe(27500);
    expect(listing.salePrice).toBeNull();
    expect(listing.title).toBeNull();
    // Still a valid editor payload afterwards.
    expect(agencyListingSchema.safeParse(toView(listing)).success).toBe(true);
  });
});
